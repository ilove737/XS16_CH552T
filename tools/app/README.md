# XS16_CH552T 键位映射编辑器 — Tauri 桌面版

在 `tools/web/` 网页版基础上，改用 **Tauri v2** + **Rust hidapi** 实现的原生桌面工具。
无需浏览器，无需 WebHID，直接通过 HID Feature Report 读写键盘固件键位映射。

## 项目结构

```
app/
├── src/                          # 前端源码（Vanilla JS + esbuild 打包）
│   ├── index.html                # 主界面
│   ├── styles.css                # 样式
│   ├── app.js                    # 主逻辑
│   ├── ipc-hid.js                # HID IPC 桥接层（调用 Rust 后端）
│   ├── keymap.js                 # 键码表、解析逻辑（与 web 版共享）
│   └── capture.js                # 按键捕获（与 web 版共享）
├── dist/                         # 构建输出（esbuild 打包产物）
├── src-tauri/                    # Rust 后端
│   ├── src/lib.rs                # 5 个 IPC 命令
│   ├── src/main.rs               # 入口
│   ├── Cargo.toml                # 依赖：tauri 2 + hidapi 2
│   ├── tauri.conf.json           # 窗口配置
│   └── capabilities/default.json # 权限
├── package.json
└── README.md
```

## 前置依赖

| 工具 | 版本要求 | 备注 |
|---|---|---|
| Rust | ≥ 1.70 | `rustc --version` |
| Node.js | ≥ 18 | `node --version` |
| npm | 随 Node.js | `npm --version` |

### Linux 系统库

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libsoup-3.0-dev
```

若之前装过旧版 `libwebkit2gtk-4.0-dev`，Tauri v2 需要 4.1 版本。

## 构建 & 运行

```bash
cd tools/app

# 安装前端依赖
npm install

# 开发模式运行
npm run tauri-dev

# 或分步执行：
# npm run build          # 构建前端 bundle
# cargo tauri dev         # 启动开发模式

# 生产打包
cargo tauri build        # 输出到 src-tauri/target/release/bundle/
```

## 跨平台

| 平台 | HID 后端 | 注意事项 |
|---|---|---|
| Linux | hidapi → hidraw | 需要 udev 规则，见下方 |
| macOS | hidapi → IOHIDManager | 无需额外驱动 |
| Windows | hidapi → 原生 HID | 无需 libusb |

### Linux udev 规则

读写键盘键位映射需要访问 `/dev/hidraw*` 设备节点：

```bash
echo 'SUBSYSTEM=="hidraw", ATTRS{idVendor}=="4c58", ATTRS{idProduct}=="5310", MODE="0666"' \
  | sudo tee /etc/udev/rules.d/99-xs16-keyboard.rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

## 常见问题

### 窗口白屏，日志中出现 KMS/DRM 权限错误

```
KMS: DRM_IOCTL_MODE_CREATE_DUMB failed: 权限不够
Failed to create GBM buffer of size 1100x760: 权限不够
```

**原因**：当前用户不在 `render` 组，无法访问 GPU 渲染节点。

**临时绕过**：
```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 cargo tauri dev
```

**永久解决**：
```bash
sudo usermod -a -G render $USER
```
然后注销重新登录，或重启。

### 窗口白屏，日志中出现 GLib-GObject-CRITICAL

```
GLib-GObject-CRITICAL: g_value_set_boxed: assertion 'G_VALUE_HOLDS_BOXED (value)' failed
```

通常是 GPU 渲染失败的级联错误。先解决上面的 GPU 权限问题。

### 编译时找不到 hidapi

```bash
# Linux
sudo apt-get install -y libhidapi-dev

# macOS
brew install hidapi

# Windows（MSYS2）
pacman -S mingw-w64-x86_64-hidapi
```

Rust 的 hidapi crate 会自动链接系统库，缺少时会编译失败。

## 技术栈

| 层 | 技术 |
|---|---|
| 窗口/打包 | Tauri v2 |
| 前端 | HTML + CSS + Vanilla JS（esbuild 打包） |
| HID 通信 | Rust hidapi 2.x |
| IPC 桥接 | `@tauri-apps/api` invoke |

### Rust 后端 IPC 命令

| 命令 | 参数 | 说明 |
|---|---|---|
| `list_devices` | 无 | 枚举 VID=0x4C58, PID=0x5310 的设备 |
| `open_device` | path | 按路径打开设备 |
| `close_device` | path | 关闭设备 |
| `read_keymap` | path | 读取 64 字节键位映射 |
| `write_keymap` | path, data | 写入 64 字节键位映射 |

## 与 web 版的区别

| 对比项 | web 版 (NW.js) | Tauri 版 |
|---|---|---|
| 运行时 | ~150MB (NW.js) | ~5MB (Tauri) |
| HID 方式 | 浏览器 WebHID | Rust hidapi |
| 前端代码 | 全部 | 复用 keymap.js / capture.js |
| 设备枚举 | 系统弹窗授权 | 直接调用 hidapi |
| 跨平台 | 三平台 | 三平台 |