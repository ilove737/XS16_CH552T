# XS16_CH552T

## 介绍
基于CH552T微控制器实现的XS16键盘固件项目（16键，4×4 矩阵）。这是一个USB键盘/鼠标复合设备固件，使用CH552系列微控制器实现键盘和鼠标功能。

## 项目特点
- 支持USB键盘和鼠标功能（复合设备）
- 基于CH552T微控制器
- 支持键盘扫描矩阵（4行×4列，共16键）
- 包含定时器和GPIO控制功能
- 支持数据闪存存储

## 硬件平台
- 微控制器：CH552T
- 开发板：XS16

## 编译环境设置

### Linux编译环境
本项目已经配置为可以在Linux环境下使用SDCC编译器编译：

1. 安装SDCC编译器：
   ```bash
   make install-deps
   ```

2. 编译项目：
   ```bash
   make clean
   make all
   ```

3. 编译输出：
   - 生成的文件将存放在 `build/` 目录中
   - 链接中间产物：`build/XS16_CH552T.ihx`（SDCC 链接输出）
   - 最终固件：`build/XS16_CH552T.hex`（由 `.ihx` 经 `packihx` 转换，可烧录）

## 项目结构
- `src/main.c` - 主程序入口
- `src/CompositeKM.C/CompositeKM.H` - USB键盘鼠标复合设备实现
- `src/CH552.H` - SDCC兼容的CH552头文件
- `src/Debug.C/Debug.H` - 调试和延时函数
- `src/Timer.C/Timer.H` - 定时器功能
- `src/GPIO.C/GPIO.H` - GPIO控制功能
- `src/UART1.C/UART1.H` - UART1 串口功能
- `src/scanKey.c/scanKey.h` - 键盘扫描功能
- `src/DataFlash.C/DataFlash.H` - 数据闪存功能
- `src/FlashWrite.c/FlashWrite.h` - Flash 写入功能
- `src/keyMap.h` - 键位映射定义
- `Makefile` - Linux编译脚本

## 编译说明
- 使用SDCC (Small Device C Compiler) 进行编译
- 目标微控制器：CH552T
- 可用代码区：约 14KB（Makefile 中 `--code-size 0x3800`，CH552 的 16KB Flash 需给 Bootloader 留出空间）
- 已配置为支持USB设备模式

## 输出文件
- `XS16_CH552T.hex` - 可烧录的Intel HEX格式固件
- `XS16_CH552T.ihx` - Intel HEX格式中间文件
- 各种调试文件（.asm, .lst, .map等）在 build 目录中

## 烧录方式
生成的hex文件可以通过支持CH552的编程器进行烧录，例如：
- 使用本项目自带命令（需先安装 `wchisp`）：
  ```bash
  make flash          # 等价于 wchisp flash build/XS16_CH552T.hex
  ```
  其中 `wchisp` 可通过 `cargo install wchisp` 或各平台包管理器安装。
- ISP编程器
- 相关的CH55x专用烧录工具

## 注意事项
- 项目已适配SDCC编译器，不再依赖Keil C51
- 所有CH552特定寄存器定义已转换为SDCC兼容格式
- USB功能已适配CH552 USB控制器

## 配套工具

本项目除了固件，还提供了两个键位编辑器，用于图形化编辑固件的键位映射、场景配置，并通过 USB / WebHID 与设备通信。

### 桌面端编辑器（tools/app，Tauri v2）

基于 Tauri v2 的跨平台桌面应用（前端为无框架 Vanilla JS，后端为 Rust）。

- 提供图形化键位编辑、设备读写（HID 通信）。
- 场景名支持从当前打开的应用列表中选取（下拉选择框，窗口聚焦时自动刷新）。
- Linux 下连接键盘权限不足时，可自动安装 udev 规则（需输入管理员密码）。
- 支持「按激活应用自动切换场景」功能（见下节）。
- 构建方式：
  ```bash
  # Linux 下需先安装系统依赖
  sudo apt-get install -y libdbus-1-dev libudev-dev libgtk-3-dev \
    libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev

  cd tools/app && npm install   # 安装前端依赖
  npm run build                 # 打包前端到 dist/
  make -C tools/app app         # 构建发布包
  # 或 npm run tauri-dev 进行开发调试
  ```

### Web 端编辑器（tools/web，WebHID）

基于浏览器 WebHID 的纯前端编辑器，无需安装，适合快速修改键位。

- 受浏览器沙箱限制，无法读取前台窗口，因此**不支持**「自动匹配激活应用」功能。
- 启动方式：
  ```bash
  cd tools/web && python3 -m http.server 8000
  # 浏览器打开 http://localhost:8000 （WebHID 需 localhost 或 HTTPS）
  ```

## 自动匹配激活应用（场景自动切换）

编辑器在后台轮询当前前台（激活）窗口的应用名，与固件中配置的场景槽应用名匹配，命中即自动下发对应场景，未命中则切回主层（generic）。

- 实现位置：Rust 后端 `tools/app/src-tauri/src/lib.rs`
  （`active_app_impl` 取前台应用 + `match_app_to_scene` 匹配 + `poll_loop` 轮询下发）。
- **平台支持：**
  - ✅ **Linux**：通过 X11 协议（`x11rb` / `libxcb`）读取前台窗口，功能完整可用。
  - ⚠️ **macOS / Windows**：**暂不支持**。前台窗口探测依赖各平台原生窗口系统接口
    （macOS 的 `NSWorkspace`、Windows 的 `GetForegroundWindow` 等），
    当前版本仅在 Linux 上实现，路线图见下方 TODO。

## 待办 / 路线图

### 在 macOS / Windows 实现「自动匹配激活应用」功能（方案 A：原生 FFI）

> 目标：用 Rust 直接调用各平台原生窗口接口，替代当前仅 Linux 可用的 X11 实现，
> 使桌面端编辑器的「自动切换场景」功能在三个平台上都可用。

1. **[Cargo.toml]** 新增平台专属依赖：
   - macOS：`objc` / `cocoa`（调用 `NSWorkspace.frontmostApplication` 取 `bundleIdentifier` / `localizedName`）
   - Windows：`windows` 或 `winapi`（调用 `GetForegroundWindow` / `GetWindowThreadProcessId` / `QueryFullProcessImageName`）
2. **[lib.rs]** 把 `active_app_impl` 由「仅 Linux」改为三平台各自实现：
   - Linux：现有 X11 实现（保持不变）
   - macOS：Objective-C FFI 取前台应用标识
   - Windows：Win32 API 取前台窗口进程路径，解析出 exe 名
3. **[lib.rs]** `match_app_to_scene` / `send_scene_impl` / `poll_loop` 架构完全复用，
   仅「取前台应用名」一步做成平台可插拔（共用同一套匹配/下发逻辑）。
4. **[lib.rs]** 去掉 `active_app` / `get_poll_status` / `start_auto_poll` / `stop_auto_poll`
   中 `#[cfg(not(target_os = "linux"))]` 的 Err stub，改为各平台真实实现
   （或至少 macOS/Windows 各自实现，最后兜底返回 `Err`）。
5. **[CI]** 调整 `.github/workflows/build.yml`，确保 macOS / Windows target
   链接对应平台 SDK 成功（注意 Windows 的 MSVC vs gnu target 差异）。
6. **[前端 tools/app/src/app.js]** 把"自动匹配仅 Linux"的提示文案更新为按平台动态提示。

## 许可证
本项目固件基于 WCH（CH552）官方示例代码改编开发，遵循原示例代码所附许可；新增与修改部分目前**未声明明确许可证**，如需用于分发或二次开发请先联系作者确认。

> 说明：随 Tauri 依赖引入的第三方库（如 `tools/app/src-tauri/target/` 下）分别遵循其各自的许可证（如 Apache-2.0、MIT 等），与本仓库固件代码许可无关。
