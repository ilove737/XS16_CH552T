#ifndef __FLASH_WRITE_H__
#define __FLASH_WRITE_H__

#include "CH552.H"

// 场景映射区基址：0x3600 起，6 槽 × 80 字节 = 480 字节（连续）
#define KEYMAP_MAIN_ADDR  0x3600
// 总字数：480 字节 / 2 = 240 个字（ROM 按 16 位字写入）
#define KEYMAP_WORD_CNT   240
// 键位映射数据总字节数：6 槽 × 80 字节 = 480 字节
#define KEYMAP_BYTES     (KEYMAP_WORD_CNT * 2)

void writeKeymapToFlash(UINT8 __xdata *data);
void readKeymapFromFlash(UINT8 __xdata *buf);

#endif
