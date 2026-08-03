// capture.js
// 按键捕获：KeyboardEvent.code（物理键位） → USB HID 键码。
// 替代 GTK GUI 的 gdk_to_hid（基于 GDK keyval），Web 端更可靠。
//
// 用法：
//   const cap = new KeyCapture();
//   cap.start();
//   document.addEventListener('keydown', (e) => {
//     const r = cap.handle(e);
//     // r === null            : 忽略（非捕获态或不支持的键）
//     // r.type === 'modifier' : 仅修饰键，已更新的 mod，继续等待主键
//     // r.type === 'key'      : 捕获到主键，返回 {mod, key}
//   });

// KeyboardEvent.code → USB HID Usage ID（不含 0xe0-0xe7 修饰键，见下）
const CODE_TO_HID = {
  // 字母
  KeyA: 0x04, KeyB: 0x05, KeyC: 0x06, KeyD: 0x07, KeyE: 0x08, KeyF: 0x09,
  KeyG: 0x0a, KeyH: 0x0b, KeyI: 0x0c, KeyJ: 0x0d, KeyK: 0x0e, KeyL: 0x0f,
  KeyM: 0x10, KeyN: 0x11, KeyO: 0x12, KeyP: 0x13, KeyQ: 0x14, KeyR: 0x15,
  KeyS: 0x16, KeyT: 0x17, KeyU: 0x18, KeyV: 0x19, KeyW: 0x1a, KeyX: 0x1b,
  KeyY: 0x1c, KeyZ: 0x1d,
  // 数字
  Digit1: 0x1e, Digit2: 0x1f, Digit3: 0x20, Digit4: 0x21, Digit5: 0x22,
  Digit6: 0x23, Digit7: 0x24, Digit8: 0x25, Digit9: 0x26, Digit0: 0x27,
  // 符号
  Minus: 0x2d, Equal: 0x2e, BracketLeft: 0x2f, BracketRight: 0x30,
  Backslash: 0x31, Semicolon: 0x33, Quote: 0x34, Backquote: 0x35,
  Comma: 0x36, Period: 0x37, Slash: 0x38,
  // 功能键
  F1: 0x3a, F2: 0x3b, F3: 0x3c, F4: 0x3d, F5: 0x3e, F6: 0x3f,
  F7: 0x40, F8: 0x41, F9: 0x42, F10: 0x43, F11: 0x44, F12: 0x45,
  // 编辑 / 系统键
  Insert: 0x49, Home: 0x4a, PageUp: 0x4b, Delete: 0x4c,
  End: 0x4d, PageDown: 0x4e, PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48,
  // 方向键
  ArrowRight: 0x4f, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52,
  // 小键盘
  NumLock: 0x53, NumpadDivide: 0x54, NumpadMultiply: 0x55,
  NumpadSubtract: 0x56, NumpadAdd: 0x57, NumpadEnter: 0x58,
  Numpad1: 0x59, Numpad2: 0x5a, Numpad3: 0x5b, Numpad4: 0x5c,
  Numpad5: 0x5d, Numpad6: 0x5e, Numpad7: 0x5f, Numpad8: 0x60,
  Numpad9: 0x61, Numpad0: 0x62, NumpadDecimal: 0x63,
  // 修饰键本身（映射到 HID 修饰键码 0xe0-0xe7）
  ShiftLeft: 0xe1, ShiftRight: 0xe5, ControlLeft: 0xe0, ControlRight: 0xe4,
  AltLeft: 0xe2, AltRight: 0xe6, MetaLeft: 0xe3, MetaRight: 0xe7,
  // 常用主键
  Enter: 0x28, Escape: 0x29, Backspace: 0x2a, Tab: 0x2b, Space: 0x2c,
  CapsLock: 0x39,
};

// 修饰键 HID 码 → 对应修饰符位
const MOD_BIT = {
  0xe0: 0x01, 0xe1: 0x02, 0xe2: 0x04, 0xe3: 0x08,
  0xe4: 0x10, 0xe5: 0x20, 0xe6: 0x40, 0xe7: 0x80,
};

export class KeyCapture {
  constructor() {
    this.capturing = false;
    this._mod = 0; // 捕获过程中累计的修饰符位
  }

  start() {
    this.capturing = true;
    this._mod = 0;
  }

  stop() {
    this.capturing = false;
  }

  // 处理 keydown 事件，返回结果对象或 null
  handle(event) {
    if (!this.capturing) return null;
    const hid = CODE_TO_HID[event.code];
    if (hid === undefined) return null; // 不支持的键（不阻断其它处理）

    event.preventDefault();
    event.stopPropagation();

    // 修饰状态 → USB 修饰位（左侧，无法区分左右时以左侧表示）
    let mod = 0;
    if (event.ctrlKey) mod |= 0x01;
    if (event.shiftKey) mod |= 0x02;
    if (event.altKey) mod |= 0x04;
    if (event.metaKey) mod |= 0x08;

    // 修饰键本身：合并到具体位，继续等待主键
    if (hid >= 0xe0 && hid <= 0xe7) {
      this._mod |= MOD_BIT[hid];
      return { type: 'modifier', mod: this._mod };
    }

    // 主键：合并已累计的修饰位与当前状态
    mod |= this._mod;
    return { type: 'key', mod, key: hid };
  }

  // 根据当前累计（用于显示"已捕获修饰符，继续按主键..."）
  get pendingMod() {
    return this._mod;
  }
}

export { CODE_TO_HID };
