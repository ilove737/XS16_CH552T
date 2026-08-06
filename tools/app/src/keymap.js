// keymap.js
// XS16_CH552T 键位映射核心逻辑（移植自 tools/set_keymap.py）
// 纯前端版本：键码表、修饰符、解析/格式化、默认布局、显示辅助。
//
// 键位映射布局（与固件 src/keyMap.h 的 sceneMapTable 保持一致）：
//   总共 SCENE_MAX(6) 个场景槽，每槽 80 字节：
//     [0..15]  应用名称（ASCII，不足补 0，最多 15 字符）
//     [16..47] 主层键位（16 键 × 2）
//     [48..79] 该场景专属 Fn 层键位（16 键 × 2）
//   KEYMAP_SIZE = 6 × 80 = 480 字节。

// USB HID 设备标识与键位数据布局
export const VID = 0x4C58;
export const PID = 0x5310;
export const REPORT_ID = 0x01;     // 厂商 Feature Report ID
export const SCENE_MAX = 6;        // 场景槽位总数（编号 0~5）
export const NAME_SIZE = 16;       // 每槽应用名区长度（字节）
export const KEY_BYTES = 32;       // 每层键位长度（16 键 × 2）
export const SCENE_MAP_SIZE = 80;  // 每槽总长度 = NAME_SIZE + KEY_BYTES*2
export const KEYMAP_SIZE = SCENE_MAX * SCENE_MAP_SIZE; // 480
export const KEY_ENTRIES = 16;     // 每层 16 键
export const LAYER_SIZE = KEY_BYTES; // 每层 32 字节（16 键 * 2）
export const MAP_MAIN_OFF = NAME_SIZE;           // 16：主层键位起始
export const MAP_FN_OFF = NAME_SIZE + KEY_BYTES; // 48：Fn 层键位起始

// =========================================================================
// USB HID 键码表（Usage ID）
// =========================================================================
export const KEY_NAMES = {
  NONE: 0x00, ERR_OVF: 0x01,
  A: 0x04, B: 0x05, C: 0x06, D: 0x07, E: 0x08, F: 0x09,
  G: 0x0a, H: 0x0b, I: 0x0c, J: 0x0d, K: 0x0e, L: 0x0f,
  M: 0x10, N: 0x11, O: 0x12, P: 0x13, Q: 0x14, R: 0x15,
  S: 0x16, T: 0x17, U: 0x18, V: 0x19, W: 0x1a, X: 0x1b,
  Y: 0x1c, Z: 0x1d,
  '1': 0x1e, '2': 0x1f, '3': 0x20, '4': 0x21, '5': 0x22,
  '6': 0x23, '7': 0x24, '8': 0x25, '9': 0x26, '0': 0x27,
  ENTER: 0x28, ESC: 0x29, BACKSPACE: 0x2a, TAB: 0x2b,
  SPACE: 0x2c, MINUS: 0x2d, EQUAL: 0x2e,
  LEFTBRACE: 0x2f, RIGHTBRACE: 0x30, BACKSLASH: 0x31,
  HASHTILDE: 0x32, SEMICOLON: 0x33, APOSTROPHE: 0x34,
  GRAVE: 0x35, COMMA: 0x36, DOT: 0x37, SLASH: 0x38,
  CAPSLOCK: 0x39,
  F1: 0x3a, F2: 0x3b, F3: 0x3c, F4: 0x3d, F5: 0x3e,
  F6: 0x3f, F7: 0x40, F8: 0x41, F9: 0x42, F10: 0x43,
  F11: 0x44, F12: 0x45,
  SYSRQ: 0x46, SCROLLLOCK: 0x47, PAUSE: 0x48,
  INSERT: 0x49, HOME: 0x4a, PAGEUP: 0x4b, DELETE: 0x4c,
  END: 0x4d, PAGEDOWN: 0x4e,
  RIGHT: 0x4f, LEFT: 0x50, DOWN: 0x51, UP: 0x52,
  NUMLOCK: 0x53, KP_SLASH: 0x54, KP_ASTERISK: 0x55,
  KP_MINUS: 0x56, KP_PLUS: 0x57, KP_ENTER: 0x58,
  KP1: 0x59, KP2: 0x5a, KP3: 0x5b, KP4: 0x5c,
  KP5: 0x5d, KP6: 0x5e, KP7: 0x5f, KP8: 0x60,
  KP9: 0x61, KP0: 0x62, KP_DOT: 0x63,
  LEFTCTRL: 0xe0, LEFTSHIFT: 0xe1, LEFTALT: 0xe2,
  LEFTMETA: 0xe3, RIGHTCTRL: 0xe4, RIGHTSHIFT: 0xe5,
  RIGHTALT: 0xe6, RIGHTMETA: 0xe7,
};

// 修饰符位（单字节内的 8 个标志位）
export const MOD = {
  LCTRL: 0x01, LSHIFT: 0x02, LALT: 0x04, LMETA: 0x08,
  RCTRL: 0x10, RSHIFT: 0x20, RALT: 0x40, RMETA: 0x80,
};

// 鼠标动作码（与固件 src/scanKey.h 中的 MOUSE_* 保持一致）
// 修饰符字节 0xFE 表示该键触发鼠标动作，键码字节使用以下值
export const MOUSE_NAMES = {
  MOUSE_LCLICK: 1, MOUSE_RCLICK: 2, MOUSE_MCLICK: 3,
  MOUSE_UP: 4, MOUSE_DOWN: 5, MOUSE_LEFT: 6, MOUSE_RIGHT: 7,
  MOUSE_WHEEL_UP: 8, MOUSE_WHEEL_DN: 9,
};

// 鼠标动作短名（用于网格显示）
const MOUSE_SHORT_NAMES = {
  1: '左键', 2: '右键', 3: '中键',
  4: '↑', 5: '↓', 6: '←', 7: '→', 8: '滚↑', 9: '滚↓',
};

// 修饰符顺序（用于复选框布局）
export const MOD_LIST = [
  ['LCTRL', 0x01], ['LSHIFT', 0x02], ['LALT', 0x04], ['LMETA', 0x08],
  ['RCTRL', 0x10], ['RSHIFT', 0x20], ['RALT', 0x40], ['RMETA', 0x80],
];

// 显示用短名（移植自 GUI 的 SHORT_NAMES）
export const SHORT_NAMES = {
  NONE: '', ERR_OVF: 'OVF',
  LEFTCTRL: 'LCtrl', LEFTSHIFT: 'LShift', LEFTALT: 'LAlt', LEFTMETA: 'LWin',
  RIGHTCTRL: 'RCtrl', RIGHTSHIFT: 'RShift', RIGHTALT: 'RAlt', RIGHTMETA: 'RWin',
  ENTER: 'Enter', BACKSPACE: 'BkSpc', CAPSLOCK: 'Caps', SCROLLLOCK: 'Scrlk',
  NUMLOCK: 'NumLk', SPACE: 'Space', TAB: 'Tab', ESC: 'Esc',
  DELETE: 'Del', INSERT: 'Ins', HOME: 'Home', END: 'End',
  PAGEUP: 'PgUp', PAGEDOWN: 'PgDn', SYSRQ: 'PrtSc', PAUSE: 'Pause',
  LEFTBRACE: '[', RIGHTBRACE: ']', BACKSLASH: '\\', HASHTILDE: '#~',
  SEMICOLON: ';', APOSTROPHE: "'", GRAVE: '`', COMMA: ',', DOT: '.',
  SLASH: '/', MINUS: '-', EQUAL: '=',
  UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→',
  KP_SLASH: 'KP/', KP_ASTERISK: 'KP*', KP_MINUS: 'KP-',
  KP_PLUS: 'KP+', KP_ENTER: 'KPE', KP_DOT: 'KP.',
};

// =========================================================================
// 解析 / 格式化
// =========================================================================

// 名称或十六进制字符串 → HID 键码（数字）。非法返回 null。
export function parseKey(name) {
  if (name == null) return null;
  name = String(name).trim().toUpperCase();
  if (name.startsWith('KEY_')) name = name.slice(4);
  if (name.startsWith('0X')) return parseInt(name, 16);
  if (name in KEY_NAMES) return KEY_NAMES[name];
  if (name in MOUSE_NAMES) return MOUSE_NAMES[name];  // 鼠标动作码
  // 单个字符（如 'A'）
  if (name.length === 1 && name in KEY_NAMES) return KEY_NAMES[name];
  try {
    const v = parseInt(name, 0);
    if (!isNaN(v)) return v & 0xff;
  } catch (e) { /* ignore */ }
  return null;
}

export function parseMod(val) {
  if (val == null) return null;
  val = String(val).trim().toUpperCase();
  if (val in MOD) return MOD[val];
  if (val.startsWith('0X')) return parseInt(val, 16);
  try {
    const v = parseInt(val, 0);
    if (!isNaN(v)) return v & 0xff;
  } catch (e) { /* ignore */ }
  return null;
}

// 键码 → 名称（如 'KEY_A' 或 '0x04' 形式的 HEX）
export function keycodeName(code) {
  for (const [name, val] of Object.entries(KEY_NAMES)) {
    if (val === code) return `KEY_${name}`;
  }
  return `0x${(code & 0xff).toString(16).padStart(2, '0')}`;
}

// 修饰符位 → 显示名称
const MOD_DISPLAY = {
  0x01: 'Ctrl', 0x02: 'Shift', 0x04: 'Alt', 0x08: 'Win',
  0x10: 'Ctrl', 0x20: 'Shift', 0x40: 'Alt', 0x80: 'Win',
};

// 修饰符位 → 名称串（如 'Ctrl+Shift'，0 返回 '0'）
export function modName(mod) {
  if (mod === 0xff) return 'Fn';
  if (mod === 0xfe) return 'MOUSE';
  const parts = [];
  for (const [val, name] of Object.entries(MOD_DISPLAY)) {
    if (mod & val) parts.push(name);
  }
  return parts.length ? [...new Set(parts)].join('+') : '0';
}

// 键码 → 短名（用于网格显示）
export function shortName(code) {
  if (code === 0) return '';
  for (const [name, val] of Object.entries(KEY_NAMES)) {
    if (val === code) {
      if (name in SHORT_NAMES) return SHORT_NAMES[name];
      if (name.length <= 5) return name;
      if (name.startsWith('KP_')) return name.slice(3);
      return name.slice(0, 4);
    }
  }
  return `0x${(code & 0xff).toString(16).padStart(2, '0')}`;
}

// 修饰符位 → 前缀（每个修饰符一行，用换行分隔）
export function modPrefix(mod) {
  const parts = [];
  if (mod & 0x01) parts.push('Ctrl');
  if (mod & 0x02) parts.push('Shift');
  if (mod & 0x04) parts.push('Alt');
  if (mod & 0x08) parts.push('Win');
  if (mod & 0x10) parts.push('Ctrl');
  if (mod & 0x20) parts.push('Shift');
  if (mod & 0x40) parts.push('Alt');
  if (mod & 0x80) parts.push('Win');
  return parts.join('\n');
}

// 判断是否为鼠标动作修饰符（0xFE）
export function isMouseAction(mod) {
  return mod === 0xFE;
}

// 鼠标动作码 → 名称（如 'MOUSE_LCLICK'），找不到返回 null
export function mouseName(code) {
  for (const [name, val] of Object.entries(MOUSE_NAMES)) {
    if (val === code) return name;
  }
  return null;
}

// 鼠标动作码 → 短名（如 '左键'），找不到返回空字符串
export function mouseShortName(code) {
  return MOUSE_SHORT_NAMES[code] || '';
}

// =========================================================================
// 布局工具（场景槽 + 层）
// =========================================================================

// 读取指定场景槽的应用名（ASCII，遇 0 截断），返回字符串
export function unpackAppName(data, scene) {
  const base = scene * SCENE_MAP_SIZE;
  let s = '';
  for (let i = 0; i < NAME_SIZE; i++) {
    const c = data[base + i];
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

// 写入指定场景槽的应用名（ASCII，不足补 0，最多 NAME_SIZE-1 字符）
export function packAppName(data, scene, name) {
  const base = scene * SCENE_MAP_SIZE;
  const str = String(name == null ? '' : name).slice(0, NAME_SIZE - 1);
  for (let i = 0; i < NAME_SIZE; i++) {
    data[base + i] = i < str.length ? str.charCodeAt(i) : 0;
  }
}

// 读取键位 [mod,key]。scene=场景槽，layer=0主层/1Fn，idx=键索引(0~15)
export function getKeyAt(data, scene, layer, idx) {
  const off = scene * SCENE_MAP_SIZE + (layer ? MAP_FN_OFF : MAP_MAIN_OFF) + idx * 2;
  return [data[off], data[off + 1]];
}

export function setKeyAt(data, scene, layer, idx, mod, key) {
  const off = scene * SCENE_MAP_SIZE + (layer ? MAP_FN_OFF : MAP_MAIN_OFF) + idx * 2;
  data[off] = mod & 0xff;
  data[off + 1] = key & 0xff;
}

// 兼容旧签名：默认编辑槽 0（主层 generic）
export function getKey(data, layer, idx) {
  return getKeyAt(data, 0, layer, idx);
}

export function setKey(data, layer, idx, mod, key) {
  setKeyAt(data, 0, layer, idx, mod, key);
}

// 返回某场景槽某层的 32 字节视图
export function getLayerData(data, scene, layer) {
  const off = scene * SCENE_MAP_SIZE + (layer ? MAP_FN_OFF : MAP_MAIN_OFF);
  return data.slice(off, off + KEY_BYTES);
}

export function setLayerData(data, scene, layer, layerData) {
  const off = scene * SCENE_MAP_SIZE + (layer ? MAP_FN_OFF : MAP_MAIN_OFF);
  data.set(layerData.subarray(0, KEY_BYTES), off);
}

// =========================================================================
// 默认键位（6 槽，与固件 src/keyMap.h sceneMapTable 保持一致）
// =========================================================================

// 通用主层（deepin 系统快捷键，按 keymap_XS16 导出 槽0主层）32 字节：[mod,key]×16
const DEFAULT_MAIN = [
  [0x05, 0x50], [0x08, 0x16], [0x02, 0x2c], [0x05, 0x4f],  // Ctrl+Alt+←/Win+S/Shift+Space/Ctrl+Alt+→
  [0x04, 0x2b], [0x04, 0x35], [0x06, 0x35], [0x06, 0x2b],  // Alt+Tab/Alt+`/Shift+Alt+`/Shift+Alt+Tab
  [0x04, 0x3b], [0x08, 0x11], [0x08, 0x52], [0x08, 0x19],  // Alt+F2/Win+N/Win+↑/Win+V
  [0xff, 0x00], [0x08, 0x50], [0x08, 0x51], [0x08, 0x4f],  // Fn/Win+←/Win+↓/Win+→
];

// 槽 0 Fn 层（generic，按 keymap_XS16 导出 槽0Fn）：截图/录屏/图文识别 + 鼠标
const DEFAULT_FN_GENERIC = [
  [0x05, 0x0c], [0x05, 0x04], [0x01, 0x46], [0x00, 0x46],  // Ctrl+Alt+I/A/Ctrl+PrtSc/PrtSc
  [0x04, 0x46], [0x05, 0x06], [0x05, 0x15], [0x08, 0x08],  // Alt+PrtSc/Ctrl+Alt+C/R/Win+E
  [0x08, 0x00], [0xfe, 1], [0xfe, 4], [0xfe, 2],           // Win+空/鼠标左/上/右
  [0xff, 0x00], [0xfe, 6], [0xfe, 5], [0xfe, 7],           // Fn/鼠标左/下/右
];

// 终端主层（deepin-terminal，按 keymap_XS16 导出 槽1主层）
const DEFAULT_MAIN_TERMINAL = [
  [0x03, 0x1e], [0x03, 0x1f], [0x01, 0x2e], [0x01, 0x2d],  // Ctrl+Shift+1/2/Ctrl+=/Ctrl+-
  [0x03, 0x17], [0x03, 0x2b], [0x01, 0x2b], [0x04, 0x1a],  // Ctrl+Shift+T/Tab/Tab/Alt+W
  [0x03, 0x06], [0x03, 0x19], [0x04, 0x51], [0x04, 0x14],  // Ctrl+Shift+C/V/Alt+↓/Alt+Q
  [0xff, 0x00], [0x04, 0x50], [0x04, 0x52], [0x04, 0x4f],  // Fn/Alt+←/↑/→
];

// 槽 1 Fn 层（deepin-terminal，按 keymap_XS16 导出 槽1Fn）：分屏/查找/全选 + 鼠标
const DEFAULT_FN_TERMINAL = [
  [0x03, 0x0d], [0x03, 0x0b], [0x05, 0x09], [0x01, 0x27],  // Ctrl+Shift+J/H/Ctrl+Alt+F/Ctrl+0
  [0x03, 0x04], [0x00, 0x44], [0x03, 0x1a], [0x03, 0x14],  // Ctrl+Shift+A/F11/Ctrl+Shift+W/Q
  [0x00, 0x3b], [0xfe, 1], [0xfe, 4], [0xfe, 2],           // F2/鼠标左/上/右
  [0xff, 0x00], [0xfe, 6], [0xfe, 5], [0xfe, 7],           // Fn/鼠标左/下/右
];

// 浏览器主层（firefox）
const DEFAULT_MAIN_BROWSER = [
  [0x01, 0x17], [0x00, 0xe3], [0x05, 0x04], [0x05, 0x15],  // Ctrl+T/启动器/截图/录屏
  [0x04, 0x2b], [0x08, 0x07], [0x08, 0x08], [0x08, 0x0f],
  [0x01, 0x1a], [0x03, 0x11], [0x01, 0x15], [0x04, 0x50],  // Ctrl+W/新窗口/刷新/Alt+←
  [0xff, 0x00], [0x01, 0x0f], [0x03, 0x17], [0x01, 0x07],  // Fn/地址栏/恢复/书签
];

// 通用 Fn 层（槽 2~5 共用）32 字节：[mod,key]×16
const DEFAULT_FN = [
  [0, 0x29], [0, 0x3a], [0, 0x3b], [0, 0x3c],
  [0, 0x2b], [0, 0x44], [0, 0x45], [0, 0x08],
  [0, 0x39], [0xfe, 1], [0xfe, 4], [0xfe, 2],
  [0xff, 0x00], [0xfe, 6], [0xfe, 5], [0xfe, 7],
];

// 将 [mod,key] 数组铺平为 32 字节
function flatten(entries) {
  const a = new Uint8Array(KEY_BYTES);
  for (let i = 0; i < entries.length; i++) {
    a[i * 2] = entries[i][0] & 0xff;
    a[i * 2 + 1] = entries[i][1] & 0xff;
  }
  return a;
}

// 生成默认键位映射 Uint8Array(480)：6 槽 × 80 字节
export function makeDefaultKeymap() {
  const raw = new Uint8Array(KEYMAP_SIZE);
  const names = ['generic', 'deepin-terminal', '', '', '', ''];
  const mains = [DEFAULT_MAIN, DEFAULT_MAIN_TERMINAL, DEFAULT_MAIN_BROWSER,
                 DEFAULT_MAIN, DEFAULT_MAIN, DEFAULT_MAIN];
  const fns = [DEFAULT_FN_GENERIC, DEFAULT_FN_TERMINAL, DEFAULT_FN,
               DEFAULT_FN, DEFAULT_FN, DEFAULT_FN];
  for (let s = 0; s < SCENE_MAX; s++) {
    packAppName(raw, s, names[s]);
    raw.set(flatten(mains[s]), s * SCENE_MAP_SIZE + MAP_MAIN_OFF);
    raw.set(flatten(fns[s]), s * SCENE_MAP_SIZE + MAP_FN_OFF);
  }
  return raw;
}

// =========================================================================
// 文本映射文件读写（格式：槽.层.索引 修饰符 键码）
// 兼容旧格式：索引 修饰符 键码（索引 0-15 主层、16-31 Fn，映射到槽 0）
// =========================================================================

// 解析文本映射文件 → Uint8Array(480)
export function readKeymapText(text) {
  const raw = makeDefaultKeymap();
  const lines = text.split(/\r?\n/);
  lines.forEach((line, lineno) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split('#')[0].trim().split(/\s+/);
    if (parts.length < 3) {
      throw new Error(`格式错误 行 ${lineno + 1}: 需要 "槽.层.索引 修饰符 键码"`);
    }
    // 解析索引段：新格式 "槽.层.索引" 或旧格式纯数字（映射槽0）
    let scene = 0, layer = 0, idx = 0;
    const seg = parts[0].split('.');
    if (seg.length === 3) {
      scene = parseInt(seg[0], 10);
      layer = parseInt(seg[1], 10);
      idx = parseInt(seg[2], 10);
    } else {
      // 旧格式：0-15 主层，16-31 Fn
      const v = parseInt(parts[0], 10);
      idx = v % KEY_ENTRIES;
      layer = v >= KEY_ENTRIES ? 1 : 0;
    }
    if (scene < 0 || scene >= SCENE_MAX || (layer !== 0 && layer !== 1) ||
        idx < 0 || idx >= KEY_ENTRIES) {
      throw new Error(`索引越界 行 ${lineno + 1}: ${parts[0]}`);
    }
    const mod = parseMod(parts[1]);
    if (mod === null) throw new Error(`修饰符格式错误 行 ${lineno + 1}: ${parts[1]}`);
    const key = parseKey(parts[2]);
    if (key === null) throw new Error(`键码格式错误 行 ${lineno + 1}: ${parts[2]}`);
    setKeyAt(raw, scene, layer, idx, mod & 0xff, key & 0xff);
  });
  return raw;
}

// Shift 组合键 → 最终字符映射
export const SHIFTED_CHARS = {
  0x1e: '!', 0x1f: '@', 0x20: '#', 0x21: '$', 0x22: '%',
  0x23: '^', 0x24: '&', 0x25: '*', 0x26: '(', 0x27: ')',
  0x2d: '_', 0x2e: '+',
  0x2f: '{', 0x30: '}', 0x31: '|',
  0x33: ':', 0x34: '"',
  0x36: '<', 0x37: '>', 0x38: '?',
  0x35: '~',
};
const MOUSE_LABELS = {1:'🖱左键', 2:'🖱右键', 3:'🖱中键', 4:'🖱↑', 5:'🖱↓', 6:'🖱←', 7:'🖱→', 8:'🖱滚↑', 9:'🖱滚↓'};

function formatKeyCell(mod, key) {
  if (mod === 0xff && key === 0x00) return 'Fn0';
  if (mod === 0xfe) return MOUSE_LABELS[key] || '🖱?';
  if ((mod & (0x02 | 0x20)) && key in SHIFTED_CHARS) return SHIFTED_CHARS[key];
  const prefix = modName(mod);
  if (prefix !== '0') {
    if (key === 0) return prefix;
    const name = shortName(key) || keycodeName(key);
    return prefix + '+' + name;
  }
  return shortName(key) || keycodeName(key);
}

// 生成文本映射文件（多槽，格式：槽.层.索引 修饰符 键码）
export function formatKeymapText(data) {
  let out = '';
  out += '# XS16_CH552T 键位映射配置文件（6 槽，每槽 80B = 16 应用名 + 32 主层 + 32 Fn）\n\n';
  out += '# 修饰符: 0=无, 1=LCTRL, 2=LSHIFT, 4=LALT, 8=LMETA, 0x10=RCTRL, 0x20=RSHIFT, 0x40=RALT, 0x80=RMETA\n';
  out += '# 0xFE修饰符 = 鼠标动作, 0xFF修饰符+0x00键码 = Fn切换键\n';
  out += '# 键位行格式: 槽.层.索引 修饰符 键码  （槽0-5，层0主层/1Fn，索引0-15）\n\n';

  for (let s = 0; s < SCENE_MAX; s++) {
    const name = unpackAppName(data, s) || '(未命名)';
    out += `# ===== 槽 ${s}（应用名: ${name}） =====\n`;
    for (const layer of [0, 1]) {
      const layerName = layer ? 'Fn层' : '主层';
      out += `# --- ${layerName} ---\n`;
      for (let i = 0; i < KEY_ENTRIES; i++) {
        const [m, k] = getKeyAt(data, s, layer, i);
        out += `${s}.${layer}.${String(i).padStart(2, ' ')}    0x${m.toString(16).padStart(2, '0')}   0x${k.toString(16).padStart(2, '0')}  # ${modName(m)}, ${m === 0xfe ? (MOUSE_LABELS[k] || '?') : (shortName(k) || keycodeName(k))}\n`;
      }
      out += '\n';
    }
  }
  return out;
}

// 按 (mod,key) 查询 deepin 可读快捷键条目；source='terminal' 用终端表，否则系统表
export function lookupFriendlyName(mod, key, source) {
  const data = source === 'deepin-terminal' ? DEEPIN_TERMINAL_SHORTCUTS : DEEPIN_SHORTCUTS;
  for (const group of data) {
    for (const it of group.items) {
      if (it.mod === mod && it.key === key) return it;
    }
  }
  return null;
}

// 组合键内容串（用于鼠标悬浮）：优先用 label，否则回退拼接
export function comboString(mod, key, item) {
  if (item && item.label) return item.label;
  if (isMouseAction(mod)) return mouseShortName(key) || '鼠标';
  const prefix = modName(mod);
  const k = mod === 0xff && key === 0x00 ? 'Fn' : (shortName(key) || keycodeName(key));
  return prefix === '0' || prefix === 'Fn' ? k : `${prefix}+${k}`;
}

// =========================================================================
// 标准 ANSI 104 键键盘布局（基于 keyboard-layout-editor 的 ANSI 104 预设）
// =========================================================================
export const KEYBOARD_104 = [
  // 行 0: 功能键行
  [
    [0, 1, 0x29, 'Esc'], [2, 1, 0x3a, 'F1'], [3, 1, 0x3b, 'F2'],
    [4, 1, 0x3c, 'F3'], [5, 1, 0x3d, 'F4'],
    [6.5, 1, 0x3e, 'F5'], [7.5, 1, 0x3f, 'F6'], [8.5, 1, 0x40, 'F7'], [9.5, 1, 0x41, 'F8'],
    [11, 1, 0x42, 'F9'], [12, 1, 0x43, 'F10'], [13, 1, 0x44, 'F11'], [14, 1, 0x45, 'F12'],
    [15.25, 1, 0x46, 'PrtScn'], [16.25, 1, 0x47, 'Scroll'], [17.25, 1, 0x48, 'Pause'],
  ],
  // 行 1: 数字行 + 编辑键 + 小键盘顶行
  [
    [0, 1, 0x35, '~\n`'], [1, 1, 0x1e, '!\n1'], [2, 1, 0x1f, '@\n2'],
    [3, 1, 0x20, '#\n3'], [4, 1, 0x21, '$\n4'], [5, 1, 0x22, '%\n5'],
    [6, 1, 0x23, '^\n6'], [7, 1, 0x24, '&\n7'], [8, 1, 0x25, '*\n8'],
    [9, 1, 0x26, '(\n9'], [10, 1, 0x27, ')\n0'], [11, 1, 0x2d, '_\n-'],
    [12, 1, 0x2e, '+\n='], [13, 2, 0x2a, 'Backspace'],
    [15.25, 1, 0x49, 'Insert'], [16.25, 1, 0x4a, 'Home'], [17.25, 1, 0x4b, 'Page\nUp'],
    [18.5, 1, 0x53, 'Num\nLock'], [19.5, 1, 0x54, '/'], [20.5, 1, 0x55, '*'], [21.5, 1, 0x56, '-'],
  ],
  // 行 2: 字母行 1 + 编辑键 + 小键盘 7-9+
  [
    [0, 1.5, 0x2b, 'Tab'], [1.5, 1, 0x14, 'Q'], [2.5, 1, 0x1a, 'W'],
    [3.5, 1, 0x08, 'E'], [4.5, 1, 0x15, 'R'], [5.5, 1, 0x17, 'T'],
    [6.5, 1, 0x1c, 'Y'], [7.5, 1, 0x18, 'U'], [8.5, 1, 0x0c, 'I'],
    [9.5, 1, 0x12, 'O'], [10.5, 1, 0x13, 'P'], [11.5, 1, 0x2f, '{\n['],
    [12.5, 1, 0x30, '}\n]'], [13.5, 1.5, 0x31, '|\n\\'],
    [15.25, 1, 0x4c, 'Delete'], [16.25, 1, 0x4d, 'End'], [17.25, 1, 0x4e, 'Page\nDown'],
    [18.5, 1, 0x59, '7\nHome'], [19.5, 1, 0x5a, '8\n↑'], [20.5, 1, 0x5b, '9\nPgUp'],
    [21.5, 1, 0x57, '+', 2],
  ],
  // 行 3: 字母行 2 + 小键盘 4-6
  [
    [0, 1.75, 0x39, 'CapsLock'], [1.75, 1, 0x04, 'A'], [2.75, 1, 0x16, 'S'],
    [3.75, 1, 0x07, 'D'], [4.75, 1, 0x09, 'F'], [5.75, 1, 0x0a, 'G'],
    [6.75, 1, 0x0b, 'H'], [7.75, 1, 0x0d, 'J'], [8.75, 1, 0x0e, 'K'],
    [9.75, 1, 0x0f, 'L'], [10.75, 1, 0x33, ':\n;'], [11.75, 1, 0x34, "\"\n'"],
    [12.75, 2.25, 0x28, 'Enter'],
    [18.5, 1, 0x5c, '4\n←'], [19.5, 1, 0x5d, '5'], [20.5, 1, 0x5e, '6\n→'],
  ],
  // 行 4: 字母行 3 + 方向键 + 小键盘 1-3
  [
    [0, 2.25, 0xe1, 'Shift'], [2.25, 1, 0x1d, 'Z'], [3.25, 1, 0x1b, 'X'],
    [4.25, 1, 0x06, 'C'], [5.25, 1, 0x19, 'V'], [6.25, 1, 0x05, 'B'],
    [7.25, 1, 0x11, 'N'], [8.25, 1, 0x10, 'M'], [9.25, 1, 0x36, '<\n,'],
    [10.25, 1, 0x37, '>\n.'], [11.25, 1, 0x38, '?\n/'],
    [12.25, 2.75, 0xe5, 'Shift'],
    [16.25, 1, 0x52, '↑'],
    [18.5, 1, 0x5f, '1\nEnd'], [19.5, 1, 0x60, '2\n↓'], [20.5, 1, 0x61, '3\nPgDn'],
    [21.5, 1, 0x58, 'Enter', 2],
  ],
  // 行 5: 底行 + 方向键 + 小键盘 0.
  [
    [0, 1.25, 0xe0, 'Ctrl'], [1.25, 1.25, 0xe3, 'Win'], [2.5, 1.25, 0xe2, 'Alt'],
    [3.75, 6.25, 0x2c, 'Space'],
    [10, 1.25, 0xe6, 'Alt'], [11.25, 1.25, 0xe7, 'Win'],
    [12.5, 1.25, 0x65, 'Fn'], [13.75, 1.25, 0xe4, 'Ctrl'],
    [15.25, 1, 0x50, '←'], [16.25, 1, 0x51, '↓'], [17.25, 1, 0x4f, '→'],
    [18.5, 2, 0x62, '0\nIns'], [20.5, 1, 0x63, '.\nDel'],
  ],
];

// =========================================================================
// Deepin 系统快捷键（仅用于编辑弹窗内快速选择，不参与键盘映射逻辑）
// category: 分组名称（显示在 UI 上）
// items[].name: 快捷键说明文字
// items[].mod:  修饰符掩码（与键盘映射一致：1=LCTRL 2=LSHIFT 4=LALT 8=LMETA …）
// items[].key:  键码（HID usage），无法精确对应时填 0 仅作展示
// items[].label: 用户可见的快捷键组合说明
// =========================================================================
export const DEEPIN_SHORTCUTS = [
  {
    category: '系统',
    items: [
      { name: '终端',                  mod: 0x05, key: 0x17, label: 'Ctrl+Alt+T' },
      { name: '终端雷神模式',           mod: 0x04, key: 0x3b, label: 'Alt+F2' },
      { name: '全局搜索',              mod: 0x02, key: 0x2c, label: 'Shift+Space' },
      { name: '截图',                  mod: 0x05, key: 0x04, label: 'Ctrl+Alt+A' },
      { name: '延时截图',              mod: 0x01, key: 0x46, label: 'Ctrl+Print' },
      { name: '全屏截图',              mod: 0x00, key: 0x46, label: 'Print' },
      { name: '窗口截图',              mod: 0x04, key: 0x46, label: 'Alt+Print' },
      { name: '滚动截图',              mod: 0x05, key: 0x0c, label: 'Ctrl+Alt+I' },
      { name: '图文识别',              mod: 0x05, key: 0x06, label: 'Ctrl+Alt+C' },
      { name: '录屏',                  mod: 0x05, key: 0x15, label: 'Ctrl+Alt+R' },
      { name: '切换同类型窗口',        mod: 0x04, key: 0x35, label: 'Alt+`' },
      { name: '反向切换同类型窗口',    mod: 0x06, key: 0x35, label: 'Shift+Alt+~' },
      { name: '显示工作区',            mod: 0x08, key: 0x16, label: 'Super+S' },
      { name: '启动器',                mod: 0x08, key: 0x00, label: 'Super' },
      { name: '切换窗口',              mod: 0x04, key: 0x2b, label: 'Alt+Tab' },
      { name: '反向切换窗口',          mod: 0x06, key: 0x2b, label: 'Shift+Alt+Tab' },
      { name: '显示桌面',              mod: 0x08, key: 0x07, label: 'Super+D' },
      { name: '文件管理器',            mod: 0x08, key: 0x08, label: 'Super+E' },
      { name: '锁屏界面',              mod: 0x08, key: 0x0f, label: 'Super+L' },
      { name: '关机界面',              mod: 0x05, key: 0x4c, label: 'Ctrl+Alt+Delete' },
      { name: '切换窗口效果',          mod: 0x0a, key: 0x2b, label: 'Shift+Super+Tab' },
      { name: '系统监视器',            mod: 0x05, key: 0x29, label: 'Ctrl+Alt+Escape' },
      { name: '剪贴板',                mod: 0x08, key: 0x19, label: 'Super+V' },
      { name: '切换多屏模式',          mod: 0x08, key: 0x13, label: 'Super+P' }
    ]
  },
  {
    category: '窗口',
    items: [
      { name: '打开窗口菜单',         mod: 0x04, key: 0x2c, label: 'Alt+Space' },
      { name: '最大化窗口',           mod: 0x08, key: 0x52, label: 'Super+↑' },
      { name: '恢复窗口',             mod: 0x08, key: 0x51, label: 'Super+↓' },
      { name: '最小化窗口',           mod: 0x08, key: 0x11, label: 'Super+N' },
      { name: '移动窗口',             mod: 0x04, key: 0x40, label: 'Alt+F7' },
      { name: '改变窗口大小',         mod: 0x04, key: 0x41, label: 'Alt+F8' },
      { name: '关闭窗口',             mod: 0x04, key: 0x3d, label: 'Alt+F4' },
      { name: '窗口快速铺至左侧',     mod: 0x08, key: 0x50, label: 'Super+←' },
      { name: '窗口快速铺至右侧',     mod: 0x08, key: 0x4f, label: 'Super+→' }
    ]
  },
  {
    category: '工作空间',
    items: [
      { name: '切换到左边工作区', mod: 0x05, key: 0x50, label: 'Ctrl+Alt+←' },
      { name: '切换到右边工作区', mod: 0x05, key: 0x4f, label: 'Ctrl+Alt+→' },
      { name: '移动到左边工作区', mod: 0x07, key: 0x50, label: 'Shift+Ctrl+Alt+←' },
      { name: '移动到右边工作区', mod: 0x07, key: 0x4f, label: 'Shift+Ctrl+Alt+→' }
    ]
  },
  {
    category: '辅助工具',
    items: [
      { name: '语音朗读',     mod: 0x05, key: 0x13, label: 'Ctrl+Alt+P' },
      { name: '语音听写',     mod: 0x05, key: 0x07, label: 'Ctrl+Alt+D' },
      { name: '文本翻译',     mod: 0x05, key: 0x18, label: 'Ctrl+Alt+U' },
      { name: '屏幕放大',     mod: 0x08, key: 0x2e, label: 'Super+=' },
      { name: '屏幕缩小',     mod: 0x08, key: 0x2d, label: 'Super+-' },
      { name: '重置屏幕缩放', mod: 0x08, key: 0x27, label: 'Super+0' }
    ]
  },
  {
    category: '自定义',
    items: [
      { name: 'UOS AI',            mod: 0x08, key: 0x2c, label: 'Super+Space' },
      { name: 'UOS AI Screenshot', mod: 0x05, key: 0x14, label: 'Ctrl+Alt+Q' },
      { name: 'UOS AI Talk',       mod: 0x09, key: 0x2c, label: 'Ctrl+Super+Space' },
      { name: 'AI随航/写作',       mod: 0x08, key: 0x15, label: 'Super+R' }
    ]
  }
];

export const DEEPIN_TERMINAL_SHORTCUTS = [
  {
    category: '终端',
    items: [
      { name: '复制',        mod: 0x03, key: 0x06, label: 'Ctrl+Shift+C' },
      { name: '粘贴',        mod: 0x03, key: 0x19, label: 'Ctrl+Shift+V' },
      { name: '查找',        mod: 0x05, key: 0x09, label: 'Ctrl+Alt+F' },
      { name: '放大',        mod: 0x01, key: 0x2e, label: 'Ctrl+=' },
      { name: '缩小',        mod: 0x01, key: 0x2d, label: 'Ctrl+-' },
      { name: '默认大小',    mod: 0x01, key: 0x27, label: 'Ctrl+0' },
      { name: '全选',        mod: 0x03, key: 0x04, label: 'Ctrl+Shift+A' }
    ]
  },
  {
    category: '标签页',
    items: [
      { name: '新建标签页',     mod: 0x03, key: 0x17, label: 'Ctrl+Shift+T' },
      { name: '关闭标签页',     mod: 0x04, key: 0x1a, label: 'Alt+W' },
      { name: '关闭其他标签页', mod: 0x03, key: 0x1a, label: 'Ctrl+Shift+W' },
      { name: '上一个标签页',   mod: 0x03, key: 0x2b, label: 'Ctrl+Shift+Tab' },
      { name: '下一个标签页',   mod: 0x01, key: 0x2b, label: 'Ctrl+Tab' },
      { name: '纵向分屏',       mod: 0x03, key: 0x0d, label: 'Ctrl+Shift+J' },
      { name: '横向分屏',       mod: 0x03, key: 0x0b, label: 'Ctrl+Shift+H' },
      { name: '切换到标签 1',   mod: 0x03, key: 0x1e, label: 'Ctrl+Shift+1' },
      { name: '切换到标签 2',   mod: 0x03, key: 0x1f, label: 'Ctrl+Shift+2' },
      { name: '切换到标签 3',   mod: 0x03, key: 0x20, label: 'Ctrl+Shift+3' },
      { name: '切换到标签 4',   mod: 0x03, key: 0x21, label: 'Ctrl+Shift+4' },
      { name: '切换到标签 5',   mod: 0x03, key: 0x22, label: 'Ctrl+Shift+5' },
      { name: '切换到标签 6',   mod: 0x03, key: 0x23, label: 'Ctrl+Shift+6' },
      { name: '切换到标签 7',   mod: 0x03, key: 0x24, label: 'Ctrl+Shift+7' },
      { name: '切换到标签 8',   mod: 0x03, key: 0x25, label: 'Ctrl+Shift+8' },
      { name: '切换到标签 9',   mod: 0x03, key: 0x26, label: 'Ctrl+Shift+9' }
    ]
  },
  {
    category: '工作区',
    items: [
      { name: '选择上面的工作区', mod: 0x04, key: 0x52, label: 'Alt+Up' },
      { name: '选择下面的工作区', mod: 0x04, key: 0x51, label: 'Alt+Down' },
      { name: '选择左边的工作区', mod: 0x04, key: 0x50, label: 'Alt+Left' },
      { name: '选择右边的工作区', mod: 0x04, key: 0x4f, label: 'Alt+Right' },
      { name: '关闭工作区',       mod: 0x04, key: 0x14, label: 'Alt+Q' },
      { name: '关闭其他工作区',   mod: 0x03, key: 0x14, label: 'Ctrl+Shift+Q' }
    ]
  },
  {
    category: '其他',
    items: [
      { name: '全屏',                     mod: 0x00, key: 0x44, label: 'F11' },
      { name: '重命名标题',               mod: 0x00, key: 0x3b, label: 'F2' },
      { name: '显示快捷键',               mod: 0x03, key: 0x38, label: 'Ctrl+Shift+?' },
      { name: '自定义命令',               mod: 0x04, key: 0x49, label: 'Alt+Ins' },
      { name: '远程管理',                 mod: 0x04, key: 0x4c, label: 'Alt+Del' },
      { name: '光标焦点切换至“+”图标',    mod: 0x08, key: 0x2b, label: 'Super+Tab' }
    ]
  }
];

export const DEEPIN_FILEMANAGER_SHORTCUTS = [
  {
    category: '文件',
    items: [
      { name: '选择到第一个文件', mod: 0x02, key: 0x4a, label: 'Shift+Home' },
      { name: '选择到最后一个文件', mod: 0x02, key: 0x4d, label: 'Shift+End' },
      { name: '向前选择', mod: 0x02, key: 0x50, label: 'Shift+Left' },
      { name: '向后选择', mod: 0x02, key: 0x4f, label: 'Shift+Right' },
      { name: '向上一行选择', mod: 0x02, key: 0x52, label: 'Shift+Up' },
      { name: '向下一行选择', mod: 0x02, key: 0x51, label: 'Shift+Down' },
      { name: '反选', mod: 0x03, key: 0x0c, label: 'Ctrl+Shift+I' },
      { name: '打开', mod: 0x01, key: 0x51, label: 'Ctrl+Down' },
      { name: '打开', mod: 0x04, key: 0x51, label: 'Alt+Down' },
      { name: '返回上一级', mod: 0x01, key: 0x52, label: 'Ctrl+Up' },
      { name: '彻底删除', mod: 0x02, key: 0x4c, label: 'Shift+Delete' },
      { name: '删除文件', mod: 0x00, key: 0x4c, label: 'Delete' },
      { name: '删除文件', mod: 0x01, key: 0x07, label: 'Ctrl+D' },
      { name: '全选', mod: 0x01, key: 0x04, label: 'Ctrl+A' },
      { name: '复制', mod: 0x01, key: 0x06, label: 'Ctrl+C' },
      { name: '剪切', mod: 0x01, key: 0x1b, label: 'Ctrl+X' },
      { name: '粘贴', mod: 0x01, key: 0x19, label: 'Ctrl+V' },
      { name: '重命名', mod: 0x00, key: 0x3b, label: 'F2' },
      { name: '复制文件地址', mod: 0x03, key: 0x06, label: 'Ctrl+Shift+C' },
      { name: '在终端中打开', mod: 0x02, key: 0x17, label: 'Shift+T' },
      { name: '撤销', mod: 0x01, key: 0x1d, label: 'Ctrl+Z' },
      { name: '重做', mod: 0x01, key: 0x1c, label: 'Ctrl+Y' }
    ]
  },
  {
    category: '新建/搜索',
    items: [
      { name: '新建窗口', mod: 0x01, key: 0x11, label: 'Ctrl+N' },
      { name: '新建文件夹', mod: 0x03, key: 0x11, label: 'Ctrl+Shift+N' },
      { name: '搜索', mod: 0x01, key: 0x09, label: 'Ctrl+F' },
      { name: '新建标签', mod: 0x01, key: 0x17, label: 'Ctrl+T' }
    ]
  },
  {
    category: '视图',
    items: [
      { name: '文件信息', mod: 0x01, key: 0x0c, label: 'Ctrl+I' },
      { name: '帮助手册', mod: 0x00, key: 0x3a, label: 'F1' },
      { name: '所有快捷键', mod: 0x03, key: 0x38, label: 'Ctrl+Shift+/' }
    ]
  },
  {
    category: '切换显示状态',
    items: [
      { name: '隐藏文件', mod: 0x01, key: 0x0b, label: 'Ctrl+H' },
      { name: '地址栏输入', mod: 0x01, key: 0x0f, label: 'Ctrl+L' },
      { name: '切换到图标视图', mod: 0x01, key: 0x1e, label: 'Ctrl+1' },
      { name: '切换到列表视图', mod: 0x01, key: 0x1f, label: 'Ctrl+2' },
      { name: '切换到树形视图', mod: 0x01, key: 0x20, label: 'Ctrl+3' }
    ]
  },
  {
    category: '其他',
    items: [
      { name: '关闭', mod: 0x04, key: 0x3d, label: 'Alt+F4' },
      { name: '关闭当前标签', mod: 0x01, key: 0x1a, label: 'Ctrl+W' },
      { name: '后退', mod: 0x04, key: 0x50, label: 'Alt+Left' },
      { name: '前进', mod: 0x04, key: 0x4f, label: 'Alt+Right' },
      { name: '切换到下一个标签', mod: 0x01, key: 0x2b, label: 'Ctrl+Tab' },
      { name: '切换到上一个标签', mod: 0x03, key: 0x2b, label: 'Ctrl+Shift+Tab' },
      { name: '下一个文件', mod: 0x00, key: 0x2b, label: 'Tab' },
      { name: '上一个文件', mod: 0x02, key: 0x2b, label: 'Shift+Tab' },
      { name: '切换到标签 1', mod: 0x04, key: 0x1e, label: 'Alt+1' },
      { name: '切换到标签 2', mod: 0x04, key: 0x1f, label: 'Alt+2' },
      { name: '切换到标签 3', mod: 0x04, key: 0x20, label: 'Alt+3' },
      { name: '切换到标签 4', mod: 0x04, key: 0x21, label: 'Alt+4' },
      { name: '切换到标签 5', mod: 0x04, key: 0x22, label: 'Alt+5' },
      { name: '切换到标签 6', mod: 0x04, key: 0x23, label: 'Alt+6' },
      { name: '切换到标签 7', mod: 0x04, key: 0x24, label: 'Alt+7' },
      { name: '切换到标签 8', mod: 0x04, key: 0x25, label: 'Alt+8' }
    ]
  }
];
