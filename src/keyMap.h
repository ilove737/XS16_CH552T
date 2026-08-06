#ifndef __KEY_MAP_H__
#define __KEY_MAP_H__

#include "CH552.H"
#include "scanKey.h"

// =========================================================================
// 应用场景（纯编号，不再预设语义 ID）
// 所有场景（含主层）统一放入一个大二维数组 sceneMapTable[SCENE_MAX][80]，
// 通过 currentScene 编号偏移定位。每槽 80 字节：
//   [0..15]   应用名称（ASCII，不足补 0，第 16 字节作 0 结尾，最多 15 字符）
//   [16..47]  主层键位（16 键 × 2）
//   [48..79]  该场景专属 Fn 层键位（16 键 × 2）
// =========================================================================
#define SCENE_MAX         6     // 场景槽位总数（编号 0~5）
#define NAME_SIZE         16    // 应用名区长度（字节）
#define KEY_BYTES         32    // 每层键位长度（16 键 × 2 字节）
#define SCENE_MAP_SIZE    80    // 每槽总长度 = NAME_SIZE + KEY_BYTES*2

// 各槽位在数组中的键位区偏移
#define MAP_MAIN_OFF      NAME_SIZE              // 16：主层键位起始
#define MAP_FN_OFF        (NAME_SIZE + KEY_BYTES) // 48：Fn 层键位起始

// 场景指令接收协议（经中断 OUT 端点 3，厂商自定义 Output 报告，Report ID = 2）
// 数据格式：[0]=ReportID(0x02) [1]=SCENE_CMD_MAGIC(0x5C) [2]=场景ID [3..7]=0
#define SCENE_CMD_MAGIC  0x5C

// =========================================================================
// 键位映射大二维数组（编译期固定，__at(0x3600)）
// 6 槽 × 80 字节 = 480 字节，占 0x3600 ~ 0x37DF。
// app 通过扩展后的 Feature Report 可读改写其中任意槽（含应用名与键位）。
// 通用主层键位（deepin 系统快捷键）与 Fn 键位见下方注释。
// =========================================================================
UINT8C __at(0x3600) sceneMapTable[SCENE_MAX][SCENE_MAP_SIZE] = {
    // ---- 槽 0：主层（编号 0，应用名 generic） ----
    {
        /* 应用名 0..15 */
        'g','e','n','e','r','i','c', 0,0,0,0,0,0,0,0,0,
        /* 主层键位 16..47（deepin 系统快捷键，按 keymap_XS16 导出） */
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_LEFT,    // Ctrl+Alt+←  切换到左边工作区
        KEY_MOD_LMETA, KEY_S,                    // Win+S       显示工作区
        KEY_MOD_LSHIFT, KEY_SPACE,               // Shift+Space 全局搜索
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_RIGHT,   // Ctrl+Alt+→  切换到右边工作区
        KEY_MOD_LALT, KEY_TAB,                   // Alt+Tab     切换窗口
        KEY_MOD_LALT, KEY_GRAVE,                 // Alt+`       切换同类型窗口
        KEY_MOD_LSHIFT|KEY_MOD_LALT, KEY_GRAVE,  // Shift+Alt+` 反向切换同类型窗口
        KEY_MOD_LSHIFT|KEY_MOD_LALT, KEY_TAB,    // Shift+Alt+Tab 反向切换窗口
        KEY_MOD_LALT, KEY_F2,                    // Alt+F2      终端雷神模式
        KEY_MOD_LMETA, KEY_N,                    // Win+N       最小化窗口
        KEY_MOD_LMETA, KEY_UP,                   // Win+↑       最大化窗口
        KEY_MOD_LMETA, KEY_V,                    // Win+V       剪贴板
        KEY_FnX, 0,                              // Fn          切换 Fn 层
        KEY_MOD_LMETA, KEY_LEFT,                 // Win+←       窗口平铺左侧
        KEY_MOD_LMETA, KEY_DOWN,                 // Win+↓       恢复窗口
        KEY_MOD_LMETA, KEY_RIGHT,                // Win+→       窗口平铺右侧
        /* Fn 层键位 48..79（deepin 截图/录屏/图文识别 + 鼠标，按 keymap_XS16 导出） */
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_I,       // Ctrl+Alt+I  滚动截图
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_A,       // Ctrl+Alt+A  截图
        KEY_MOD_LCTRL, KEY_SYSRQ,                // Ctrl+PrtSc  延时截图
        0, KEY_SYSRQ,                            // PrtSc       全屏截图
        KEY_MOD_LALT, KEY_SYSRQ,                 // Alt+PrtSc   窗口截图
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_C,       // Ctrl+Alt+C  图文识别
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_R,       // Ctrl+Alt+R  录屏
        KEY_MOD_LMETA, KEY_E,                    // Win+E       文件管理器
        KEY_MOD_LMETA, 0,                        // Win+空      启动器(占位)
        0xFE, MOUSE_LCLICK, 0xFE, MOUSE_UP, 0xFE, MOUSE_RCLICK,
        KEY_FnX, 0,  0xFE, MOUSE_LEFT, 0xFE, MOUSE_DOWN, 0xFE, MOUSE_RIGHT,
    },
    // ---- 槽 1：场景 1（编号 1，应用名 deepin-terminal，终端定制键位） ----
    {
        /* 应用名 0..15 */
        'd','e','e','p','i','n','-','t','e','r','m', 'i','n','a','l',0,
        /* 主层键位 16..47（终端定制，按 keymap_XS16 导出） */
        KEY_MOD_LCTRL|KEY_MOD_LSHIFT, KEY_1,   // Ctrl+Shift+1 切换到标签1
        KEY_MOD_LCTRL|KEY_MOD_LSHIFT, KEY_2,   // Ctrl+Shift+2 切换到标签2
        KEY_MOD_LCTRL, KEY_EQUAL,              // Ctrl+=       放大字号
        KEY_MOD_LCTRL, KEY_MINUS,              // Ctrl+-       缩小字号
        KEY_MOD_LCTRL|KEY_MOD_LSHIFT, KEY_T,   // Ctrl+Shift+T 新建标签页
        KEY_MOD_LCTRL|KEY_MOD_LSHIFT, KEY_TAB, // Ctrl+Shift+Tab 上一个标签页
        KEY_MOD_LCTRL, KEY_TAB,                // Ctrl+Tab     下一个标签页
        KEY_MOD_LALT, KEY_W,                   // Alt+W        关闭标签页
        KEY_MOD_LCTRL|KEY_MOD_LSHIFT, KEY_C,   // Ctrl+Shift+C 复制
        KEY_MOD_LCTRL|KEY_MOD_LSHIFT, KEY_V,   // Ctrl+Shift+V 粘贴
        KEY_MOD_LALT, KEY_DOWN,                // Alt+↓        选择下面工作区
        KEY_MOD_LALT, KEY_Q,                   // Alt+Q        关闭工作区
        KEY_FnX, 0,                            // Fn           切换 Fn 层
        KEY_MOD_LALT, KEY_LEFT,                // Alt+←        选择左边工作区
        KEY_MOD_LALT, KEY_UP,                  // Alt+↑        选择上面工作区
        KEY_MOD_LALT, KEY_RIGHT,               // Alt+→        选择右边工作区
        /* Fn 层键位 48..79（终端分屏/查找/全选 + 鼠标，按 keymap_XS16 导出） */
        KEY_MOD_LCTRL|KEY_MOD_LSHIFT, KEY_J,   // Ctrl+Shift+J 纵向分屏
        KEY_MOD_LCTRL|KEY_MOD_LSHIFT, KEY_H,   // Ctrl+Shift+H 横向分屏
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_F,     // Ctrl+Alt+F   查找
        KEY_MOD_LCTRL, KEY_0,                  // Ctrl+0       默认大小
        KEY_MOD_LCTRL|KEY_MOD_LSHIFT, KEY_A,   // Ctrl+Shift+A 全选
        0, KEY_F11,                            // F11          全屏
        KEY_MOD_LCTRL|KEY_MOD_LSHIFT, KEY_W,   // Ctrl+Shift+W 关闭其他标签页
        KEY_MOD_LCTRL|KEY_MOD_LSHIFT, KEY_Q,   // Ctrl+Shift+Q 关闭其他工作区
        0, KEY_F2,                             // F2           重命名标题
        0xFE, MOUSE_LCLICK, 0xFE, MOUSE_UP, 0xFE, MOUSE_RCLICK,
        KEY_FnX, 0,  0xFE, MOUSE_LEFT, 0xFE, MOUSE_DOWN, 0xFE, MOUSE_RIGHT,
    },
    // ---- 槽 2：场景 2（编号 2，应用名 firefox，浏览器定制键位） ----
    {
        /* 应用名 0..15 */
        'f','i','r','e','f','o','x', 0,0,0,0,0,0,0,0,0,
        /* 主层键位 16..47（浏览器定制） */
        KEY_MOD_LCTRL, KEY_T,                  // Ctrl+T         新建标签页
        0, KEY_LEFTMETA,                       // Super          启动器
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_A,     // Ctrl+Alt+A     截图
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_R,     // Ctrl+Alt+R     录屏
        KEY_MOD_LALT, KEY_TAB,                 // Alt+Tab        切换窗口
        KEY_MOD_LMETA, KEY_D,                  // Super+D        显示桌面
        KEY_MOD_LMETA, KEY_E,                  // Super+E        文件管理器
        KEY_MOD_LMETA, KEY_L,                  // Super+L        锁屏
        KEY_MOD_LCTRL, KEY_W,                  // Ctrl+W         关闭标签页
        KEY_MOD_LCTRL|KEY_MOD_LSHIFT, KEY_N,   // Ctrl+Shift+N   新开窗口
        KEY_MOD_LCTRL, KEY_R,                  // Ctrl+R         刷新
        KEY_MOD_LALT, KEY_LEFT,                // Alt+←          后退
        KEY_FnX, 0,                            // Fn             切换 Fn 层
        KEY_MOD_LCTRL, KEY_L,                  // Ctrl+L         定位地址栏
        KEY_MOD_LCTRL|KEY_MOD_LSHIFT, KEY_T,   // Ctrl+Shift+T   恢复关闭标签页
        KEY_MOD_LCTRL, KEY_D,                  // Ctrl+D         加入书签
        /* Fn 层键位 48..79（通用功能键） */
        0, KEY_ESC,  0, KEY_F1,  0, KEY_F2,  0, KEY_F3,
        0, KEY_TAB,  0, KEY_F11, 0, KEY_F12, 0, KEY_E,
        0, KEY_CAPSLOCK, 0xFE, MOUSE_LCLICK, 0xFE, MOUSE_UP, 0xFE, MOUSE_RCLICK,
        KEY_FnX, 0,  0xFE, MOUSE_LEFT, 0xFE, MOUSE_DOWN, 0xFE, MOUSE_RIGHT,
    },
    // ---- 槽 3：预留场景（编号 3，应用名为空，沿用通用键位） ----
    {
        /* 应用名 0..15 */
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        /* 主层键位 16..47（通用） */
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_T,
        0, KEY_LEFTMETA,
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_A,
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_R,
        KEY_MOD_LALT, KEY_TAB,
        KEY_MOD_LMETA, KEY_D,
        KEY_MOD_LMETA, KEY_E,
        KEY_MOD_LMETA, KEY_L,
        KEY_MOD_LALT, KEY_F4,
        KEY_MOD_LMETA, KEY_S,
        KEY_MOD_LMETA, KEY_UP,
        KEY_MOD_LMETA, KEY_DOWN,
        KEY_FnX, 0,
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_ESC,
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_DELETE,
        KEY_MOD_LMETA, KEY_P,
        /* Fn 层键位 48..79（通用功能键） */
        0, KEY_ESC,  0, KEY_F1,  0, KEY_F2,  0, KEY_F3,
        0, KEY_TAB,  0, KEY_F11, 0, KEY_F12, 0, KEY_E,
        0, KEY_CAPSLOCK, 0xFE, MOUSE_LCLICK, 0xFE, MOUSE_UP, 0xFE, MOUSE_RCLICK,
        KEY_FnX, 0,  0xFE, MOUSE_LEFT, 0xFE, MOUSE_DOWN, 0xFE, MOUSE_RIGHT,
    },
    // ---- 槽 4：预留场景（编号 4，应用名为空，沿用通用键位） ----
    {
        /* 应用名 0..15 */
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        /* 主层键位 16..47（通用） */
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_T,
        0, KEY_LEFTMETA,
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_A,
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_R,
        KEY_MOD_LALT, KEY_TAB,
        KEY_MOD_LMETA, KEY_D,
        KEY_MOD_LMETA, KEY_E,
        KEY_MOD_LMETA, KEY_L,
        KEY_MOD_LALT, KEY_F4,
        KEY_MOD_LMETA, KEY_S,
        KEY_MOD_LMETA, KEY_UP,
        KEY_MOD_LMETA, KEY_DOWN,
        KEY_FnX, 0,
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_ESC,
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_DELETE,
        KEY_MOD_LMETA, KEY_P,
        /* Fn 层键位 48..79（通用功能键） */
        0, KEY_ESC,  0, KEY_F1,  0, KEY_F2,  0, KEY_F3,
        0, KEY_TAB,  0, KEY_F11, 0, KEY_F12, 0, KEY_E,
        0, KEY_CAPSLOCK, 0xFE, MOUSE_LCLICK, 0xFE, MOUSE_UP, 0xFE, MOUSE_RCLICK,
        KEY_FnX, 0,  0xFE, MOUSE_LEFT, 0xFE, MOUSE_DOWN, 0xFE, MOUSE_RIGHT,
    },
    // ---- 槽 5：预留场景（编号 5，应用名为空，沿用通用键位） ----
    {
        /* 应用名 0..15 */
        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
        /* 主层键位 16..47（通用） */
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_T,
        0, KEY_LEFTMETA,
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_A,
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_R,
        KEY_MOD_LALT, KEY_TAB,
        KEY_MOD_LMETA, KEY_D,
        KEY_MOD_LMETA, KEY_E,
        KEY_MOD_LMETA, KEY_L,
        KEY_MOD_LALT, KEY_F4,
        KEY_MOD_LMETA, KEY_S,
        KEY_MOD_LMETA, KEY_UP,
        KEY_MOD_LMETA, KEY_DOWN,
        KEY_FnX, 0,
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_ESC,
        KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_DELETE,
        KEY_MOD_LMETA, KEY_P,
        /* Fn 层键位 48..79（通用功能键） */
        0, KEY_ESC,  0, KEY_F1,  0, KEY_F2,  0, KEY_F3,
        0, KEY_TAB,  0, KEY_F11, 0, KEY_F12, 0, KEY_E,
        0, KEY_CAPSLOCK, 0xFE, MOUSE_LCLICK, 0xFE, MOUSE_UP, 0xFE, MOUSE_RCLICK,
        KEY_FnX, 0,  0xFE, MOUSE_LEFT, 0xFE, MOUSE_DOWN, 0xFE, MOUSE_RIGHT,
    },
};

#endif // KEY_MAP
