
/********************************** (C) COPYRIGHT *******************************
* File Name          :CompositeKM.C
* Author             : WCH
* Version            : V1.2 
* Date               : 2018/02/28
* Description        : CH559模拟USB复合设备，键鼠，支持类命令,支持唤醒
*******************************************************************************/

#include "CH552.H"
// #include "UART1.H"
#include "Timer.H"
#include "Debug.H"
#include "scanKey.h"

#include "CompositeKM.H"
#include <string.h>
#include "FlashWrite.h"

#define Fullspeed
#define THIS_ENDP0_SIZE DEFAULT_ENDP0_SIZE

UINT8X __at (0x0000) Ep0Buffer[8 > (THIS_ENDP0_SIZE + 2) ? 8 : (THIS_ENDP0_SIZE + 2)];   //端点0 OUT&IN缓冲区，必须是偶地址
UINT8X __at (0x000a) Ep1Buffer[64 > (MAX_PACKET_SIZE + 2) ? 64 : (MAX_PACKET_SIZE + 2)]; //端点1 IN缓冲区,必须是偶地址
UINT8X __at (0x0050) Ep2Buffer[64 > (MAX_PACKET_SIZE + 2) ? 64 : (MAX_PACKET_SIZE + 2)]; //端点2 IN缓冲区,必须是偶地址
UINT8 SetupReq, Ready, Count, FLAG, UsbConfig;
UINT16 SetupLen;
PUINT8C pDescr;             //USB配置标志
USB_SETUP_REQ SetupReqBuf; //暂存Setup包

UINT8X __at (0x0160) KeymapBuf[KEYMAP_BYTES + 1];   // 480 字节数据 + 1 Report ID 位 = 481
volatile UINT8 keymapRxPending;  // 1=正在接收键位数据
volatile UINT16 keymapRxOffset;  // 已接收字节数（含 Report ID 位，从 1 起始，最大 481）
volatile UINT8 keymapSkipId;     // 1=数据阶段首字节为 Report ID，需跳过

// 应用场景下行：走 SetReport 控制传输（EP0，wValue=0x0202）
volatile UINT8 sceneCmdPending;

// 当前应用场景 ID（由 EP0 SET_REPORT 控制传输接收更新，scanKey.c 据此选择 keyMap）
volatile UINT8 currentScene;
// sbit Ep2InKey = P1 ^ 5;
__sbit __at (0xB5) CapsLED;

#define UsbSetupBuf ((PUSB_SETUP_REQ)Ep0Buffer)
#define DEBUG 0
// #pragma NOAREGS  // SDCC may not support this pragma
/*设备描述符*/
UINT8C DevDesc[18] = {0x12, 0x01, 0x10, 0x01, 0x00, 0x00, 0x00, THIS_ENDP0_SIZE,
                      0x58, 0x4c, 0x10, 0x53, 0x00, 0x00, 0x01, 0x03,
                      0x00, 0x01};
UINT8C CfgDesc[84] =
    {
        0x09, 0x02, 0x4D, 0x00, 0x03, 0x01, 0x00, 0xA0, 0x32, //配置描述符（77 字节，3 个接口）
        0x09, 0x04, 0x00, 0x00, 0x01, 0x03, 0x01, 0x01, 0x00, //接口描述符,键盘 IF0
        0x09, 0x21, 0x11, 0x01, 0x00, 0x01, 0x22, 0x54, 0x00, //HID类描述符 (报表描述符 84 字节)
        0x07, 0x05, 0x81, 0x03, 0x08, 0x00, 0x0a,             //端点描述符 1IN
        0x09, 0x04, 0x01, 0x00, 0x01, 0x03, 0x01, 0x02, 0x00, //接口描述符,鼠标 IF1
        0x09, 0x21, 0x10, 0x01, 0x00, 0x01, 0x22, 0x34, 0x00, //HID类描述符
        0x07, 0x05, 0x82, 0x03, 0x04, 0x00, 0x0a,             //端点描述符 2IN
        0x09, 0x04, 0x02, 0x00, 0x00, 0xFF, 0x00, 0x00, 0x00, //接口描述符,厂商自定义 IF2（应用场景下行，仅 SET_REPORT，无中断端点；class 改 0xFF 避免内核 usbhid 绑定报 warning）
        0x09, 0x21, 0x00, 0x01, 0x00, 0x01, 0x22, 0x15, 0x00, //HID类描述符 (报表描述符 21 字节)
};

UINT8C MyProductIDInfo[] = {0x1c,0x03,'X',0,'S',0,'1',0,'6',0,' ',0,'K',0,'e',0,'y',0,'b',0,'o',0,'a',0,'r',0,'d',0}; // 产品信息字符串描述符
/* 语言描述符 */
UINT8C MyLangDescr[ ] = { 0x04, 0x03, 0x09, 0x04 };
/* 厂家信息 */
UINT8C MyManuInfo[ ] = { 0x0C, 0x03, 'N', 0, 'i', 0, 'u', 0, 'e', 0, 'r', 0 };
/* 产品信息 */
UINT8C MyProdInfo[ ] = { 0x0C, 0x03, 'C', 0, 'H', 0, '5', 0, '5', 0, '2', 0 };

/*字符串描述符*/
/*HID类报表描述符*/
UINT8C KeyRepDesc[84] =
    {
        0x05, 0x01, 0x09, 0x06, 0xA1, 0x01, 0x05, 0x07,
        0x19, 0xe0, 0x29, 0xe7, 0x15, 0x00, 0x25, 0x01,
        0x75, 0x01, 0x95, 0x08, 0x81, 0x02, 0x95, 0x01,
        0x75, 0x08, 0x81, 0x01, 0x95, 0x03, 0x75, 0x01,
        0x05, 0x08, 0x19, 0x01, 0x29, 0x03, 0x91, 0x02,
        0x95, 0x05, 0x75, 0x01, 0x91, 0x01, 0x95, 0x06,
        0x75, 0x08, 0x26, 0xff, 0x00, 0x05, 0x07, 0x19,
        0x00, 0x29, 0x91, 0x81, 0x00, 
        // 厂商自定义 Feature 报告（键位映射读写，Report ID = 1）
        0xA1, 0x01,              // Collection (Application)
        0x85, 0x01,              //   Report ID (1)
        0x06, 0x00, 0xff,        //   Usage Page (Vendor Defined 0xFF00)
        0x09, 0x01,              //   Usage (1)
        0x15, 0x00,              //   Logical Minimum (0)
        0x26, 0xff, 0x00,        //   Logical Maximum (255)
        0x75, 0x08,              //   Report Size (8)
        0x96, 0xE0, 0x01,        //   Report Count (480 = 0x1E0)
        0xb1, 0x02,              //   Feature (Data,Var,Abs)
        0xC0, 0xC0               // End Collection
    };
UINT8C MouseRepDesc[52] =
    {
        0x05, 0x01, 0x09, 0x02, 0xA1, 0x01, 0x09, 0x01,
        0xA1, 0x00, 0x05, 0x09, 0x19, 0x01, 0x29, 0x03,
        0x15, 0x00, 0x25, 0x01, 0x75, 0x01, 0x95, 0x03,
        0x81, 0x02, 0x75, 0x05, 0x95, 0x01, 0x81, 0x01,
        0x05, 0x01, 0x09, 0x30, 0x09, 0x31, 0x09, 0x38,
        0x15, 0x81, 0x25, 0x7f, 0x75, 0x08, 0x95, 0x03,
        0x81, 0x06, 0xC0, 0xC0};
/* 厂商自定义 Output 报告（应用场景下行，Report ID = 2）
 * 主机通过 EP0 SET_REPORT 控制传输下发，不占用中断 OUT 端点。
 * 数据：[0]=ReportID(0x02) [1]=SCENE_CMD_MAGIC(0x5C) [2]=场景ID [3..7]=0 */
UINT8C VendorRepDesc[21] =
    {
        0xA1, 0x01,              // Collection (Application)
        0x85, 0x02,              //   Report ID (2)
        0x06, 0x00, 0xff,        //   Usage Page (Vendor Defined 0xFF00)
        0x09, 0x02,              //   Usage (2)
        0x15, 0x00,              //   Logical Minimum (0)
        0x26, 0xff, 0x00,        //   Logical Maximum (255)
        0x75, 0x08,              //   Report Size (8)
        0x95, 0x08,              //   Report Count (8)
        0x91, 0x02,              //   Output (Data,Var,Abs)
        0xC0                     // End Collection
    };
/*鼠标数据*/
UINT8 HIDMouse[4] = {0x0, 0x0, 0x0, 0x0};
/*键盘数据*/
extern UINT8 HIDKey[8] = {0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0};

/*******************************************************************************
* Function Name  : USBDeviceInit()
* Description    : USB设备模式配置,设备模式启动，收发端点配置，中断开启
* Input          : None
* Output         : None
* Return         : None
*******************************************************************************/
void USBDeviceInit(void)
{
    IE_USB = 0;
    USB_CTRL = 0x00;        // 先设定USB设备模式
    UDEV_CTRL = bUD_PD_DIS; // 禁止DP/DM下拉电阻
#ifndef Fullspeed
    UDEV_CTRL |= bUD_LOW_SPEED; //选择低速1.5M模式
    USB_CTRL |= bUC_LOW_SPEED;
#else
    UDEV_CTRL &= ~bUD_LOW_SPEED; //选择全速12M模式，默认方式
    USB_CTRL &= ~bUC_LOW_SPEED;
#endif

    UEP2_DMA = (UINT16)Ep2Buffer;                           //端点2数据传输地址
    UEP2_3_MOD = UEP2_3_MOD & ~bUEP2_BUF_MOD | bUEP2_TX_EN; //端点2发送使能 64字节缓冲区
    UEP2_CTRL = bUEP_AUTO_TOG | UEP_T_RES_NAK;              //端点2自动翻转同步标志位，IN事务返回NAK
    UEP0_DMA = (UINT16)Ep0Buffer;                           //端点0数据传输地址
    UEP4_1_MOD &= ~(bUEP4_RX_EN | bUEP4_TX_EN);             //端点0单64字节收发缓冲区
    UEP0_CTRL = UEP_R_RES_ACK | UEP_T_RES_NAK;              //OUT事务返回ACK，IN事务返回NAK
    UEP1_DMA = (UINT16)Ep1Buffer;                           //端点1数据传输地址
    UEP4_1_MOD = UEP4_1_MOD & ~bUEP1_BUF_MOD | bUEP1_TX_EN; //端点1发送使能 64字节缓冲区
    UEP1_CTRL = bUEP_AUTO_TOG | UEP_T_RES_NAK;              //端点1自动翻转同步标志位，IN事务返回NAK

    USB_DEV_AD = 0x00;
    USB_CTRL |= bUC_DEV_PU_EN | bUC_INT_BUSY | bUC_DMA_EN; // 启动USB设备及DMA，在中断期间中断标志未清除前自动返回NAK
    UDEV_CTRL |= bUD_PORT_EN;                              // 允许USB端口
    USB_INT_FG = 0xFF;                                     // 清中断标志
    USB_INT_EN = bUIE_SUSPEND | bUIE_TRANSFER | bUIE_BUS_RST;
    IE_USB = 1;
}
/*******************************************************************************
* Function Name  : Enp1IntIn()
* Description    : USB设备模式端点1的中断上传
* Input          : None
* Output         : None
* Return         : None
*******************************************************************************/
// void Enp1IntIn()
// {
//     memcpy(Ep1Buffer, HIDKey, sizeof(HIDKey));               //加载上传数据
//     UEP1_T_LEN = sizeof(HIDKey);                             //上传数据长度
//     UEP1_CTRL = UEP1_CTRL & ~MASK_UEP_T_RES | UEP_T_RES_ACK; //有数据时上传数据并应答ACK
// }
void Enp1IntInSend(UINT8 *HIDFrame)
{
    memcpy(Ep1Buffer, HIDFrame, 8);               //加载上传数据
    UEP1_T_LEN = 8;                             //上传数据长度
    UEP1_CTRL = UEP1_CTRL & ~MASK_UEP_T_RES | UEP_T_RES_ACK; //有数据时上传数据并应答ACK
}
/*******************************************************************************
* Function Name  : Enp2IntIn()
* Description    : USB设备模式端点2的中断上传
* Input          : None
* Output         : None
* Return         : None
*******************************************************************************/
// void Enp2IntIn()
// {
//     memcpy(Ep2Buffer, HIDMouse, sizeof(HIDMouse));           //加载上传数据
//     UEP2_T_LEN = sizeof(HIDMouse);                           //上传数据长度
//     UEP2_CTRL = UEP2_CTRL & ~MASK_UEP_T_RES | UEP_T_RES_ACK; //有数据时上传数据并应答ACK
// }

/*
 * Function Name  : Enp2IntInSend()
 * Description    : USB设备模式端点2的中断上传（鼠标报告）
 * Input          : UINT8 *HIDFrame - 4字节鼠标报告 [buttons, X, Y, wheel]
*/
void Enp2IntInSend(UINT8 *HIDFrame)
{
    memcpy(Ep2Buffer, HIDFrame, 4);               //加载上传数据
    UEP2_T_LEN = 4;                                //上传数据长度（4字节）
    UEP2_CTRL = UEP2_CTRL & ~MASK_UEP_T_RES | UEP_T_RES_ACK; //有数据时上传数据并应答ACK
}
/*******************************************************************************
* Function Name  : DeviceInterrupt()
* Description    : CH559USB中断处理函数
*******************************************************************************/
void DeviceInterrupt(void) __interrupt(INT_NO_USB) __using(1) //USB中断服务程序,使用寄存器组1
{
    UINT8 len = 0;
    // UART1SendByte(0xaa);
    if (UIF_TRANSFER) //USB传输完成标志
    {
        switch (USB_INT_ST & (MASK_UIS_TOKEN | MASK_UIS_ENDP))
        {
        case UIS_TOKEN_IN | 2: //endpoint 2# 中断端点上传
            UEP2_T_LEN = 0;    //预使用发送长度一定要清空
            // UEP2_CTRL ^= bUEP_T_TOG;     //如果不设置自动翻转则需要手动翻转
            UEP2_CTRL = UEP2_CTRL & ~MASK_UEP_T_RES | UEP_T_RES_NAK; //默认应答NAK
            break;
        case UIS_TOKEN_IN | 1: //endpoint 1# 中断端点上传
            UEP1_T_LEN = 0;    //预使用发送长度一定要清空
            // UEP2_CTRL ^= bUEP_T_TOG;     //如果不设置自动翻转则需要手动翻转
            UEP1_CTRL = UEP1_CTRL & ~MASK_UEP_T_RES | UEP_T_RES_NAK; //默认应答NAK
            FLAG = 1; /*传输完成标志*/
            break;
        case UIS_TOKEN_SETUP | 0: //SETUP事务
            len = USB_RX_LEN;
            if (len == (sizeof(USB_SETUP_REQ)))
            {
                // 每次新的 SETUP 都代表一次全新控制传输，必须清除上次残留状态，
                // 否则主机若在中途放弃（如 GetReport 读取超时），固件会带着
                // 残留的 SetupReq/SetupLen 进入等待 IN 中断状态，导致 EP0 卡死、
                // 键盘整体无响应（bUC_INT_BUSY 会让所有端点 NAK），只能拔插恢复。
                SetupReq = 0;
                SetupLen = 0;
                keymapRxPending = 0;
                keymapSkipId = 0;
                keymapRxOffset = 0;
                sceneCmdPending = 0;

                SetupLen = (UINT16)UsbSetupBuf->wLengthH << 8 | UsbSetupBuf->wLengthL;
                if (SetupLen > 0x0200)
                {
                    SetupLen = 0x0200; // 限制总长度（≤512，容纳 481 字节键位映射）
                }
                len = 0; // 默认为成功并且上传0长度
                SetupReq = UsbSetupBuf->bRequest;
                if ((UsbSetupBuf->bRequestType & USB_REQ_TYP_MASK) != USB_REQ_TYP_STANDARD) /* HID类命令 */
                {
                    switch (SetupReq)
                    {
                    case 0x01: // GetReport
                        // 仅支持本设备的厂商 Feature 报告（读取键位映射）
                        if (UsbSetupBuf->wValueH == 0x03 &&
                            UsbSetupBuf->wValueL == KEYMAP_REPORT_ID)
                        {
                            // 编号报告：数据阶段首字节必须为 Report ID
                            KeymapBuf[0] = KEYMAP_REPORT_ID;
                            readKeymapFromFlash((UINT8 __xdata *)(KeymapBuf + 1));
                            SetupLen = KEYMAP_BYTES + 1;   // 481 字节（480 数据 + Report ID）
                            len = SetupLen >= THIS_ENDP0_SIZE ? THIS_ENDP0_SIZE : SetupLen;
                            memcpy(Ep0Buffer, KeymapBuf, len);
                            SetupLen -= len;
                        }
                        // 其它报告类型按原行为返回 0 长度（不 STALL）
                        break;
                    case 0x02: //GetIdle
                        break;
                    case 0x03: //GetProtocol
                        break;
                    case 0x09: // SetReport
                        // 仅处理本设备的厂商 Feature 报告（写入键位映射）
                        if (UsbSetupBuf->wValueH == 0x03 &&
                            UsbSetupBuf->wValueL == KEYMAP_REPORT_ID)
                        {
                            UINT16 reqLen = (UINT16)UsbSetupBuf->wLengthH << 8 | UsbSetupBuf->wLengthL;
                            if (reqLen == KEYMAP_BYTES + 1)
                            {
                                // 标准编号报告：首字节为 Report ID（481 字节）
                                keymapRxPending = 1;
                                keymapRxOffset = 1;   // 数据区从 [1] 起（[0] 留给 Report ID）
                                keymapSkipId = 1;
                                len = 0; // 准备接收数据阶段
                            }
                            else if (reqLen == KEYMAP_BYTES)
                            {
                                // 兼容不带 Report ID 的 480 字节（数据同样落 [1..480]）
                                keymapRxPending = 1;
                                keymapRxOffset = 1;
                                keymapSkipId = 0;
                                len = 0;
                            }
                            else
                            {
                                len = 0xFF; // 长度不对
                            }
                        }
                        // 场景下行命令（Output 报告，Report ID = 2）：[0]=ReportID(0x02) [1]=MAGIC(0x5C) [2]=scene
                        else if (UsbSetupBuf->wValueH == 0x02 && UsbSetupBuf->wValueL == 0x02)
                        {
                            UINT16 reqLen = (UINT16)UsbSetupBuf->wLengthH << 8 | UsbSetupBuf->wLengthL;
                            if (reqLen == 8)
                            {
                                sceneCmdPending = 1;
                                len = 0; // 准备接收数据阶段
                            }
                            else
                            {
                                len = 0xFF; // 长度不对
                            }
                        }
                        // 其它 SetReport（如键盘 LED Output 报告）不处理，交给 OUT 阶段
                        break;
                    case 0x0A: //SetIdle
                        break;
                    case 0x0B: //SetProtocol
                        break;
                    default:
                        len = 0xFF; /*命令不支持*/
                        break;
                    }
                }
                else
                {                     //标准请求
                    switch (SetupReq) //请求码
                    {
                    case USB_GET_DESCRIPTOR:
                        switch (UsbSetupBuf->wValueH)
                        {
                        case 1:               //设备描述符
                            pDescr = DevDesc; //把设备描述符送到要发送的缓冲区
                            len = sizeof(DevDesc);
                            break;
                        case 2:               //配置描述符
                            pDescr = CfgDesc; //把设备描述符送到要发送的缓冲区
                            len = sizeof(CfgDesc);
                            break;
                        case 3:               // 字符串描述符
                            switch( UsbSetupBuf->wValueL )
                            {
                            case 0:
                                pDescr = (PUINT8)( &MyLangDescr[0] );
                                len = sizeof( MyLangDescr );
                                break;
                            case 1:
                                pDescr = (PUINT8)( &MyManuInfo[0] );
                                len = sizeof( MyManuInfo );
                                break;
                            case 2:
                                pDescr = (PUINT8)( &MyProdInfo[0] );
                                len = sizeof( MyProdInfo );
                                break;
                            case 3:
                                pDescr = (PUINT8)( &MyProductIDInfo[0] );
                                len = sizeof( MyProductIDInfo );
                                break;
                            default:
                                len = 0xFF;                                 // 不支持的字符串描述符
                                break;
                            }
                            break;
                        case 0x22:                         //报表描述符
                            if (UsbSetupBuf->wIndexL == 0) //接口0报表描述符
                            {
                                pDescr = KeyRepDesc; //数据准备上传
                                len = sizeof(KeyRepDesc);
                            }
                            else if (UsbSetupBuf->wIndexL == 1) //接口1报表描述符
                            {
                                pDescr = MouseRepDesc; //数据准备上传
                                len = sizeof(MouseRepDesc);
                            }
                            else if (UsbSetupBuf->wIndexL == 2) //接口2报表描述符（厂商场景下行）
                            {
                                pDescr = VendorRepDesc; //数据准备上传
                                len = sizeof(VendorRepDesc);
                            }
                            else
                            {
                                len = 0xff; //本程序只有3个接口，这句话正常不可能执行
                            }
                            break;
                        default:
                            len = 0xff; //不支持的命令或者出错
                            break;
                        }
                        if (SetupLen > len)
                        {
                            SetupLen = len; //限制总长度
                        }
                        len = SetupLen >= THIS_ENDP0_SIZE ? THIS_ENDP0_SIZE : SetupLen; //本次传输长度
                        memcpy(Ep0Buffer, pDescr, len);                                 //加载上传数据
                        SetupLen -= len;
                        pDescr += len;
                        break;
                    case USB_SET_ADDRESS:
                        SetupLen = UsbSetupBuf->wValueL; //暂存USB设备地址
                        break;
                    case USB_GET_CONFIGURATION:
                        Ep0Buffer[0] = UsbConfig;
                        if (SetupLen >= 1)
                        {
                            len = 1;
                        }
                        break;
                    case USB_SET_CONFIGURATION:
                        UsbConfig = UsbSetupBuf->wValueL;
                        if (UsbConfig)
                        {
#if DE_PRINTF
                            printf("SET CONFIG.\n");
#endif
                            Ready = 1; //set config命令一般代表usb枚举完成的标志
                        }
                        break;
                    case 0x0A:
                        break;
                    case USB_CLEAR_FEATURE:                                                         //Clear Feature
                        if ((UsbSetupBuf->bRequestType & USB_REQ_RECIP_MASK) == USB_REQ_RECIP_ENDP) // 端点
                        {
                            switch (UsbSetupBuf->wIndexL)
                            {
                            case 0x82:
                                UEP2_CTRL = UEP2_CTRL & ~(bUEP_T_TOG | MASK_UEP_T_RES) | UEP_T_RES_NAK;
                                break;
                            case 0x81:
                                UEP1_CTRL = UEP1_CTRL & ~(bUEP_T_TOG | MASK_UEP_T_RES) | UEP_T_RES_NAK;
                                break;
                            case 0x01:
                                UEP1_CTRL = UEP1_CTRL & ~(bUEP_R_TOG | MASK_UEP_R_RES) | UEP_R_RES_ACK;
                                break;
                            default:
                                len = 0xFF; // 不支持的端点
                                break;
                            }
                        }
                        if ((UsbSetupBuf->bRequestType & USB_REQ_RECIP_MASK) == USB_REQ_RECIP_DEVICE) // 设备
                        {
                            break;
                        }
                        else
                        {
                            len = 0xFF; // 不是端点不支持
                        }
                        break;
                    case USB_SET_FEATURE:                               /* Set Feature */
                        if ((UsbSetupBuf->bRequestType & 0x1F) == 0x00) /* 设置设备 */
                        {
                            if ((((UINT16)UsbSetupBuf->wValueH << 8) | UsbSetupBuf->wValueL) == 0x01)
                            {
                                if (CfgDesc[7] & 0x20)
                                {
                                    /* 设置唤醒使能标志 */
                                }
                                else
                                {
                                    len = 0xFF; /* 操作失败 */
                                }
                            }
                            else
                            {
                                len = 0xFF; /* 操作失败 */
                            }
                        }
                        else if ((UsbSetupBuf->bRequestType & 0x1F) == 0x02) /* 设置端点 */
                        {
                            if ((((UINT16)UsbSetupBuf->wValueH << 8) | UsbSetupBuf->wValueL) == 0x00)
                            {
                                switch (((UINT16)UsbSetupBuf->wIndexH << 8) | UsbSetupBuf->wIndexL)
                                {
                                case 0x82:
                                    UEP2_CTRL = UEP2_CTRL & (~bUEP_T_TOG) | UEP_T_RES_STALL; /* 设置端点2 IN STALL */
                                    break;
                                case 0x02:
                                    UEP2_CTRL = UEP2_CTRL & (~bUEP_R_TOG) | UEP_R_RES_STALL; /* 设置端点2 OUT Stall */
                                    break;
                                case 0x81:
                                    UEP1_CTRL = UEP1_CTRL & (~bUEP_T_TOG) | UEP_T_RES_STALL; /* 设置端点1 IN STALL */
                                    break;
                                default:
                                    len = 0xFF; //操作失败
                                    break;
                                }
                            }
                            else
                            {
                                len = 0xFF; //操作失败
                            }
                        }
                        else
                        {
                            len = 0xFF; //操作失败
                        }
                        break;
                    case USB_GET_STATUS:
                        Ep0Buffer[0] = 0x00;
                        Ep0Buffer[1] = 0x00;
                        if (SetupLen >= 2)
                        {
                            len = 2;
                        }
                        else
                        {
                            len = SetupLen;
                        }
                        break;
                    default:
                        len = 0xff; //操作失败
                        break;
                    }
                }
            }
            else
            {
                len = 0xff; //包长度错误
            }
            if (len == 0xff)
            {
                SetupReq = 0xFF;
                UEP0_CTRL = bUEP_R_TOG | bUEP_T_TOG | UEP_R_RES_STALL | UEP_T_RES_STALL; //STALL
            }
            else if (len) //上传数据或者状态阶段返回0长度包
            {
                UEP0_T_LEN = len;
                UEP0_CTRL = bUEP_R_TOG | bUEP_T_TOG | UEP_R_RES_ACK | UEP_T_RES_ACK; //默认数据包是DATA1，返回应答ACK
            }
            else
            {
                UEP0_T_LEN = 0;                                                      //虽然尚未到状态阶段，但是提前预置上传0长度数据包以防主机提前进入状态阶段
                UEP0_CTRL = bUEP_R_TOG | bUEP_T_TOG | UEP_R_RES_ACK | UEP_T_RES_ACK; //默认数据包是DATA1,返回应答ACK
            }
            break;
        case UIS_TOKEN_IN | 0: //endpoint0 IN
            switch (SetupReq)
            {
            case USB_GET_DESCRIPTOR:
                len = SetupLen >= THIS_ENDP0_SIZE ? THIS_ENDP0_SIZE : SetupLen; //本次传输长度
                memcpy(Ep0Buffer, pDescr, len);                                 //加载上传数据
                SetupLen -= len;
                pDescr += len;
                UEP0_T_LEN = len;
                UEP0_CTRL ^= bUEP_T_TOG; //同步标志位翻转
                break;
            case 0x01: // GetReport：回传厂商 Feature 报告（键位映射）
                len = SetupLen >= THIS_ENDP0_SIZE ? THIS_ENDP0_SIZE : SetupLen;
                memcpy(Ep0Buffer, KeymapBuf + (KEYMAP_BYTES + 1 - SetupLen), len);
                SetupLen -= len;
                UEP0_T_LEN = len;
                if (SetupLen == 0)
                {
                    // 数据阶段全部发送完毕，清理状态，防止主机放弃后固件卡死在 GetReport
                    SetupReq = 0;
                }
                UEP0_CTRL ^= bUEP_T_TOG; //同步标志位翻转
                break;
            case USB_SET_ADDRESS:
                USB_DEV_AD = USB_DEV_AD & bUDA_GP_BIT | SetupLen;
                UEP0_CTRL = UEP_R_RES_ACK | UEP_T_RES_NAK;
                break;
            default:
                UEP0_T_LEN = 0; //状态阶段完成中断或者是强制上传0长度数据包结束控制传输
                UEP0_CTRL = UEP_R_RES_ACK | UEP_T_RES_NAK;
                break;
            }
            break;
        case UIS_TOKEN_OUT | 0: // endpoint0 OUT
            len = USB_RX_LEN;
            if (SetupReq == 0x09)
            {
                if (keymapRxPending)
                {
                    // 厂商 Feature 报告：接收键位映射数据
                    // 数据统一写入 KeymapBuf[1..480]（[0] 为 Report ID 位）
                    UINT8 i = 0;
                    if (keymapSkipId)
                    {
                        i = 1;            // 跳过首包首字节的 Report ID
                        keymapSkipId = 0;
                    }
                    for (; i < len; i++)
                    {
                        if (keymapRxOffset < KEYMAP_BYTES + 1)
                            KeymapBuf[keymapRxOffset++] = Ep0Buffer[i];
                    }
                    if (keymapRxOffset >= KEYMAP_BYTES + 1)
                    {
                        // 所有数据接收完毕，写入 Flash（数据区为 KeymapBuf[1..480]）
                        writeKeymapToFlash((UINT8 __xdata *)(KeymapBuf + 1));
                        keymapRxPending = 0;
                    }
                }
                else if (sceneCmdPending)
                {
                    // 场景下行命令：Ep0Buffer[0]=ReportID(0x02) [1]=MAGIC(0x5C) [2]=scene
                    if (len >= 3 && Ep0Buffer[1] == SCENE_CMD_MAGIC)
                    {
                        if (Ep0Buffer[2] < SCENE_MAX && Ep0Buffer[2] != currentScene)
                        {
                            currentScene = Ep0Buffer[2];
                        }
                    }
                    sceneCmdPending = 0;
                }
                else
                {
                    // 键盘 LED Output 报告
                    if (Ep0Buffer[0] == 1)
                    {
                        CapsLED = 0;
                    }
                    if (Ep0Buffer[0] == 3)
                    {
                        CapsLED = 1;
                    }
                }
            }
            UEP0_CTRL ^= bUEP_R_TOG; //同步标志位翻转
            break;
        default:
            break;
        }
        UIF_TRANSFER = 0; //写0清空中断
    }
    if (UIF_BUS_RST) //设备模式USB总线复位中断
    {
        UEP0_CTRL = UEP_R_RES_ACK | UEP_T_RES_NAK;
        UEP1_CTRL = bUEP_AUTO_TOG | UEP_R_RES_ACK;
        UEP2_CTRL = bUEP_AUTO_TOG | UEP_R_RES_ACK | UEP_T_RES_NAK;
        USB_DEV_AD = 0x00;
        UIF_SUSPEND = 0;
        UIF_TRANSFER = 0;
        UIF_BUS_RST = 0; //清中断标志
    }
    if (UIF_SUSPEND) //USB总线挂起/唤醒完成
    {
        UIF_SUSPEND = 0;
        if (USB_MIS_ST & bUMS_SUSPEND) //挂起
        {
#if DEBUG
            printf("zz"); //睡眠状态
#endif
            //             while ( XBUS_AUX & bUART0_TX );                              //等待发送完成
            //             SAFE_MOD = 0x55;
            //             SAFE_MOD = 0xAA;
            //             WAKE_CTRL = bWAK_BY_USB | bWAK_RXD0_LO;                      //USB或者RXD0有信号时可被唤醒
            //             PCON |= PD;                                                  //睡眠
            //             SAFE_MOD = 0x55;
            //             SAFE_MOD = 0xAA;
            //             WAKE_CTRL = 0x00;
        }
    }
    else
    {                      //意外的中断,不可能发生的情况
        USB_INT_FG = 0xFF; //清中断标志
                           //      printf("UnknownInt  N");
    }
}

// void sendKeyHID(UINT8 *Frames)
// {
//     memcpy(HIDKey, Frames, 8);
//     Enp1IntIn();
// }
