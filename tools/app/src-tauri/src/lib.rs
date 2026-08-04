// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use hidapi::HidApi;
use hidapi::HidDevice;
use serde::Serialize;
use tauri::State;

const VID: u16 = 0x4c58;
const PID: u16 = 0x5310;
const KEYMAP_LEN: usize = 480; // 6 scenes * 80 bytes（与固件 sceneMapTable[SCENE_MAX][SCENE_MAP_SIZE] 一致）
const KEYMAP_REPORT_ID: u8 = 0x01; // 固件 KEYMAP_REPORT_ID，与报表描述符一致
const SCENE_MAX: usize = 6; // 槽 0 为主层，1..5 为场景（与固件 keyMap.h SCENE_MAX 一致）
const SCENE_MAP_SIZE: usize = 80; // 每槽总长度 = 16 应用名 + 32 主层 + 32 Fn 层（与固件 SCENE_MAP_SIZE 一致）
const SCENE_NAME_LEN: usize = 16; // 每个槽前 16 字节为应用名

// 轮询线程所需的可共享状态（用 Arc 包裹，可独立 clone 给线程）
pub struct PollShared {
    pub keymap: Mutex<Vec<u8>>,    // 480 字节真相源（方案 A）
    pub last_scene: Mutex<i32>,    // 自动轮询去重
    pub last_app: Mutex<String>,   // 激活应用日志去重
    pub running: AtomicBool,       // 线程退出信号
}

impl Default for PollShared {
    fn default() -> Self {
        PollShared {
            keymap: Mutex::new(vec![0u8; KEYMAP_LEN]),
            last_scene: Mutex::new(-1),
            last_app: Mutex::new(String::new()),
            running: AtomicBool::new(false),
        }
    }
}

#[derive(Default)]
pub struct AppState {
    pub devices: Mutex<HashMap<String, HidDevice>>, // path -> device
    pub last_active_app: Mutex<String>,             // active_app 日志去重
    pub poll: std::sync::Arc<PollShared>,           // 轮询线程共享状态
    pub auto_poll: Mutex<Option<thread::JoinHandle<()>>>, // 轮询线程句柄
}

#[derive(Serialize, Clone)]
struct DeviceInfo {
    path: String,
    product: String,
    serial: String,
}

#[derive(Serialize, Clone)]
struct ActiveApp {
    app_name: String, // WM_CLASS 实例名（如 unknown、xs16keymap）
    title: String,    // 窗口标题（_NET_WM_NAME / WM_NAME）
    pid: u32,         // 真实窗口 PID（_NET_WM_PID）
    self_pid: u32,
}

#[derive(Serialize)]
struct PollStatus {
    app_name: String,
    title: String,
    pid: u32,
    matched_scene: i32,
}

#[tauri::command]
fn list_devices(state: State<AppState>) -> Result<Vec<DeviceInfo>, String> {
    let api = HidApi::new().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    // 同一台键盘固件暴露了多个 HID 接口（Keyboard + Mouse），
    // 每个接口 VID:PID 相同，只取第一个匹配接口（interface 0，即键盘通信接口），
    // 避免前端把一台物理设备显示成多个。
    for d in api.device_list() {
        if d.vendor_id() == VID && d.product_id() == PID {
            let serial = d.serial_number().unwrap_or("").to_string();
            let path = d.path().to_string_lossy().to_string();
            let product = d.product_string().unwrap_or("XS16 Keyboard").to_string();
            if state.devices.lock().unwrap().contains_key(&path) {
                continue; // 已经打开的不重复列出
            }
            out.push(DeviceInfo {
                path,
                product,
                serial,
            });
            break; // 单设备：只取第一个接口，跳过 Mouse 等辅助接口
        }
    }
    Ok(out)
}

#[tauri::command]
fn open_device(path: String, state: State<AppState>) -> Result<(), String> {
    let api = HidApi::new().map_err(|e| e.to_string())?;
    let dev = api.open_path(&std::ffi::CString::new(path.as_bytes()).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    state.devices.lock().unwrap().insert(path, dev);
    Ok(())
}

#[tauri::command]
fn close_device(path: String, state: State<AppState>) -> Result<(), String> {
    if let Some(dev) = state.devices.lock().unwrap().remove(&path) {
        drop(dev);
    }
    Ok(())
}

// 读取特征报告 0x01: 键位数据（一次 GetReport 回传整条 481 字节）
#[tauri::command]
fn read_keymap(state: State<AppState>) -> Result<Vec<u8>, String> {
    println!("{} [read_keymap] 开始读取设备键位", log_prefix());
    let api = HidApi::new().map_err(|e| e.to_string())?;
    let dev = open_first(&api, &state)?;
    // 固件 GetReport(case 0x01) 会主动把 KeymapBuf 内容回传，无需先发 SetReport。
    // 注意：若先发 send_feature_report 会被固件当成 SetReport，收满全 0 后写 Flash 清零！
    println!("{} [read_keymap] 已打开设备，直接 GetReport 0x01 回读整条键位", log_prefix());
    // report id = 0x01（与固件 KEYMAP_REPORT_ID 一致），buffer = 481 字节（1 report id + 480 数据）
    let mut buf = [0u8; KEYMAP_LEN + 1];
    buf[0] = KEYMAP_REPORT_ID;
    // 一次 GetReport 即可拿全 481 字节（含 report id），hidapi 内部处理控制传输多包
    let n = dev.get_feature_report(&mut buf).map_err(|e| e.to_string())?;
    println!("{} [read_keymap] 回读成功，实际字节数={}（含 report id）", log_prefix(), n);
    // get_feature_report 返回的 n 包含 report id 字节（通常为 481）
    let data = if n > 1 { buf[1..n].to_vec() } else { Vec::new() };
    println!("{} [read_keymap] 键位数据长度={} 字节", log_prefix(), data.len());
    // 同步真相源（方案 A）
    if data.len() >= KEYMAP_LEN {
        *state.poll.keymap.lock().unwrap() = data[..KEYMAP_LEN].to_vec();
        println!("{} [read_keymap] 已同步真相源（{} 字节）", log_prefix(), KEYMAP_LEN);
    } else {
        println!("{} [read_keymap] 警告：回读长度 {} < {}，未同步真相源", log_prefix(), data.len(), KEYMAP_LEN);
    }
    Ok(data)
}

// 写入特征报告 0x01: 键位数据 (落盘 Flash)
#[tauri::command]
fn write_keymap(state: State<AppState>, data: Vec<u8>) -> Result<(), String> {
    println!("{} [write_keymap] 开始写入设备，入参长度={} 字节", log_prefix(), data.len());
    let api = HidApi::new().map_err(|e| e.to_string())?;
    let dev = open_first(&api, &state)?;
    println!("{} [write_keymap] 已打开设备，准备发送 feature report 0x01", log_prefix());
    let mut buf = [0u8; KEYMAP_LEN + 1];
    buf[0] = KEYMAP_REPORT_ID; // 0x01
    let len = data.len().min(KEYMAP_LEN);
    buf[1..1 + len].copy_from_slice(&data[..len]);
    dev.send_feature_report(&buf).map_err(|e| e.to_string())?;
    println!("{} [write_keymap] 已发送 feature report，实际写入 {} 字节", log_prefix(), len);
    // 同步真相源（方案 A）
    *state.poll.keymap.lock().unwrap() = data[..len].to_vec();
    println!("{} [write_keymap] 已同步真相源（{} 字节）", log_prefix(), len);
    Ok(())
}

// 把前端编辑后的键位写入真相源（不落盘，落盘由 write_keymap 负责）
#[tauri::command]
fn set_keymap(state: State<AppState>, data: Vec<u8>) -> Result<(), String> {
    let mut km = state.poll.keymap.lock().unwrap();
    if data.len() >= KEYMAP_LEN {
        *km = data[..KEYMAP_LEN].to_vec();
    } else {
        // 长度不足则补零
        let mut padded = data.clone();
        padded.resize(KEYMAP_LEN, 0);
        *km = padded;
    }
    Ok(())
}

// 返回真相源当前 480 字节，供前端渲染
#[tauri::command]
fn get_keymap(state: State<AppState>) -> Result<Vec<u8>, String> {
    let km = state.poll.keymap.lock().unwrap();
    Ok(km.clone())
}

// 抽取场景下发内部实现，供命令与轮询线程复用
fn send_scene_impl(scene_id: u8) -> Result<(), String> {
    let api = HidApi::new().map_err(|e| e.to_string())?;
    let dev = api
        .open(VID, PID)
        .map_err(|e| format!("打开设备失败: {}", e))?;
    // 协议（与固件 CompositeKM.C OUT 端点 3 解析 + VendorRepDesc 一致）：
    // [0]=ReportID(0x02) [1]=SCENE_CMD_MAGIC(0x5C) [2]=场景ID [3..8]=0
    let mut buf = [0u8; 8]; // 1 ReportID + 8 字节载荷（Report Count=8）
    buf[0] = 0x02;     // Report ID（与 VendorRepDesc 0x85,0x02 一致）
    buf[1] = 0x5C;     // SCENE_CMD_MAGIC（固件校验 Ep3Buffer[1]）
    buf[2] = scene_id; // 场景 ID（固件读 Ep3Buffer[2]）
    dev.write(&buf).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn send_scene(scene_id: u8, state: State<AppState>) -> Result<(), String> {
    let r = send_scene_impl(scene_id);
    if r.is_ok() {
        *state.poll.last_scene.lock().unwrap() = scene_id as i32;
    }
    r
}

// X11 前台应用检测（纯 Rust 实现）
fn active_app_impl() -> Result<ActiveApp, String> {
    use x11rb::connection::Connection;
    use x11rb::protocol::xproto::ConnectionExt;
    use x11rb::xcb_ffi::XCBConnection;

    let (conn, _) = XCBConnection::connect(None).map_err(|e| format!("X11 connect: {}", e))?;
    let setup = conn.setup();
    let root = setup.roots[0].root;

    use x11rb::protocol::xproto::AtomEnum;

    // 获取真正的"前台/激活窗口"（_NET_ACTIVE_WINDOW 指向当前聚焦的顶层窗口，
    // 而非 _NET_CLIENT_LIST 的最后一个客户窗口，后者顺序由 WM 决定、不等于前台窗口）
    let net_active = intern_atom(&conn, b"_NET_ACTIVE_WINDOW")?;
    let reply = conn
        .get_property(false, root, net_active, AtomEnum::ANY, 0, 32)
        .map_err(|e| e.to_string())?
        .reply()
        .map_err(|e| e.to_string())?;
    let windows: Vec<u32> = reply
        .value
        .chunks_exact(4)
        .map(|c| u32::from_ne_bytes([c[0], c[1], c[2], c[3]]))
        .collect();
    let active = *windows.first().unwrap_or(&0);

    if active == 0 {
        return Err("no active window".into());
    }

    // name = WM_CLASS 实例名（第一个字符串）。WM_CLASS 形如 "instance\0class\0"。
    let wm_class = intern_atom(&conn, b"WM_CLASS")?;
    let wm_class_reply = conn
        .get_property(false, active, wm_class, x11rb::protocol::xproto::AtomEnum::STRING, 0, 1024)
        .map_err(|e| e.to_string())?
        .reply()
        .map_err(|e| e.to_string())?;
    let app_name = {
        let raw = String::from_utf8_lossy(&wm_class_reply.value);
        let parts: Vec<&str> = raw.split('\0').collect();
        // 第一个非空段为 instance，第二个为 class
        parts
            .iter()
            .find(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_default()
    };

    // title = 窗口标题：优先 _NET_WM_NAME，回退 WM_NAME
    let net_wm_name = intern_atom(&conn, b"_NET_WM_NAME")?;
    let utf8 = intern_atom(&conn, b"UTF8_STRING")?;
    let name_reply = conn
        .get_property(false, active, net_wm_name, utf8, 0, 1024)
        .map_err(|e| e.to_string())?
        .reply()
        .map_err(|e| e.to_string())?;
    let title = if name_reply.value_len > 0 {
        String::from_utf8_lossy(&name_reply.value).to_string()
    } else {
        let wm_name = conn
            .get_property(false, active, x11rb::protocol::xproto::AtomEnum::WM_NAME, x11rb::protocol::xproto::AtomEnum::STRING, 0, 1024)
            .map_err(|e| e.to_string())?
            .reply()
            .map_err(|e| e.to_string())?;
        String::from_utf8_lossy(&wm_name.value).to_string()
    };

    // pid = 真实窗口 PID（_NET_WM_PID，CARDINAL，4 字节）
    let net_wm_pid = intern_atom(&conn, b"_NET_WM_PID")?;
    let pid_reply = conn
        .get_property(false, active, net_wm_pid, x11rb::protocol::xproto::AtomEnum::CARDINAL, 0, 4)
        .map_err(|e| e.to_string())?
        .reply()
        .map_err(|e| e.to_string())?;
    let pid = if pid_reply.value.len() >= 4 {
        u32::from_ne_bytes([
            pid_reply.value[0],
            pid_reply.value[1],
            pid_reply.value[2],
            pid_reply.value[3],
        ])
    } else {
        0
    };

    let self_pid = std::process::id();
    Ok(ActiveApp {
        app_name,
        title,
        pid,
        self_pid,
    })
}

fn intern_atom<C: x11rb::connection::Connection>(
    conn: &C,
    name: &[u8],
) -> Result<x11rb::protocol::xproto::Atom, String> {
    use x11rb::protocol::xproto::ConnectionExt;
    let reply = conn
        .intern_atom(false, name)
        .map_err(|e| e.to_string())?
        .reply()
        .map_err(|e| e.to_string())?;
    Ok(reply.atom)
}

#[tauri::command]
fn active_app(state: State<AppState>) -> Result<ActiveApp, String> {
    let app = active_app_impl()?;
    let mut last = state.last_active_app.lock().unwrap();
    if *last != app.app_name {
        println!(
            "{} 当前激活应用: name={} pid={} title=\"{}\"",
            log_prefix(),
            app.app_name,
            app.pid,
            app.title
        );
        *last = app.app_name.clone();
    }
    Ok(app)
}

// 从真相源 480 字节中匹配前台 app 名到场景槽
// 每个槽前 16 字节为应用名（遇 \0 截断，按 ; 拆别名，小写化）
// 返回命中槽号（1..SCENE_MAX），未命中返回 0
fn match_app_to_scene(keymap: &[u8], app_name: &str) -> i32 {
    // 真相源长度不足一个完整槽时无法匹配
    if keymap.len() < KEYMAP_LEN {
        return 0;
    }
    // 前台 app 名统一小写，匹配忽略大小写
    let app_lower = app_name.to_lowercase();
    // 空名直接判未命中
    if app_lower.is_empty() {
        return 0;
    }
    let slot_size = SCENE_MAP_SIZE; // 80：每槽 = 16 应用名 + 32 主层 + 32 Fn 层
    // 槽 0 为主层（不用于匹配），从 1..SCENE_MAX 遍历各场景槽
    for scene in 1..SCENE_MAX {
        // 各场景槽在真相源中的起始偏移
        let base = scene * slot_size;
        // 槽前 SCENE_NAME_LEN(16) 字节为该槽配置的应用名区域
        let name_bytes = &keymap[base..base + SCENE_NAME_LEN];
        // 解析为 UTF-8 失败则该槽不可读，跳过
        let name = match std::str::from_utf8(name_bytes) {
            Ok(s) => s,
            Err(_) => continue,
        };
        // 应用名以 \0 结尾截断，取首个字符串并去首尾空白
        let name = name.split('\0').next().unwrap_or("").trim();
        // 空名（未配置）的槽跳过
        if name.is_empty() {
            continue;
        }
        // 同一槽可配多个别名，用 ; 分隔，逐个匹配
        for alias in name.split(';') {
            // 别名统一小写、去空白；空别名跳过
            let alias = alias.trim().to_lowercase();
            if alias.is_empty() {
                continue;
            }
            // 精确相等，或前台应用名包含别名（子串匹配）即视为命中
            if app_lower == alias || app_lower.contains(&alias) {
                return scene as i32;
            }
        }
    }
    0
}

// 轮询线程：每 1s 检测前台应用，匹配到场景且变化才下发
fn poll_loop(shared: std::sync::Arc<PollShared>) {
    loop {
        if !shared.running.load(Ordering::SeqCst) {
            break;
        }
        thread::sleep(Duration::from_secs(1));
        if !shared.running.load(Ordering::SeqCst) {
            break;
        }
        let app = match active_app_impl() {
            Ok(a) => a,
            Err(e) => {
                println!("{} [auto_poll] active_app failed: {}", log_prefix(), e);
                continue;
            }
        };
        // 激活应用（name）变化时打印一行，避免每秒刷屏
        let mut last_app = shared.last_app.lock().unwrap();
        if *last_app != app.app_name {
            println!(
                "{} 当前激活应用: name={} pid={} title=\"{}\"",
                log_prefix(),
                app.app_name,
                app.pid,
                app.title
            );
            *last_app = app.app_name.clone();
        }
        let km = shared.keymap.lock().unwrap().clone();
        // 0 = 未匹配 → 切回 generic(槽0)；命中 → 下发对应场景号
        let scene = match_app_to_scene(&km, &app.app_name);
        let mut last = shared.last_scene.lock().unwrap();
        if scene != *last {
            // 变化才发（去重）：命中下发场景号，未命中下发 0(generic)，避免每秒重复下发刷屏
            let _ = send_scene_impl(scene as u8);
            println!(
                "{} [auto_poll] app={} -> scene={} ({})",
                log_prefix(),
                app.app_name,
                scene,
                if scene == 0 { "generic" } else { "matched" }
            );
            *last = scene;
        }
    }
}

#[tauri::command]
fn start_auto_poll(state: State<AppState>) -> Result<(), String> {
    let mut handle = state.auto_poll.lock().unwrap();
    if handle.is_some() {
        return Ok(()); // 已在运行
    }
    state.poll.running.store(true, Ordering::SeqCst);
    let sh = std::sync::Arc::clone(&state.poll);
    let h = thread::spawn(move || poll_loop(sh));
    *handle = Some(h);
    println!("{} [auto_poll] started", log_prefix());
    Ok(())
}

#[tauri::command]
fn stop_auto_poll(state: State<AppState>) -> Result<(), String> {
    let mut handle = state.auto_poll.lock().unwrap();
    if handle.is_none() {
        return Ok(());
    }
    state.poll.running.store(false, Ordering::SeqCst);
    if let Some(h) = handle.take() {
        let _ = h.join();
    }
    println!("{} [auto_poll] stopped", log_prefix());
    Ok(())
}

// 返回当前前台应用 + 已匹配场景，供前端"当前应用"栏展示
#[tauri::command]
fn get_poll_status(state: State<AppState>) -> Result<PollStatus, String> {
    let app = match active_app_impl() {
        Ok(a) => a,
        Err(e) => {
            // 检测失败也要记录，便于排查 X11 / Wayland / 权限问题
            println!("{} [get_poll_status] active_app failed: {}", log_prefix(), e);
            return Err(e);
        }
    };
    let km = state.poll.keymap.lock().unwrap().clone();
    let matched_scene = match_app_to_scene(&km, &app.app_name);
    Ok(PollStatus {
        app_name: app.app_name,
        title: app.title,
        pid: app.pid,
        matched_scene,
    })
}

fn open_first(api: &HidApi, _state: &State<AppState>) -> Result<HidDevice, String> {
    let dev = api
        .open(VID, PID)
        .map_err(|e| format!("未找到 XS16 设备 (VID:PID = {:04x}:{:04x}): {}", VID, PID, e))?;
    Ok(dev)
}

// 日志统一前缀：[时间戳]
fn log_prefix() -> String {
    format!(
        "[{}]",
        chrono::Local::now().format("%y%m%d %H:%M:%S%.3f")
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            list_devices,
            open_device,
            close_device,
            read_keymap,
            write_keymap,
            set_keymap,
            get_keymap,
            send_scene,
            active_app,
            start_auto_poll,
            stop_auto_poll,
            get_poll_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
