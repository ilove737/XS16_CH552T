#include "CH552.H"
#include "Timer.H"
#include "UART1.H"
#include "Debug.H"
#include "scanKey.h"
#include "CompositeKM.H"

// 中断函数声明 — 告知 SDCC 链接器生成中断向量表
// 必须放在 main() 所在文件，否则多文件链接时向量表不会生成
void mTimer0Interrupt(void) __interrupt(INT_NO_TMR0);
void DeviceInterrupt(void) __interrupt(INT_NO_USB);

void main(void)
{
    CfgFsys();   //CH559时钟选择配置
    mDelaymS(5); //修改主频等待内部晶振稳定,必加
    mInitSTDIO(); //串口0初始化

    initGPIO();

    // readDataFlash();

    UART1Init();

    mTimer0Clk12DivFsys();       //T0定时器时钟设置
    mTimer_x_ModInit(0, 1);      //T0 定时器模式设置
    mTimer_x_SetData(0, 0x5555); //T0定时器赋值
    mTimer0RunCTL(1);            //T0定时器启动
    ET0 = 1;                     //T0定时器中断开启
    EA = 1;

//读取芯片唯一ID号
#if DE_PRINTF
    printf("ID0 = %02x %02x \n", (UINT16) * (PUINT8C)(0x3FFA), (UINT16) * (PUINT8C)(0x3FFB));
    printf("ID1 = %02x %02x \n", (UINT16) * (PUINT8C)(0x3FFC), (UINT16) * (PUINT8C)(0x3FFD));
    printf("ID2 = %02x %02x \n", (UINT16) * (PUINT8C)(0x3FFE), (UINT16) * (PUINT8C)(0x3FFF));
#endif

    USBDeviceInit(); //USB设备模式初始化
    EA = 1;          //允许单片机中断
    UEP1_T_LEN = 0;  //预使用发送长度一定要清空
    UEP2_T_LEN = 0;  //预使用发送长度一定要清空
    FLAG = 0;

    while (1)
    {
        // if (Ready)
        // {
        //     HIDValueHandle(); //该函数会一直等待串口接收一个字节
        // }

        // if ((Ready) && (Ep2InKey == 0))
        // {
        //     Enp1IntIn(); //仅发送键盘键值“抬起”操作
        //     mDelaymS(10);
        // }
        // mDelaymS(10); //模拟单片机做其它事
    }

}
