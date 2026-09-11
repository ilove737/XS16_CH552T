// Tauri IPC 封装：前端只负责调用后端命令，业务逻辑（设备通信 / X11 检测 /
// 场景匹配 / 自动轮询 / 下发）全部在后端 src-tauri/src/lib.rs 完成。
import { invoke } from '@tauri-apps/api/core';

export async function listDevices() {
  return await invoke('list_devices');
}

export async function openDevice(path) {
  return await invoke('open_device', { path });
}

export async function closeDevice(path) {
  return await invoke('close_device', { path });
}

// 安装 udev 规则，使当前用户无需 root 权限即可访问 XS16 键盘
export async function installUdevRule() {
  return await invoke('install_udev_rule');
}

export async function readKeymap() {
  return await invoke('read_keymap');
}

export async function writeKeymap(data) {
  return await invoke('write_keymap', { data });
}

// 把前端编辑后的键位同步给后端真相源（不落盘，落盘由 writeKeymap 负责）
export async function setKeymap(data) {
  return await invoke('set_keymap', { data });
}

// 获取后端真相源当前 480 字节，供前端渲染
export async function getKeymap() {
  return await invoke('get_keymap');
}

export async function sendScene(sceneId) {
  return await invoke('send_scene', { sceneId });
}

export async function activeApp() {
  return await invoke('active_app');
}

// 获取所有打开的窗口列表，供前端场景名下拉选择
export async function listWindows() {
  return await invoke('list_windows');
}

// 启动后端自动轮询（X11 检测 + 场景匹配 + 下发）
export async function startAutoPoll() {
  return await invoke('start_auto_poll');
}

// 停止后端自动轮询
export async function stopAutoPoll() {
  return await invoke('stop_auto_poll');
}

// 获取当前前台应用与已匹配场景，供前端"当前应用"栏展示（纯展示，不下发）
export async function getPollStatus() {
  return await invoke('get_poll_status');
}

// 纯展示辅助：把设备信息转成可读标签（不调用后端）
export function deviceLabel(dev) {
  return dev.product || dev.path || '键盘';
}
