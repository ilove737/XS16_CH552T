// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Linux 下强制 CPU 渲染 WebView。NVIDIA 专有驱动即使 /dev/dri/renderD128
    // 可 open，实际 GBM 操作仍可能因权限不足失败导致白屏。此工具无需 GPU 加速。
    #[cfg(target_os = "linux")]
    std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");

    xs16_keymap_tauri::run();
}