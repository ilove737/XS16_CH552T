// app.js
// XS16_CH552T Tauri 桌面版主逻辑：设备连接 + 4×4 网格 + 编辑弹窗 + 按键捕获 + 文件导入导出。
import * as km from './keymap.js';
import * as ipc from './ipc-hid.js';
import { KeyCapture } from './capture.js';

const ROWS = 4;
const COLS = 4;

// ---- 全局状态 ----
// 注意：业务逻辑（设备通信 / X11 检测 / 场景匹配 / 自动轮询 / 下发）全在后端。
// 前端 state 仅持有「展示所需」的本地副本（data 用于网格渲染），以及 UI 交互状态。
const state = {
  devices: [],                 // DeviceInfo[] (来自 Rust 后端)
  currentDevice: null,         // DeviceInfo | null
  currentLayer: 0,             // 0=主层, 1=Fn 层
  scene: 0,                    // 当前编辑的场景槽（0~5）
  data: km.makeDefaultKeymap(),// 当前显示/编辑的 480 字节（渲染用本地副本）
  editIdx: -1,
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
  bindEvents();
  // 启动后端自动轮询（X11 检测 + 场景匹配 + 下发，全部在 Rust 线程中完成）
  ipc.startAutoPoll().catch((e) => console.warn('启动自动轮询失败:', e));
  // 当前应用栏：轻量轮询后端 get_poll_status 仅做展示，不下发
  setInterval(refreshActiveAppInfo, 2000);
  setTimeout(() => onRefresh(), 100);
}

// 仅展示当前前台应用与已匹配场景（下发由后端自动完成）
async function refreshActiveAppInfo() {
  try {
    const st = await ipc.getPollStatus();
    const sceneName = st.matched_scene > 0 ? `场景${st.matched_scene}` : 'generic';
    $('activeAppInfo').textContent =
      st.app_name ? `${st.app_name} → ${sceneName}` : '—';
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
      renderGrid();
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

/** 高亮当前选中的场景项 */
function highlightScene() {
  document.querySelectorAll('.scene-item').forEach((li) => {
    li.classList.toggle('active', parseInt(li.dataset.scene, 10) === state.scene);
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

// ---- 设备连接 / 枚举 ----

async function onConnect() {
  try {
    setStatus('正在枚举设备…');
    const devs = await ipc.listDevices();
    if (!devs.length) {
      setStatus('未检测到 XS16 键盘，请确认 USB 已连接');
      return;
    }
    let ok = 0, fail = 0;
    for (const dev of devs) {
      try {
        await ipc.openDevice(dev.path);
        if (!hasDevice(dev)) state.devices.push(dev);
        ok++;
      } catch (e) {
        fail++;
        console.warn('打开设备失败:', dev, e);
      }
    }
    refreshTree();
    updateConnBadge();
    // 自动选中第一个设备的主层
    if (state.devices.length > 0 && !state.currentDevice) {
      await selectDevice(state.devices[0], 0);
    }
    if (fail) {
      setStatus(`已连接 ${ok} 个键盘，但 ${fail} 个打开失败`);
    } else if (ok) {
      setStatus(`已连接 ${ok} 个键盘`);
    } else {
      setStatus('未连接任何设备');
    }
  } catch (e) {
    setStatus('连接失败: ' + e.message);
  }
}

function hasDevice(dev) {
  return state.devices.some((d) => d.path === dev.path);
}

async function onRefresh() {
  try {
    const devs = await ipc.listDevices();
    let ok = 0, fail = 0;
    for (const d of devs) {
      if (hasDevice(d)) { ok++; continue; }
      try {
        await ipc.openDevice(d.path);
        state.devices.push(d);
        ok++;
      } catch (e) {
        fail++;
        console.warn('打开设备失败:', d, e);
      }
    }
    // 移除已拔出的设备
    state.devices = state.devices.filter((d) =>
      devs.some((n) => n.path === d.path)
    );
    refreshTree();
    updateConnBadge();
    // 自动选中第一个设备的主层
    if (state.devices.length > 0 && !state.currentDevice) {
      await selectDevice(state.devices[0], 0);
    }
    if (state.devices.length === 0) {
      renderGrid();
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

// ---- 树形（设备 → 层）----

function refreshTree() {
  const tree = $('deviceTree');
  tree.innerHTML = '';
  if (state.devices.length === 0) {
    $('sideHint').hidden = false;
    return;
  }
  $('sideHint').hidden = true;

  state.devices.forEach((dev) => {
    const devLi = document.createElement('li');
    devLi.className = 'tree-dev';
    devLi.dataset.kind = 'dev';
    devLi.textContent = ipc.deviceLabel(dev);
    devLi.onclick = () => selectDevice(dev, 0);

    const ul = document.createElement('ul');
    const li0 = document.createElement('li');
    li0.className = 'tree-layer';
    li0.textContent = '主层';
    li0.onclick = (ev) => { ev.stopPropagation(); selectDevice(dev, 0); };
    const li1 = document.createElement('li');
    li1.className = 'tree-layer';
    li1.textContent = 'Fn 层';
    li1.onclick = (ev) => { ev.stopPropagation(); selectDevice(dev, 1); };
    ul.append(li0, li1);
    devLi.append(ul);
    tree.append(devLi);
  });
  highlightCurrent();
}

function highlightCurrent() {
  document.querySelectorAll('.tree-dev').forEach((devLi, i) => {
    const dev = state.devices[i];
    const isCur = dev === state.currentDevice;
    devLi.classList.toggle('active', isCur);
    devLi.querySelectorAll('.tree-layer').forEach((li, layer) => {
      li.classList.toggle('active', isCur && layer === state.currentLayer);
    });
  });
}

// ---- 选择设备 / 层 ----

async function selectDevice(dev, layer) {
  const prevDev = state.currentDevice;
  const prevLayer = state.currentLayer;
  state.currentDevice = dev;
  state.currentLayer = layer;

  setStatus(`正在读取 ${ipc.deviceLabel(dev)}...`);
  try {
    const data = await ipc.readKeymap();
    console.log(`[读取设备] ${ipc.deviceLabel(dev)} 读取到 ${data.length} 字节：`, data);
    state.data = new Uint8Array(data);
    afterLoad();
    setStatus(`已读取 ${ipc.deviceLabel(dev)}`);
  } catch (e) {
    state.currentDevice = prevDev;
    state.currentLayer = prevLayer;
    afterLoad();
    setStatus('读取失败: ' + e.message + '（保持上一键盘显示）');
  }
  highlightCurrent();
}

function afterLoad() {
  refreshSceneList();
  highlightScene();
  renderGrid();
}

// ---- 网格渲染 ----

function keyDisplay(mod, key) {
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

function renderGrid() {
  const grid = $('grid');
  grid.innerHTML = '';
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const idx = row * COLS + col;
      const [mod, key] = km.getKeyAt(state.data, state.scene, state.currentLayer, idx);
      const btn = document.createElement('button');
      btn.className = 'key-btn';
      const disp = keyDisplay(mod, key);
      btn.classList.add(disp.cls);
      btn.textContent = disp.text;
      btn.title = `索引 ${idx} (行${row} 列${col})  修饰符 0x${mod.toString(16).padStart(2, '0')} 键码 0x${key.toString(16).padStart(2, '0')}`;
      btn.onclick = () => openEdit(idx);
      grid.append(btn);
    }
  }
}

// ---- 编辑弹窗 ----

function switchEditMode(mode) {
  const isMouse = mode === 'mouse';
  $('mouseFieldset').hidden = !isMouse;
  $('modFieldset').hidden = true;
  $('keycodeFieldset').hidden = true;
  $('kbd104Container').hidden = isMouse;
  $('modalHint').hidden = isMouse;
  if (isMouse && capture) { capture.stop(); capture = null; }
}

function openEdit(idx) {
  state.editIdx = idx;
  const [mod, key] = km.getKeyAt(state.data, state.scene, state.currentLayer, idx);
  const layerName = state.currentLayer ? 'Fn层' : '主层';
  $('modalTitle').textContent =
    `编辑键位 ${idx} (槽${state.scene}·${sceneLabel(state.scene)} ${layerName}, 行${Math.floor(idx / COLS)} 列${idx % COLS})`;

  const isMouse = km.isMouseAction(mod);
  document.querySelector('input[name="editMode"][value="' + (isMouse ? 'mouse' : 'keyboard') + '"]').checked = true;
  switchEditMode(isMouse ? 'mouse' : 'keyboard');

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
  km.setKeyAt(state.data, state.scene, state.currentLayer, state.editIdx, mod, key);
  ipc.setKeymap(new Uint8Array(state.data)).catch((e) =>
    console.warn('同步键位到后端失败:', e));
  closeEdit();
  renderGrid();
  setStatus(`已修改键位 槽${state.scene}·${state.currentLayer ? 'Fn' : '主'}·${state.editIdx}: mod=0x${mod.toString(16).padStart(2, '0')} key=0x${key.toString(16).padStart(2, '0')}`);
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
  await selectDevice(state.currentDevice, state.currentLayer);
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
  if (!state.currentDevice) { alert('请先在左侧设备树中选择需要导出的键盘。'); return; }
  const text = km.formatKeymapText(state.data);
  const name = exportFilename('txt');
  downloadBlob(new Blob([text], { type: 'text/plain' }), name);
  setStatus('已导出 ' + name);
}

function exportBin() {
  if (!state.currentDevice) { alert('请先在左侧设备树中选择需要导出的键盘。'); return; }
  const name = exportFilename('bin');
  downloadBlob(new Blob([state.data], { type: 'application/octet-stream' }), name);
  setStatus('已导出 ' + name);
}

// ---- 事件绑定 ----

function bindEvents() {
  $('btnConnect').onclick = onConnect;
  $('btnRefresh').onclick = onRefresh;
  $('btnRead').onclick = onRead;
  $('btnWrite').onclick = onWrite;
  $('btnDefault').onclick = onDefault;
  $('btnImport').onclick = onImport;
  $('btnExportTxt').onclick = exportTxt;
  $('btnExportBin').onclick = exportBin;
  $('btnActiveApp').onclick = () => refreshActiveAppInfo();
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
}

init();