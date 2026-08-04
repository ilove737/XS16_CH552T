
#ifndef __Composite_KM__
#define __Composite_KM__

// 应用场景下行协议（与 keyMap.h 保持一致，避免引入整表定义导致链接冲突）
// 数据格式：[0]=ReportID(0x02) [1]=SCENE_CMD_MAGIC(0x5C) [2]=场景ID [3..7]=0
#define SCENE_MAX        6
#define SCENE_CMD_MAGIC  0x5C

// 厂商自定义 HID Feature 报告：键位映射读写（Report ID = 1）
// 480 字节数据 + 1 Report ID 位。读/写共用一块缓冲（读和写不会同时发生），
// 避免 480+481B 两块分离缓冲超出 XRAM(0x400) 容量。
// 数据区固定位于 [1..480]（[0] 为 Report ID 位）。
// 地址选在 Ep1/Ep2 缓冲之后，避免 XRAM 变量重叠。
#define KEYMAP_REPORT_ID  0x01

// extern Ready;
// extern Ep2InKey;
// extern HIDKey;

void USBDeviceInit(void);
// void Enp1IntIn(void);
// void Enp2IntIn(void);
// void HIDValueHandle(void);
// void sendKeyHID(UINT8 *Frames);
void Enp1IntInSend(UINT8 *HIDFrame);
void Enp2IntInSend(UINT8 *HIDFrame);
extern UINT8 HIDKey[8];
extern UINT8 HIDMouse[4];

// 厂商自定义请求：接收键位映射（由主机通过 EP0 控制传输发送）
extern volatile UINT8 keymapRxPending;
extern volatile UINT16 keymapRxOffset;

// 当前应用场景 ID（由 EP0 SET_REPORT 控制传输接收更新，scanKey.c 据此选择 keyMap）
extern volatile UINT8 currentScene;

#endif