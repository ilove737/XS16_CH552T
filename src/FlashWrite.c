#include "CH552.H"
#include "FlashWrite.h"

// GLOBAL_CFG 位定义（SDCC 版 CH552.H 未包含）
#define bCODE_WE   0x08
#define bDATA_WE   0x04

/*******************************************************************************
* Function Name  : writeKeymapToFlash
* Description    : 将 64 字节键位映射数据写入 Flash 0x3600
*                  前 32 字节 → mainKeyMap @ 0x3600
*                  后 32 字节 → Fn0_keyMap @ 0x3620
* Input          : data - XRAM 中的 64 字节数据
* Output         : None
* Return         : None
* Note           : 写入期间关中断，操作完毕恢复
*******************************************************************************/
void writeKeymapToFlash(UINT8 __xdata *data)
{
    UINT8 i;

    EA = 0;  // 关中断，防止写入期间被干扰

    // 进入安全模式，使能代码区写
    SAFE_MOD = 0x55;
    SAFE_MOD = 0xAA;
    GLOBAL_CFG |= bCODE_WE;
    SAFE_MOD = 0x00;

    // 写入 mainKeyMap @ 0x3600（16 个字）
    for (i = 0; i < KEYMAP_WORD_CNT; i++)
    {
        ROM_ADDR_H = 0x36;
        ROM_ADDR_L = i * 2;
        ROM_DATA_L = data[i * 2];
        ROM_DATA_H = data[i * 2 + 1];
        ROM_CTRL = ROM_CMD_WRITE;  // 写入 16 位字，CPU 自动暂停
    }

    // 写入 Fn0_keyMap @ 0x3620（16 个字）
    for (i = 0; i < KEYMAP_WORD_CNT; i++)
    {
        ROM_ADDR_H = 0x36;
        ROM_ADDR_L = 0x20 + i * 2;
        ROM_DATA_L = data[KEYMAP_WORD_CNT * 2 + i * 2];
        ROM_DATA_H = data[KEYMAP_WORD_CNT * 2 + i * 2 + 1];
        ROM_CTRL = ROM_CMD_WRITE;
    }

    // 关闭写保护，退出安全模式
    SAFE_MOD = 0x55;
    SAFE_MOD = 0xAA;
    GLOBAL_CFG &= ~bCODE_WE;
    SAFE_MOD = 0x00;

    EA = 1;  // 开中断
}

/*******************************************************************************
* Function Name  : readKeymapFromFlash
* Description    : 从 Flash 0x3600 读取 64 字节键位映射到 buf
*                  mainKeyMap(32B) @ 0x3600 + Fn0_keyMap(32B) @ 0x3620 连续存储
*******************************************************************************/
void readKeymapFromFlash(UINT8 __xdata *buf)
{
    PUINT8C src = (PUINT8C)KEYMAP_MAIN_ADDR;   // 代码区 Flash 起始地址
    UINT8 i;
    for (i = 0; i < KEYMAP_WORD_CNT * 4; i++)
    {
        buf[i] = src[i];
    }
}