use hidapi::{HidApi, HidDevice};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

const VID: u16 = 0x4C58;
const PID: u16 = 0x5310;
const REPORT_ID: u8 = 0x01;
const KEYMAP_SIZE: usize = 64;

// =========================================================================
// 数据结构
// =========================================================================

#[derive(Serialize, Clone, Debug)]
pub struct DeviceInfo {
    /// 设备路径（唯一标识，用于 open/close/read/write）
    pub path: String,
    /// 序列号
    pub serial_number: String,
    /// 产品名称（恒为 "CH552"）
    pub product_name: String,
    /// 制造商字符串
    pub manufacturer: String,
    /// USB Usage Page
    pub usage_page: u16,
    /// USB Usage
    pub usage: u16,
    /// 接口编号（同一物理设备可能有多个接口）
    pub interface_number: i32,
}

/// 应用状态：按设备路径管理已打开的 HID 设备句柄
pub struct AppState {
    pub devices: Mutex<HashMap<String, HidDevice>>,
}

// =========================================================================
// Tauri IPC 命令
// =========================================================================

/// 枚举所有已连接的 XS16 键盘（VID=0x4C58, PID=0x5310）
/// CH552 固件有 2 个 HID 接口：键盘(IF0) + 鼠标(IF1)。
/// 厂商 Feature Report（键位读写）嵌入在键盘接口的 HID Report Descriptor 内，
/// 没有独立的 0xFF00 接口。因此只保留键盘接口（usage=0x06），过滤掉鼠标接口。
#[tauri::command]
fn list_devices() -> Result<Vec<DeviceInfo>, String> {
    let api = HidApi::new().map_err(|e| format!("HID API 初始化失败: {}", e))?;

    let mut devices: Vec<DeviceInfo> = api
        .device_list()
        .filter(|d| d.vendor_id() == VID && d.product_id() == PID)
        .map(|d| DeviceInfo {
            path: d.path().to_string_lossy().to_string(),
            serial_number: d.serial_number().unwrap_or("").to_string(),
            product_name: d.product_string().unwrap_or("").to_string(),
            manufacturer: d.manufacturer_string().unwrap_or("").to_string(),
            usage_page: d.usage_page(),
            usage: d.usage(),
            interface_number: d.interface_number(),
        })
        .collect();

    // 只保留键盘接口（usage=0x06），过滤掉鼠标接口（usage=0x02）。
    // 键位 Feature Report 在键盘接口的 HID 描述符内，不占用独立接口。
    // 若无键盘接口（罕见情况），回退返回全部。
    let kbd: Vec<DeviceInfo> = devices
        .iter()
        .filter(|d| d.usage == 0x06)
        .cloned()
        .collect();
    if !kbd.is_empty() {
        devices = kbd;
    }

    Ok(devices)
}

/// 打开设备（按路径），为后续读写做准备
#[tauri::command]
fn open_device(state: State<AppState>, path: String) -> Result<(), String> {
    let mut devices = state.devices.lock().map_err(|e| e.to_string())?;

    if devices.contains_key(&path) {
        return Ok(()); // 已经打开，无需重复操作
    }

    let api = HidApi::new().map_err(|e| format!("HID API 初始化失败: {}", e))?;
    let cpath = std::ffi::CString::new(path.as_str())
        .map_err(|_| "设备路径包含空字节，无法打开".to_string())?;
    let device = api
        .open_path(&cpath)
        .map_err(|e| format!("打开设备失败: {}", e))?;

    devices.insert(path, device);
    Ok(())
}

/// 关闭设备（按路径）
#[tauri::command]
fn close_device(state: State<AppState>, path: String) -> Result<(), String> {
    let mut devices = state.devices.lock().map_err(|e| e.to_string())?;
    devices.remove(&path);
    Ok(())
}

/// 读取键位映射（Feature Report）
/// 返回 64 字节的 Uint8Array（连续数组，不含 Report ID）
#[tauri::command]
fn read_keymap(state: State<AppState>, path: String) -> Result<Vec<u8>, String> {
    let devices = state.devices.lock().map_err(|e| e.to_string())?;
    let device = devices
        .get(&path)
        .ok_or_else(|| "设备未打开，请先连接".to_string())?;

    let mut buf = vec![0u8; KEYMAP_SIZE + 1];
    buf[0] = REPORT_ID; // 首字节为 Report ID

    let len = device
        .get_feature_report(&mut buf)
        .map_err(|e| format!("读取 Feature Report 失败: {}", e))?;

    if len < 1 {
        return Err("设备未返回数据".to_string());
    }

    // 返回去掉 Report ID 的 64 字节数据
    let start = 1usize;
    let end = (KEYMAP_SIZE + 1).min(buf.len());
    Ok(buf[start..end].to_vec())
}

/// 写入键位映射（Feature Report）
/// data: 64 字节的键位数据（不含 Report ID）
#[tauri::command]
fn write_keymap(state: State<AppState>, path: String, data: Vec<u8>) -> Result<(), String> {
    if data.len() != KEYMAP_SIZE {
        return Err(format!(
            "数据长度错误: {} 字节, 期望 {} 字节",
            data.len(),
            KEYMAP_SIZE
        ));
    }

    let devices = state.devices.lock().map_err(|e| e.to_string())?;
    let device = devices
        .get(&path)
        .ok_or_else(|| "设备未打开，请先连接".to_string())?;

    // 构造带 Report ID 的缓冲区
    let mut buf = vec![REPORT_ID; KEYMAP_SIZE + 1];
    buf[1..].copy_from_slice(&data);

    device
        .send_feature_report(&buf)
        .map_err(|e| format!("写入 Feature Report 失败: {}", e))?;

    Ok(())
}

// =========================================================================
// 应用入口
// =========================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            devices: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            list_devices,
            open_device,
            close_device,
            read_keymap,
            write_keymap,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用失败");
}