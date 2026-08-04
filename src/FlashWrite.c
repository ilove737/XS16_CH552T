#include "CH552.H"
#include "FlashWrite.h"

// GLOBAL_CFG 位定义（SDCC 版 CH552.H 未包含）
#define bCODE_WE   0x08
#define bDATA_WE   0x04

/*******************************************************************************
* Function Name  : writeKeymapToFlash
* Description    : 将 480 字节键位映射数据写入 Flash 0x3600
*                  连续排布 6 槽，每槽 80 字节（16 应用名 + 32 主层 + 32 Fn 层）
* Input          : data - XRAM 中的 480 字节数据
* Output         : None
* Return         : None
* Note           : 写入期间关中断，操作完毕恢复
*******************************************************************************/
void writeKeymapToFlash(UINT8 __xdata *data)
{
    UINT16 i;
    UINT16 addr;

    EA = 0;  // 关中断，防止写入期间被干扰

    // 进入安全模式，使能代码区写
    SAFE_MOD = 0x55;
    SAFE_MOD = 0xAA;
    GLOBAL_CFG |= bCODE_WE;
    SAFE_MOD = 0x00;

    // 从 0x3600 起连续写入 KEYMAP_WORD_CNT 个字（480 字节）
    // 注意：必须用 16 位地址计算。0x3600 + 478 = 0x37DE 跨越了 0x36/0x37 两个页，
    // 且 i*2 超过 255 后若赋给 8 位 ROM_ADDR_L 会回绕到 0x3600，覆盖已写入数据，
    // 导致场景表被通用键位反复覆盖、应用名丢失。
    for (i = 0; i < KEYMAP_WORD_CNT; i++)
    {
        addr = KEYMAP_MAIN_ADDR + i * 2;
        ROM_ADDR_H = (UINT8)(addr >> 8);
        ROM_ADDR_L = (UINT8)(addr & 0xFF);
        ROM_DATA_L = data[i * 2];
        ROM_DATA_H = data[i * 2 + 1];
        ROM_CTRL = ROM_CMD_WRITE;  // 写入 16 位字，CPU 自动暂停
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
* Description    : 从 Flash 0x3600 读取 480 字节键位映射到 buf
*******************************************************************************/
void readKeymapFromFlash(UINT8 __xdata *buf)
{
    PUINT8C src = (PUINT8C)KEYMAP_MAIN_ADDR;   // 代码区 Flash 起始地址
    UINT16 i;                                  // 必须 16 位：480 超过 UINT8 上限 255
    for (i = 0; i < KEYMAP_BYTES; i++)         // 读取 480 字节
    {
        buf[i] = src[i];
    }
}
