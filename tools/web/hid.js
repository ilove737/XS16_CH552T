// hid.js
// WebHID 通信层（对应 tools/set_keymap.py 的 hidapi 实现）
// 使用浏览器原生 navigator.hid，无需后端 / libusb。
import { VID, PID, REPORT_ID, KEYMAP_SIZE } from './keymap.js';

// 浏览器是否支持 WebHID
export function isWebHidSupported() {
  return typeof navigator !== 'undefined' && !!navigator.hid;
}

// 该设备是否包含键位用的 Feature Report（Report ID = REPORT_ID, 64 字节）。
// 固件把键位读写放在厂商自定义 collection（Usage Page 0xFF00, Report ID 1）里，
// 与键盘 collection（0x01/0x06）是分开的顶层 collection。
// 返回：true=确定含有, false=确定不含, null=无法判断（collections 信息缺失）。
function deviceHasKeymapFeature(dev) {
  const cols = dev.collections;
  if (!cols || !cols.length) return null; // 信息缺失，交由后续回退逻辑判断
  for (const c of cols) {
    for (const r of (c.featureReports || [])) {
      if (r.reportId === REPORT_ID) return true;
    }
  }
  return false;
}

// 两个候选设备里挑更适合做键位读写的那个。
function pickBetter(a, b) {
  const sa = deviceHasKeymapFeature(a);
  const sb = deviceHasKeymapFeature(b);
  // 优先选"确定含有 Feature Report"的
  if (sa === true && sb !== true) return a;
  if (sb === true && sa !== true) return b;
  // 其次用厂商 usage page（0xFF00）做提示
  const va = a.usagePage === 0xFF00, vb = b.usagePage === 0xFF00;
  if (va && !vb) return a;
  if (vb && !va) return b;
  return a;
}

// 调试：打印设备的可观测属性，帮助诊断 Chrome 的 HIDDevice 行为。
function debugDevice(dev) {
  return {
    serial: dev.serialNumber,
    name: dev.productName,
    usagePage: dev.usagePage,
    usage: dev.usage,
    opened: dev.opened,
    hasGetFeat: typeof dev.getFeatureReport,
    hasSendFeat: typeof dev.sendFeatureReport,
    hasRecvFeat: typeof dev.receiveFeatureReport,
    // 注意 collections 可能在 open() 前为空
    cols: (dev.collections || []).map(c => ({
      usagePage: c.usagePage, usage: c.usage,
      type: c.type,
      inCount: (c.inputReports || []).length,
      outCount: (c.outputReports || []).length,
      featCount: (c.featureReports || []).length,
    })),
  };
}

// 调试：打印读取结果的摘要（前 8 个键位的原始字节）
function logReadResult(dev, body) {
  const label = dev.serialNumber || dev.productName || '?';
  const bytes = (body instanceof Uint8Array) ? body : new Uint8Array(body);
  const mainFirst = Array.from(bytes.slice(0, 16))
    .map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
  const fnFirst = bytes.length > 80
    ? Array.from(bytes.slice(80, 96))
      .map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
    : '(Fn 层数据不足)';
  console.log(`readKeymap: 成功 [${label}] 总长=${bytes.length}B`);
  console.log(`  mainKeyMap 前8键: ${mainFirst}`);
  console.log(`  Fn0_keyMap 前8键: ${fnFirst}`);
}
// 一个物理键盘会暴露多个顶层 collection（键盘 / 厂商 Feature / 鼠标），
// WebHID 每个 collection 给一个独立 HIDDevice。这里每个手只保留
// "包含键位 Feature Report 的那个 collection 对应的设备"，因为它才挂有
// getFeatureReport / sendFeatureReport 方法。
export function selectRepresentative(devices) {
  console.log('selectRepresentative: 候选设备', devices.map(debugDevice));
  const bySerial = new Map();
  for (const d of devices) {
    const key = d.serialNumber || d.productName || '?';
    const existing = bySerial.get(key);
    if (!existing) { bySerial.set(key, d); continue; }
    bySerial.set(key, pickBetter(existing, d));
  }
  const result = [...bySerial.values()];
  console.log('selectRepresentative: 最终选中的设备', result.map(debugDevice));
  return result;
}

// 请求用户授权并连接设备（弹出系统选择器）。
// 返回可用于键位读写（含 Feature Report）的 HIDDevice 数组；
// 用户取消时返回空数组。
export async function requestDevice() {
  if (!isWebHidSupported()) {
    throw new Error('当前浏览器不支持 WebHID（请使用 Chrome / Edge）。');
  }
  let devices;
  try {
    devices = await navigator.hid.requestDevice({
      filters: [{ vendorId: VID, productId: PID }],
    });
  } catch (e) {
    // 用户取消授权或过滤失败，返回空
    return [];
  }
  if (!devices || devices.length === 0) return [];
  return selectRepresentative(devices);
}

// 获取已配对（之前授权过）且未加入列表的设备。
export async function getPairedDevices() {
  if (!isWebHidSupported()) return [];
  const devices = await navigator.hid.getDevices();
  return selectRepresentative(devices);
}

// 设备稳定标识（按厂商/产品/序列号/名称/用途）
export function deviceId(dev, fallbackIndex = 0) {
  return `${dev.vendorId}:${dev.productId}:${dev.serialNumber || ''}:` +
         `${dev.productName || ''}:${dev.usagePage || 0}:${dev.usage || 0}`;
}

// 打开设备，失败时给出面向用户的明确指引。
// NotAllowedError 最常见原因有两种：
//   - 网页(origin)未被授权（Chrome/Edge 通用）
//   - Linux 下 /dev/hidraw* 设备节点当前用户无权限（udev 规则缺失）
export async function openDevice(dev) {
  if (dev.opened) return;
  try {
    await dev.open();
  } catch (e) {
    if (e && e.name === 'NotAllowedError') {
      const isLinux = /Linux/i.test(
        (navigator.userAgent || '') + ' ' + (navigator.platform || '')
      );
      if (isLinux) {
        throw new Error(
          '无法打开设备（NotAllowedError）。在 Linux 下这是 udev 权限问题——Chrome 能' +
          '枚举设备但打不开 /dev/hidraw* 节点。请执行：\n' +
          '① 新建 /etc/udev/rules.d/99-xs16-keyboard.rules，写入：\n' +
          '   SUBSYSTEM=="hidraw", ATTRS{idVendor}=="4c58", ATTRS{idProduct}=="5310", MODE="0666"\n' +
          '② sudo udevadm control --reload-rules && sudo udevadm trigger\n' +
          '③ 重新插拔两个键盘，刷新本页后重连。\n' +
          '（临时替代方案：sudo chmod 666 /dev/hidraw* 后刷新，但重启会失效）'
        );
      }
      throw new Error(
        '该键盘未被当前页面授权打开（NotAllowedError）。请：① 确认地址栏是 ' +
        'http(s)://localhost 或本机地址；② 点地址栏左侧站点设置 → USB 设备，' +
        '允许本站点访问，或删除后重新授权；③ 重新点「连接键盘」并在弹窗中勾选两个键盘再连接。'
      );
    }
    throw e;
  }
}

// 写入键位映射。data: Uint8Array(64)，不含 reportId。
export async function sendKeymap(dev, data) {
  if (!data || data.length !== KEYMAP_SIZE) {
    throw new Error(`数据长度错误: ${data ? data.length : 0}B, 期望 ${KEYMAP_SIZE}B`);
  }
  await openDevice(dev);

  if (typeof dev.sendFeatureReport === 'function') {
    // WebHID sendFeatureReport(reportId, data): data 不含 reportId
    await dev.sendFeatureReport(REPORT_ID, data);
    return;
  }

  // 回退：旧版 Chrome 可能没有 sendFeatureReport
  console.log('sendKeymap: device after open', debugDevice(dev));
  throw new Error(
    '当前选中的设备接口不支持 Feature Report（sendFeatureReport 不存在）。' +
    '请将 F12 控制台中 "selectRepresentative" 的输出复制发给我。'
  );
}

// 读取键位映射。返回 Uint8Array(64)，不含 reportId。
export async function readKeymap(dev) {
  await openDevice(dev);
  // 调试：输出设备在 open() 后的完整视图
  console.log('readKeymap: device after open', debugDevice(dev));

  // 尝试 getFeatureReport（标准 API，Chrome 89+）
  if (typeof dev.getFeatureReport === 'function') {
    // getFeatureReport(reportId, length): length 含 reportId 字节，故 161。
    const view = await dev.getFeatureReport(REPORT_ID, KEYMAP_SIZE + 1);
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    let body = bytes;
    if (bytes.length >= KEYMAP_SIZE + 1 && bytes[0] === REPORT_ID) {
      body = bytes.slice(1); // 去掉 reportId
    }
    if (body.length < KEYMAP_SIZE) {
      throw new Error(`读取失败 (返回 ${body.length} 字节, 期望 ${KEYMAP_SIZE})。`);
    }
    logReadResult(dev, body);
    return body.slice(0, KEYMAP_SIZE);
  }

  // 回退：旧版 Chrome 可能只有 receiveFeatureReport（Chrome 86-88 草案）
  if (typeof dev.receiveFeatureReport === 'function') {
    console.log('readKeymap: 回退到 receiveFeatureReport（旧版 API）');
    const view = await dev.receiveFeatureReport(REPORT_ID);
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    let body = bytes;
    if (bytes.length >= KEYMAP_SIZE + 1 && bytes[0] === REPORT_ID) {
      body = bytes.slice(1);
    }
    if (body.length < KEYMAP_SIZE) {
      throw new Error(`读取失败 (返回 ${body.length} 字节, 期望 ${KEYMAP_SIZE})。`);
    }
    logReadResult(dev, body);
    return body.slice(0, KEYMAP_SIZE);
  }

  throw new Error(
    '当前选中的设备接口不支持 Feature Report（getFeatureReport / receiveFeatureReport 均不存在）。' +
    'Chrome 可能未将键位读写所在的厂商 collection（Usage Page 0xFF00）暴露为独立 HIDDevice。' +
    '请将 F12 控制台中 "selectRepresentative" 和 "readKeymap" 的输出复制发给我，' +
    '以便确认 Chrome 的实际行为。'
  );
}
