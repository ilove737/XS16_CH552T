#ifndef __KEY_MAP_H__
#define __KEY_MAP_H__

#include "CH552.H"
#include "scanKey.h"

// 键位映射表（16 键：4 行 × 4 列）
// 主层：deepin 系统常用快捷键
// 修饰键组合：KEY_MOD_LCTRL|KEY_MOD_LALT = Ctrl+Alt，KEY_MOD_LMETA = Super(Win) 等
UINT8C __at(0x3600) mainKeyMap[16][2] = {
    // 行 0: 终端 / 启动器 / 截图 / 录屏
    {KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_T},          // Ctrl+Alt+T  打开终端
    {0, KEY_LEFTMETA},                            // Super       启动器
    {KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_A},          // Ctrl+Alt+A  截图
    {KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_R},          // Ctrl+Alt+R  录屏
    // 行 1: 切换窗口 / 桌面 / 文件管理器 / 锁屏
    {KEY_MOD_LALT, KEY_TAB},                      // Alt+Tab     切换窗口
    {KEY_MOD_LMETA, KEY_D},                       // Super+D     显示桌面
    {KEY_MOD_LMETA, KEY_E},                       // Super+E     文件管理器
    {KEY_MOD_LMETA, KEY_L},                       // Super+L     锁屏
    // 行 2: 关闭窗口 / 工作区 / 最大化 / 恢复
    {KEY_MOD_LALT, KEY_F4},                       // Alt+F4      关闭窗口
    {KEY_MOD_LMETA, KEY_S},                       // Super+S     工作区
    {KEY_MOD_LMETA, KEY_UP},                      // Super+↑     最大化
    {KEY_MOD_LMETA, KEY_DOWN},                    // Super+↓     恢复窗口
    // 行 3: Fn / 系统监视器 / 关机菜单 / 显示器
    {KEY_FnX, 0},                                 // Fn          切换 Fn 层
    {KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_ESC},        // Ctrl+Alt+Esc 系统监视器
    {KEY_MOD_LCTRL|KEY_MOD_LALT, KEY_DELETE},     // Ctrl+Alt+Del 关机菜单
    {KEY_MOD_LMETA, KEY_P},                       // Super+P     显示器设置
};

// Fn0 键位映射表（16 键）
// 修饰键字节 0xFE 表示鼠标动作，键码为 MOUSE_* 宏定义
UINT8C __at(0x3620) Fn0_keyMap[16][2] = {
    {0,KEY_ESC},      {0,KEY_F1}, {0,KEY_F2}, {0,KEY_F3},
    {0,KEY_TAB},      {0,KEY_F11}, {0,KEY_F12}, {0,KEY_E},
    {0,KEY_CAPSLOCK}, {0xFE,MOUSE_LCLICK}, {0xFE,MOUSE_UP}, {0xFE,MOUSE_RCLICK},
    {KEY_FnX,0},      {0xFE,MOUSE_LEFT}, {0xFE,MOUSE_DOWN}, {0xFE,MOUSE_RIGHT},
};

#endif // KEY_MAP