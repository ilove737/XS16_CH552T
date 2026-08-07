// keymap.js
// XS16_CH552T 键位映射核心逻辑（移植自 tools/set_keymap.py）
// 纯前端版本：键码表、修饰符、解析/格式化、默认布局、显示辅助。

// USB HID 设备标识与键位数据布局
export const VID = 0x4C58;
export const PID = 0x5310;
export const REPORT_ID = 0x01;     // 厂商 Feature Report ID
export const KEYMAP_SIZE = 64;     // mainKeyMap(32) + Fn0_keyMap(32)
export const KEY_ENTRIES = 16;     // 每层 16 键
export const LAYER_SIZE = 32;      // 每层 32 字节（16 键 * 2）

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

// 默认键位（main + Fn0），返回 Uint8Array(64)
// 与固件 src/keyMap.h 布局保持一致（含鼠标动作键位）
export function makeDefaultKeymap() {
  const main = [
    [0, 0x29], [0, 0x1e], [0, 0x1f], [0, 0x20],
    [0, 0x2b], [0, 0x14], [0, 0x1a], [0, 0x08],
    [0, 0x39], [0, 0x04], [0, 0x16], [0, 0x07],
    [0xff, 0x00], [0, 0x1d], [0, 0x1b], [0, 0x06],
  ];
  const fn0 = [
    [0, 0x29], [0, 0x3a], [0, 0x3b], [0, 0x3c],
    [0, 0x2b], [0, 0x44], [0, 0x45], [0, 0x08],
    [0, 0x39], [0xfe, 1], [0xfe, 4], [0xfe, 2],
    [0xff, 0x00], [0xfe, 6], [0xfe, 5], [0xfe, 7],
  ];
  const raw = new Uint8Array(KEYMAP_SIZE);
  let off = 0;
  for (const [m, k] of main.concat(fn0)) {
    raw[off++] = m & 0xff;
    raw[off++] = k & 0xff;
  }
  return raw;
}

// 解析文本映射文件 → Uint8Array(64)。格式: 索引 修饰符 键码 [# 注释]
// 索引 0-15 为 mainKeyMap，16-31 为 Fn0_keyMap。
export function readKeymapText(text) {
  const entries = {};
  const lines = text.split(/\r?\n/);
  lines.forEach((line, lineno) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split('#')[0].trim().split(/\s+/);
    if (parts.length < 3) {
      throw new Error(`格式错误 行 ${lineno + 1}: 需要 "索引 修饰符 键码"`);
    }
    const idx = parseInt(parts[0], 0);
    if (isNaN(idx) || idx < 0 || idx >= KEY_ENTRIES * 2) {
      throw new Error(`索引越界 行 ${lineno + 1}: ${parts[0]}`);
    }
    const mod = parseMod(parts[1]);
    if (mod === null) throw new Error(`修饰符格式错误 行 ${lineno + 1}: ${parts[1]}`);
    const key = parseKey(parts[2]);
    if (key === null) throw new Error(`键码格式错误 行 ${lineno + 1}: ${parts[2]}`);
    entries[idx] = [mod & 0xff, key & 0xff];
  });
  const raw = new Uint8Array(KEYMAP_SIZE);
  for (let i = 0; i < KEY_ENTRIES * 2; i++) {
    const [m, k] = entries[i] || [0, 0];
    raw[i * 2] = m;
    raw[i * 2 + 1] = k;
  }
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

// 生成文本映射文件（矩阵排布格式 + 可导入旧格式）
export function formatKeymapText(data) {
  const main = data.slice(0, LAYER_SIZE);
  const fn0 = data.slice(LAYER_SIZE);
  let out = '';
  out += '# XS16_CH552T 键位映射配置文件\n\n';
  out += '# 修饰符: 0=无, 1=LCTRL, 2=LSHIFT, 4=LALT, 8=LMETA, 0x10=RCTRL, 0x20=RSHIFT, 0x40=RALT, 0x80=RMETA\n';
  out += '# 0xFE修饰符 = 鼠标动作, 0xFF修饰符+0x00键码 = Fn切换键\n\n';

  for (const [layerName, layerData] of [['mainKeyMap', main], ['Fn0_keyMap', fn0]]) {
    out += `# ===== ${layerName} =====\n`;
    for (let row = 0; row < 4; row++) {
      const cells = [];
      for (let col = 0; col < 4; col++) {
        const idx = row * 4 + col;
        const m = layerData[idx * 2];
        const k = layerData[idx * 2 + 1];
        cells.push(formatKeyCell(m, k).padEnd(12, ' '));
      }
      out += `# 行${row}:  ${cells.join('')}\n`;
    }
    out += '\n';
  }

  // 旧格式（可导入）
  out += '# ===== 可导入格式（索引 修饰符 键码） =====\n';
  out += '# ===== mainKeyMap =====\n';
  for (let i = 0; i < KEY_ENTRIES; i++) {
    const m = main[i * 2];
    const k = main[i * 2 + 1];
    out += `${String(i).padStart(2, ' ')}    0x${m.toString(16).padStart(2, '0')}   0x${k.toString(16).padStart(2, '0')}  # ${modName(m)}, ${m === 0xfe ? (MOUSE_LABELS[k] || '?') : (shortName(k) || keycodeName(k))}\n`;
  }
  out += '\n# ===== Fn0_keyMap =====\n';
  for (let i = 0; i < KEY_ENTRIES; i++) {
    const m = fn0[i * 2];
    const k = fn0[i * 2 + 1];
    out += `${String(i + KEY_ENTRIES).padStart(2, ' ')}    0x${m.toString(16).padStart(2, '0')}   0x${k.toString(16).padStart(2, '0')}  # ${modName(m)}, ${m === 0xfe ? (MOUSE_LABELS[k] || '?') : (shortName(k) || keycodeName(k))}\n`;
  }
  return out;
}



// 层 → 该层 80 字节视图
export function getLayerData(data, layer) {
  const off = layer * LAYER_SIZE;
  return data.slice(off, off + LAYER_SIZE);
}

export function setLayerData(data, layer, layerData) {
  const off = layer * LAYER_SIZE;
  data.set(layerData.subarray(0, LAYER_SIZE), off);
}

export function getKey(data, layer, idx) {
  const off = layer * LAYER_SIZE + idx * 2;
  return [data[off], data[off + 1]];
}

export function setKey(data, layer, idx, mod, key) {
  const off = layer * LAYER_SIZE + idx * 2;
  data[off] = mod & 0xff;
  data[off + 1] = key & 0xff;
}

// =========================================================================
// 标准 ANSI 104 键键盘布局（基于 keyboard-layout-editor 的 ANSI 104 预设）
// 每个键位: [col, span, keycode, 显示名, 行高]
//   col   = 起始列（累积 x 坐标，0-indexed）
//   span  = 占据列数
//   keycode = HID 键码
//   显示名  = 键面文字
//   行高   = 可选，默认 1（KLE 的 h 参数，如小键盘 + 和 Enter 为 2）
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
    [18.5, 1, 0x5f, '7\nHome'], [19.5, 1, 0x60, '8\n↑'], [20.5, 1, 0x61, '9\nPgUp'],
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
    [18.5, 1, 0x59, '1\nEnd'], [19.5, 1, 0x5a, '2\n↓'], [20.5, 1, 0x5b, '3\nPgDn'],
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
