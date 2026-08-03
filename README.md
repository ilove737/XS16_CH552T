# XS16_CH552T

## 介绍
基于CH552T微控制器实现的XS16键盘固件项目（16键，使用40键矩阵的4×4子集）。这是一个USB键盘/鼠标复合设备固件，使用CH552系列微控制器实现键盘和鼠标功能。

## 项目特点
- 支持USB键盘和鼠标功能（复合设备）
- 基于CH552T微控制器
- 支持键盘扫描矩阵（4行×4列，共16键）
- 包含定时器和GPIO控制功能
- 支持数据闪存存储

## 硬件平台
- 微控制器：CH552T
- 开发板：XS16

## 编译环境设置

### Linux编译环境
本项目已经配置为可以在Linux环境下使用SDCC编译器编译：

1. 安装SDCC编译器：
   ```bash
   sudo apt-get update
   sudo apt-get install sdcc
   ```

2. 编译项目：
   ```bash
   make clean
   make all
   ```

3. 编译输出：
   - 生成的文件将存放在 `out/` 目录中
   - 最终固件：`out/XS16_CH552T.hex`

## 项目结构
- `src/main.c` - 主程序入口
- `CompositeKM.C` - USB键盘鼠标复合设备实现
- `CH552_SDCC.H` - SDCC兼容的CH552头文件
- `Debug.C/Debug.H` - 调试和延时函数
- `Timer.C/Timer.H` - 定时器功能
- `GPIO.C` - GPIO控制功能
- `scanKey.c/scanKey.h` - 键盘扫描功能
- `DataFlash.C` - 数据闪存功能
- `Makefile` - Linux编译脚本

## 编译说明
- 使用SDCC (Small Device C Compiler) 进行编译
- 目标微控制器：CH552T
- 代码大小限制：32KB
- 已配置为支持USB设备模式

## 输出文件
- `XS16_CH552T.hex` - 可烧录的Intel HEX格式固件
- `XS16_CH552T.ihx` - Intel HEX格式中间文件
- 各种调试文件（.asm, .lst, .map等）在out目录中

## 烧录方式
生成的hex文件可以通过支持CH552的编程器进行烧录，例如：
- ISP编程器
- 相关的CH55x专用烧录工具

## 注意事项
- 项目已适配SDCC编译器，不再依赖Keil C51
- 所有CH552特定寄存器定义已转换为SDCC兼容格式
- USB功能已适配CH552 USB控制器

## 许可证
基于原始WCH(CH552)示例代码开发
