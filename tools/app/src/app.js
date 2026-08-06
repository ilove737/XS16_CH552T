// app.js
// XS16_CH552T Tauri 桌面版主逻辑：设备连接 + 4×4 网格 + 编辑弹窗 + 按键捕获 + 文件导入导出。
import * as km from './keymap.js';
import * as ipc from './ipc-hid.js';
import { KeyCapture } from './capture.js';
import { getCurrentWindow } from '@tauri-apps/api/window';

const ROWS = 4;
const COLS = 4;

// 6 个场景预设主题色（槽 0~5）：匹配到快捷键的键帽用场景色做背景
const SCENE_COLORS = [
  '#3d9bd9', // 槽0 蓝
  '#d9567a', // 槽1 玫红
  '#8e7cc3', // 槽2 紫
  '#5fa86a', // 槽3 绿
  '#d98a3d', // 槽4 橙
  '#7f8c9b', // 槽5 灰蓝
];

// 系统全局热键（任何场景匹配到都算）用 deepin 蓝标识，不跟随场景色
const SYSKEY_COLOR = '#2980b9';        // 外框深蓝
const SYSKEY_COLOR_LIGHT = '#3498db';  // 顶面主蓝（与白混合）

// ---- 全局状态 ----
// 注意：业务逻辑（设备通信 / X11 检测 / 场景匹配 / 自动轮询 / 下发）全在后端。
// 前端 state 仅持有「展示所需」的本地副本（data 用于网格渲染），以及 UI 交互状态。
const state = {
  devices: [],                 // DeviceInfo[] (来自 Rust 后端)
  currentDevice: null,         // DeviceInfo | null
  scene: 0,                    // 当前编辑的场景槽（0~5），选中态
  activeScene: -1,             // 外部激活高亮槽（仅展示，不选中），-1 表示无
  data: km.makeDefaultKeymap(),// 当前显示/编辑的 480 字节（渲染用本地副本）
  editIdx: -1,
  editLayer: 0,                // 当前编辑的层（0=主层, 1=Fn 层），由 openEdit 设置
};
let capture = null;

// ---- DOM 工具 ----
const $ = (id) => document.getElementById(id);
function setStatus(msg) { $('statusbar').textContent = msg; }

function keyNameOf(code) {
  for (const [n, v] of Object.entries(km.KEY_NAMES)) if (v === code) return n;
  return '';
}

// ---- 初始化 ----
function init() {
  buildModCheckboxes();
  buildKeynameDatalist();
  buildSceneList();
  initDeepinTabs();
  bindEvents();
  // 启动后端自动轮询（X11 检测 + 场景匹配 + 下发，全部在 Rust 线程中完成）
  ipc.startAutoPoll().catch((e) => console.warn('启动自动轮询失败:', e));
  // 跟踪当前激活场景：轻量轮询后端 get_poll_status 仅做高亮，不下发
  setInterval(syncActiveScene, 1000);
  // 当前仅支持单设备：启动自动枚举并选中第一台
  setTimeout(() => autoConnect(), 100);
}

// 跟踪当前激活场景：读取 X11 前台应用匹配到的场景槽并高亮（仅绿色原点展示，不选中/不切换网格）
async function syncActiveScene() {
  try {
    const st = await ipc.getPollStatus();
    // 锁屏 / 无前台窗口时 app_name 为空，属正常状态，不更新场景与状态文本
    if (!st.app_name) return;
    const s = st.matched_scene | 0;
    if (s >= 0 && s < km.SCENE_MAX) {
      if (s !== state.activeScene) {
        state.activeScene = s;
        highlightScene();
      }
      setStatus(`当前激活场景：场景${s}（${sceneLabel(s)}）`);
    }
  } catch (e) {
    // 后端无 X11 等情况静默
  }
}

/** 当前场景槽的显示名（优先应用名，否则 "槽N"） */
function sceneLabel(scene) {
  const name = km.unpackAppName(state.data, scene);
  return name || (scene === 0 ? '主层' : `场景${scene}`);
}

/** 动态构建右侧场景列表（每项来自各槽前 16 字节应用名），点击切换编辑槽 */
function buildSceneList() {
  const ul = $('sceneList');
  ul.innerHTML = '';
  for (let s = 0; s < km.SCENE_MAX; s++) {
    const li = document.createElement('li');
    li.className = 'scene-item';
    li.dataset.scene = String(s);
    li.style.setProperty('--scene-color', SCENE_COLORS[s] || '#ccc');

    const idx = document.createElement('span');
    idx.className = 'scene-idx';
    idx.textContent = String(s);

    const info = document.createElement('span');
    info.className = 'scene-info';

    // 场景名可编辑：输入框直接绑定该槽前 16 字节应用名
    const nameInput = document.createElement('input');
    nameInput.className = 'scene-name-input';
    nameInput.value = km.unpackAppName(state.data, s);
    nameInput.placeholder = `槽${s} · 未命名`;
    nameInput.title = '编辑该场景应用名（支持 ; 分隔多个别名），点击「下发当前场景」时一并写入 Flash';
    nameInput.spellcheck = false;
    // 阻止点击输入框时冒泡触发 li 的场景切换
    nameInput.addEventListener('pointerdown', (e) => e.stopPropagation());
    nameInput.addEventListener('change', () => {
      km.packAppName(state.data, s, nameInput.value.trim());
      ipc.setKeymap(new Uint8Array(state.data)).catch((e) =>
        console.warn('同步键位到后端失败:', e));
      nameInput.value = km.unpackAppName(state.data, s);
      setStatus(`场景槽 ${s} 应用名已更新为「${nameInput.value || '(空)'}」`);
    });

    const layers = document.createElement('span');
    layers.className = 'scene-layers';
    layers.textContent = '主层 / Fn 层';

    info.append(nameInput, layers);
    li.append(idx, info);
    li.addEventListener('click', () => {
      state.scene = s;
      renderGrids();
      highlightScene();
      setStatus(`切换到场景槽 ${state.scene}（${sceneLabel(state.scene)}）`);
    });
    ul.append(li);
  }
  highlightScene();
}

/** 根据各槽应用名刷新场景列表的显示文本（读取设备后调用） */
function refreshSceneList() {
  const ul = $('sceneList');
  for (let s = 0; s < km.SCENE_MAX; s++) {
    const li = ul.querySelector(`.scene-item[data-scene="${s}"]`);
    if (!li) continue;
    const input = li.querySelector('.scene-name-input');
    if (input) input.value = km.unpackAppName(state.data, s);
  }
}

/** 高亮场景项：state.scene 为选中项（影响网格），state.activeScene 为外部激活项（仅绿色原点） */
function highlightScene() {
  document.querySelectorAll('.scene-item').forEach((li) => {
    const s = parseInt(li.dataset.scene, 10);
    li.classList.toggle('active', s === state.scene);            // 选中态
    li.classList.toggle('active-poll', s === state.activeScene); // 外部激活高亮（不选中）
  });
}

function buildModCheckboxes() {
  const grid = $('modGrid');
  grid.innerHTML = '';
  for (const [name, val] of km.MOD_LIST) {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'mod_' + name;
    cb.value = val;
    label.append(cb, document.createTextNode(name));
    grid.append(label);
  }
}

function buildKeynameDatalist() {
  const dl = $('keynamelist');
  dl.innerHTML = '';
  for (const name of Object.keys(km.KEY_NAMES)) {
    const opt = document.createElement('option');
    opt.value = name;
    dl.append(opt);
  }
  for (const name of Object.keys(km.MOUSE_NAMES)) {
    const opt = document.createElement('option');
    opt.value = name;
    dl.append(opt);
  }
}

// ---- 设备连接 / 枚举（当前仅支持单台 XS16）----

function hasDevice(dev) {
  return state.devices.some((d) => d.path === dev.path);
}

/** 启动自动枚举并选中第一台设备（替代原「连接键盘 / 刷新」按钮） */
async function autoConnect() {
  try {
    setStatus('正在枚举设备…');
    const devs = await ipc.listDevices();
    let ok = 0, fail = 0;
    for (const dev of devs) {
      if (hasDevice(dev)) { ok++; continue; }
      try {
        await ipc.openDevice(dev.path);
        state.devices.push(dev);
        ok++;
      } catch (e) {
        fail++;
        console.warn('打开设备失败:', dev, e);
      }
    }
    // 移除已拔出的设备
    state.devices = state.devices.filter((d) =>
      devs.some((n) => n.path === d.path)
    );
    updateConnBadge();
    // 当前仅支持单设备：自动选中第一个设备
    if (state.devices.length > 0 && !state.currentDevice) {
      await selectDevice(state.devices[0]);
    }
    if (state.devices.length === 0) {
      renderGrids();
      setStatus('未检测到 XS16 键盘，请确认 USB 已连接');
    } else if (fail) {
      setStatus(`已枚举 ${ok} 个键盘，但 ${fail} 个打开失败`);
    } else {
      setStatus(`已枚举 ${ok} 个键盘`);
    }
  } catch (e) {
    setStatus('枚举失败: ' + e.message);
  }
}

function updateConnBadge() {
  const badge = $('connStatus');
  if (state.devices.length > 0) {
    badge.textContent = `已连接 ${state.devices.length}`;
    badge.className = 'status-badge on';
  } else {
    badge.textContent = '未连接';
    badge.className = 'status-badge off';
  }
}

// ---- 选择设备（当前仅支持单设备）----

async function selectDevice(dev) {
  const prevDev = state.currentDevice;
  state.currentDevice = dev;

  setStatus(`正在读取 ${ipc.deviceLabel(dev)}...`);
  try {
    const data = await ipc.readKeymap();
    console.log(`[读取设备] ${ipc.deviceLabel(dev)} 读取到 ${data.length} 字节：`, data);
    state.data = new Uint8Array(data);
    afterLoad();
    setStatus(`已读取 ${ipc.deviceLabel(dev)}`);
  } catch (e) {
    state.currentDevice = prevDev;
    afterLoad();
    setStatus('读取失败: ' + e.message + '（保持上一键盘显示）');
  }
}

function afterLoad() {
  refreshSceneList();
  highlightScene();
  renderGrids();
}

// ---- 网格渲染 ----

function keyDisplay(mod, key, friendly, matchedSource) {
  if (friendly) {
    return { text: friendly.name, cls: matchedSource === 'system' ? 'key-name key-sys' : 'key-name' };
  }
  if (mod === 0xff && key === 0x00) return { text: 'Fn', cls: 'key-fn' };
  if (km.isMouseAction(mod)) {
    const name = km.mouseShortName(key);
    return { text: '🖱' + (name ? '\n' + name : ''), cls: 'key-mouse' };
  }
  if ((mod & (0x02 | 0x20)) && key in km.SHIFTED_CHARS) {
    return { text: km.SHIFTED_CHARS[key], cls: 'key-mod' };
  }
  if (key in km.SHIFTED_CHARS) {
    return { text: km.SHIFTED_CHARS[key] + '\n' + (km.shortName(key) || ''), cls: 'key-normal' };
  }
  const prefix = km.modPrefix(mod);
  const name = km.shortName(key);
  let text;
  if (prefix) text = name ? prefix + '\n' + name : prefix;
  else text = name || '--';
  let cls = 'key-normal';
  if (mod !== 0) cls = 'key-mod';
  else if (key === 0) cls = 'key-none';
  return { text, cls };
}

function renderGrids() {
  renderOne($('gridMain'), 0);
  renderOne($('gridFn'), 1);
}

function renderOne(grid, layer) {
  grid.innerHTML = '';
  grid.style.setProperty('--scene-color', SCENE_COLORS[state.scene] || '#ccc');
  grid.style.setProperty('--syskey-color', SYSKEY_COLOR);
  grid.style.setProperty('--syskey-color-light', SYSKEY_COLOR_LIGHT);
  const appName = km.unpackAppName(state.data, state.scene);
  const isTerminal = appName === 'deepin-terminal';
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const idx = row * COLS + col;
      const [mod, key] = km.getKeyAt(state.data, state.scene, layer, idx);
      // 先匹配当前场景专属表（仅 deepin-terminal），未命中再兜底系统全局热键
      let friendly = isTerminal ? km.lookupFriendlyName(mod, key, 'deepin-terminal') : null;
      let matchedSource = friendly ? 'app' : null;
      if (!friendly) {
        friendly = km.lookupFriendlyName(mod, key, 'system');
        if (friendly) matchedSource = 'system';
      }
      const btn = document.createElement('button');
      btn.className = 'key-btn';
      const disp = keyDisplay(mod, key, friendly, matchedSource);
      btn.classList.add(...disp.cls.split(' '));
      btn.textContent = disp.text;
      btn.title = friendly
        ? `${friendly.name}（${km.comboString(mod, key, friendly)}）`
        : km.comboString(mod, key, null);
      btn.onclick = () => openEdit(idx, layer);
      grid.append(btn);
    }
  }
}

// ---- 编辑弹窗 ----

function switchEditMode(mode) {
  const isMouse = mode === 'mouse';
  const isDeepin = mode === 'deepin';
  $('mouseFieldset').hidden = !isMouse;
  $('modFieldset').hidden = true;
  $('keycodeFieldset').hidden = true;
  $('kbd104Container').hidden = isMouse || isDeepin;
  $('modalHint').hidden = isMouse || isDeepin;
  $('deepinFieldset').hidden = !isDeepin;
  if (isDeepin) {
    // 根据当前编辑场景的应用名，自动索引到「系统快捷键 / 终端快捷键」
    const appName = km.unpackAppName(state.data, state.scene);
    const src = appName === 'deepin-terminal' ? 'terminal' : 'system';
    document.querySelectorAll('.deepin-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.source === src));
    buildDeepinList(src);
  }
  if ((isMouse || isDeepin) && capture) { capture.stop(); capture = null; }
}

function openEdit(idx, layer) {
  state.editIdx = idx;
  state.editLayer = layer;
  const [mod, key] = km.getKeyAt(state.data, state.scene, layer, idx);
  const layerName = layer ? 'Fn层' : '主层';
  $('modalTitle').textContent =
    `编辑键位 ${idx} (槽${state.scene}·${sceneLabel(state.scene)} ${layerName}, 行${Math.floor(idx / COLS)} 列${idx % COLS})`;

  const isMouse = km.isMouseAction(mod);
  // 若该键命中 deepin 系统/终端快捷键表，则自动进入 Deepin 编辑模式
  const appName = km.unpackAppName(state.data, state.scene);
  const deepinSource = appName === 'deepin-terminal' ? 'deepin-terminal' : 'system';
  const hitDeepin = !isMouse && km.lookupFriendlyName(mod, key, deepinSource);
  const openMode = isMouse ? 'mouse' : (hitDeepin ? 'deepin' : 'keyboard');
  document.querySelector('input[name="editMode"][value="' + openMode + '"]').checked = true;
  switchEditMode(openMode);

  if (isMouse) {
    document.querySelectorAll('.mouse-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.code) === key);
    });
  } else {
    for (const [name] of km.MOD_LIST) {
      $('mod_' + name).checked = !!(mod & km.MOD[name]);
    }
    $('hexInput').value = '0x' + key.toString(16).padStart(2, '0');
    $('nameInput').value = keyNameOf(key);
    if (!capture) {
      capture = new KeyCapture();
      capture.start();
    }
  }

  $('modal').hidden = false;
  renderKeyboard104(key);
}

function closeEdit() {
  $('modal').hidden = true;
  if (capture) { capture.stop(); capture = null; }
}

// ---- deepin 快捷键快速选择 ----
function buildDeepinList(source) {
  const root = $('deepinList');
  root.innerHTML = '';
  const data = source === 'terminal' ? km.DEEPIN_TERMINAL_SHORTCUTS : km.DEEPIN_SHORTCUTS;
  for (const group of data) {
    const cat = document.createElement('div');
    cat.className = 'deepin-cat';
    const title = document.createElement('div');
    title.className = 'deepin-cat-title';
    title.textContent = group.category;
    cat.appendChild(title);

    const items = document.createElement('div');
    items.className = 'deepin-items';
    for (const it of group.items) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'deepin-item';
      row.dataset.mod = it.mod;
      row.dataset.key = it.key;
      const name = document.createElement('span');
      name.className = 'deepin-name';
      name.textContent = it.name;
      const combo = document.createElement('span');
      combo.className = 'deepin-combo';
      combo.textContent = it.label;
      row.append(name, combo);
      row.addEventListener('click', () => {
        document.querySelectorAll('.deepin-item.selected').forEach(el => el.classList.remove('selected'));
        row.classList.add('selected');
        applyModToCheckboxes(it.mod);
        $('hexInput').value = '0x' + (it.key & 0xff).toString(16).padStart(2, '0');
        $('nameInput').value = keyNameOf(it.key);
        renderKeyboard104(it.key & 0xff);
        setStatus(`已选择 deepin 快捷键：${it.name}（${it.label}），点击「确定」写入。`);
      });
      items.appendChild(row);
    }
    cat.appendChild(items);
    root.appendChild(cat);
  }
}

// deepin 系统 / 终端 子标签切换
function initDeepinTabs() {
  document.querySelectorAll('.deepin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.deepin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      buildDeepinList(tab.dataset.source);
    });
  });
}

// ---- 104 键盘图渲染 ----

function renderKeyboard104(selectedCode) {
  const container = $('kbd104Container');
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'kbd104-grid';

  const modMap = {
    0xe0: 'LCTRL', 0xe1: 'LSHIFT', 0xe2: 'LALT', 0xe3: 'LMETA',
    0xe4: 'RCTRL', 0xe5: 'RSHIFT', 0xe6: 'RALT', 0xe7: 'RMETA',
  };
  const isMod = (code) => (code >= 0xe0 && code <= 0xe7);

  let maxCol = 0;
  for (const row of km.KEYBOARD_104) {
    for (const item of row) {
      const col = item[0], span = item[1];
      const end = col + span;
      if (end > maxCol) maxCol = end;
    }
  }
  const colW = 32;
  grid.style.position = 'relative';
  grid.style.width = (maxCol * colW + 8) + 'px';
  grid.style.height = (6 * 36) + 'px';

  km.KEYBOARD_104.forEach((row, ri) => {
    const rowTop = ri * 36;
    for (const item of row) {
      const [col, span, code, label, h = 1] = item;
      const cap = document.createElement('div');
      cap.className = 'kbd104-cap';
      cap.style.position = 'absolute';
      cap.style.left = (col * colW) + 'px';
      cap.style.top = rowTop + 'px';
      cap.style.width = (span * colW) + 'px';
      cap.style.height = (36 * h) + 'px';

      const isActive = (code === selectedCode) ||
        (isMod(code) && $('mod_' + modMap[code]).checked);
      if (isActive) cap.classList.add('active');

      cap.title = '0x' + code.toString(16).padStart(2, '0');

      const border = document.createElement('div');
      border.className = 'kbd104-border';
      const top = document.createElement('div');
      top.className = 'kbd104-top';
      const lbl = document.createElement('div');
      lbl.className = 'kbd104-lbl';
      lbl.textContent = label;

      cap.append(border, top, lbl);
      cap.onclick = () => {
        if (isMod(code)) {
          const cb = $('mod_' + modMap[code]);
          cb.checked = !cb.checked;
          renderKeyboard104(selectedCode);
        } else {
          if (code === selectedCode) {
            $('hexInput').value = '0x00';
            $('nameInput').value = '';
            renderKeyboard104(-1);
          } else {
            $('hexInput').value = '0x' + code.toString(16).padStart(2, '0');
            $('nameInput').value = keyNameOf(code);
            renderKeyboard104(code);
          }
        }
      };
      grid.append(cap);
    }
  });
  container.append(grid);
}

function collectMod() {
  if (document.querySelector('input[name="editMode"]:checked').value === 'mouse')
    return 0xFE;
  let mod = 0;
  for (const [name, val] of km.MOD_LIST) {
    if ($('mod_' + name).checked) mod |= val;
  }
  return mod & 0xff;
}

function collectKey() {
  if (document.querySelector('input[name="editMode"]:checked').value === 'mouse') {
    const active = document.querySelector('.mouse-btn.active');
    return active ? parseInt(active.dataset.code, 0) & 0xff : 1;
  }
  const name = $('nameInput').value.trim().toUpperCase();
  if (name) {
    const k = km.parseKey(name);
    if (k !== null) return k & 0xff;
  }
  const hex = $('hexInput').value.trim();
  try { return parseInt(hex, 0) & 0xff; } catch { return 0; }
}

function onOk() {
  const mod = collectMod();
  const key = collectKey();
  const layer = state.editLayer;
  km.setKeyAt(state.data, state.scene, layer, state.editIdx, mod, key);
  ipc.setKeymap(new Uint8Array(state.data)).catch((e) =>
    console.warn('同步键位到后端失败:', e));
  closeEdit();
  renderGrids();
  setStatus(`已修改键位 槽${state.scene}·${layer ? 'Fn' : '主'}·${state.editIdx}: mod=0x${mod.toString(16).padStart(2, '0')} key=0x${key.toString(16).padStart(2, '0')}`);
}

function applyModToCheckboxes(mod) {
  for (const [name, val] of km.MOD_LIST) {
    $('mod_' + name).checked = !!(mod & val);
  }
}

// ---- 按键捕获 ----

document.addEventListener('keydown', (e) => {
  if (!capture || !capture.capturing) return;
  if (e.key === 'Escape') return;
  const r = capture.handle(e);
  if (!r) return;
  if (r.type === 'modifier') {
    applyModToCheckboxes(r.mod);
    renderKeyboard104(parseInt($('hexInput').value, 0) || -1);
  } else if (r.type === 'key') {
    applyModToCheckboxes(r.mod);
    $('hexInput').value = '0x' + r.key.toString(16).padStart(2, '0');
    $('nameInput').value = keyNameOf(r.key);
    renderKeyboard104(r.key);
  }
});

// ---- 设备读写 / 默认 ----

async function onWrite() {
  if (!state.currentDevice) { setStatus('请先连接并选择键盘'); return; }
  setStatus('正在写入设备...');
  try {
    await ipc.writeKeymap(new Uint8Array(state.data));
    setStatus('写入成功');
  } catch (e) {
    setStatus('写入失败: ' + e.message);
  }
}

async function onRead() {
  if (!state.currentDevice) { setStatus('请先连接并选择键盘'); return; }
  await selectDevice(state.currentDevice);
}

function onDefault() {
  state.data = km.makeDefaultKeymap();
  ipc.setKeymap(new Uint8Array(state.data)).catch((e) =>
    console.warn('同步键位到后端失败:', e));
  afterLoad();
  setStatus('已恢复默认键位映射');
}

// ---- 应用场景切换 ----
// 说明：自动下发场景的逻辑（X11 检测 + 场景匹配 + 下发）已全部移至后端
// （src-tauri/src/lib.rs 的 poll_loop 线程）。前端仅负责展示当前应用与匹配结果，
// 不再手动下发、不再调用 onSendScene。

// ---- 文件导入导出 ----

function onImport() { $('fileInput').click(); }

$('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      let data;
      if (file.name.toLowerCase().endsWith('.bin')) {
        const buf = new Uint8Array(reader.result);
        if (buf.length !== km.KEYMAP_SIZE) throw new Error(`文件大小错误: ${buf.length}B`);
        data = buf;
      } else {
        data = km.readKeymapText(reader.result);
      }
      state.data = data;
      ipc.setKeymap(new Uint8Array(data)).catch((e) =>
        console.warn('同步键位到后端失败:', e));
      afterLoad();
      setStatus(`已导入: ${file.name}`);
    } catch (err) {
      setStatus('导入失败: ' + err.message);
    }
  };
  if (file.name.toLowerCase().endsWith('.bin')) reader.readAsArrayBuffer(file);
  else reader.readAsText(file);
  e.target.value = '';
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportFilename(ext) {
  const now = new Date();
  const ts = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  return `keymap_XS16_${ts}.${ext}`;
}

function exportTxt() {
  if (!state.currentDevice) { alert('请先连接键盘后再导出。'); return; }
  const text = km.formatKeymapText(state.data);
  const name = exportFilename('txt');
  downloadBlob(new Blob([text], { type: 'text/plain' }), name);
  setStatus('已导出 ' + name);
}

function exportBin() {
  if (!state.currentDevice) { alert('请先连接键盘后再导出。'); return; }
  const name = exportFilename('bin');
  downloadBlob(new Blob([state.data], { type: 'application/octet-stream' }), name);
  setStatus('已导出 ' + name);
}

// ---- 事件绑定 ----

function bindEvents() {
  $('btnRead').onclick = onRead;
  $('btnWrite').onclick = onWrite;
  $('btnDefault').onclick = onDefault;
  $('btnImport').onclick = onImport;
  $('btnExportTxt').onclick = exportTxt;
  $('btnExportBin').onclick = exportBin;
  $('btnCancel').onclick = closeEdit;
  $('btnOk').onclick = onOk;

  // 编辑模式切换
  document.querySelectorAll('input[name="editMode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) switchEditMode(radio.value);
    });
  });

  // 鼠标动作平铺按钮
  document.querySelectorAll('.mouse-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mouse-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('modal').hidden) closeEdit();
  });

  // 关闭窗口 → 后端隐藏到系统托盘（不退出）。首次关闭时给一次性提示。
  const win = getCurrentWindow();
  win.onCloseRequested(() => {
    if (!localStorage.getItem('xs16_tray_hinted')) {
      localStorage.setItem('xs16_tray_hinted', '1');
      setStatus('已最小化到系统托盘，右键托盘图标可退出');
    }
  });
}

init();