/*
 * CH552.h - CH552 microcontroller register definitions
 * 
 * This file provides SDCC-compatible definitions for the CH552 microcontroller
 * based on the original CH552.H file.
 */

#ifndef __CH552_SDCC_H__
#define __CH552_SDCC_H__

// #include <8051.h>  // 移除，SDCC 自带 <8051.h> 与 CH552 自定义 SFR 定义重复

#define DE_PRINTF           0

/*----- constant and type define -----------------------------------------*/
#ifndef TRUE
#define TRUE    1
#endif
#ifndef FALSE
#define FALSE   0
#endif
#ifndef NULL
#define NULL    0
#endif

#ifndef BOOL
typedef __bit BOOL;
#endif
typedef unsigned char   UINT8;
typedef unsigned short  UINT16;
typedef unsigned long   UINT32;
typedef signed char     INT8;
typedef signed short    INT16;
typedef signed long     INT32;
typedef unsigned char   __data  UINT8D;
typedef unsigned short  __data  UINT16D;
typedef unsigned long   __data  UINT32D;
typedef unsigned char   __idata UINT8I;
typedef unsigned short  __idata UINT16I;
typedef unsigned long   __idata UINT32I;
typedef unsigned char   __xdata UINT8X;
typedef unsigned short  __xdata UINT16X;
typedef unsigned long   __xdata UINT32X;
typedef unsigned char   volatile UINT8V;
typedef unsigned char   volatile __data  UINT8DV;
typedef unsigned char   volatile __xdata UINT8XV;
typedef unsigned char   volatile __pdata UINT8PV;
typedef const unsigned char __code UINT8C;

typedef unsigned char     *PUINT8;
typedef unsigned short    *PUINT16;
typedef unsigned long     *PUINT32;
typedef unsigned char __idata  *PUINT8I;
typedef unsigned short __idata  *PUINT16I;
typedef unsigned long __idata  *PUINT32I;
typedef unsigned char __xdata  *PUINT8X;
typedef unsigned short __xdata  *PUINT16X;
typedef unsigned long __xdata  *PUINT32X;
typedef unsigned char volatile        *PUINT8V;
typedef unsigned char volatile __data  *PUINT8DV;
typedef unsigned char volatile __xdata *PUINT8XV;
typedef unsigned char volatile __pdata *PUINT8PV;
typedef const unsigned char __code *PUINT8C;

#ifndef STRUCT_OFFSET
#define STRUCT_OFFSET( s, m )       ( (UINT8)( & (((s) *)0) -> (m) ) )  /* get the offset address for a member of a structure */
#endif

// Define CH552 specific SFRs and SBITs
__sfr __at (0xD0) PSW;
__sbit __at (0xD7) CY;
__sbit __at (0xD6) AC;
__sbit __at (0xD5) F0;
__sbit __at (0xD4) RS1;
__sbit __at (0xD3) RS0;
__sbit __at (0xD2) OV;
__sbit __at (0xD1) F1;
__sbit __at (0xD0) P;

__sfr __at (0xE0) ACC;
__sfr __at (0xF0) B;
__sfr __at (0x81) SP;
__sfr __at (0x82) DPL;
__sfr __at (0x83) DPH;

__sfr __at (0xA1) SAFE_MOD;
#define CHIP_ID           SAFE_MOD
__sfr __at (0xB1) GLOBAL_CFG;

// Power Control Register
__sfr __at (0x87) PCON;
#define SMOD              0x80      // baud rate selection for UART0 mode 1/2/3
#define GF1               0x08      // general purpose flag bit 1
#define GF0               0x04      // general purpose flag bit 0
#define PD                0x02      // power-down enable bit

// Clock and Sleep Registers
__sfr __at (0xB9) CLOCK_CFG;
#define bOSC_EN_INT       0x80      // internal oscillator enable and original clock selection: 1=enable & select internal clock, 0=disable & select external clock
#define bOSC_EN_XT        0x40      // external oscillator enable, need quartz crystal or ceramic resonator between XI and XO pins
#define bWDOG_IF_TO       0x20      // ReadOnly: watch-dog timer overflow interrupt flag, cleared by reload watch-dog count or auto cleared when MCU enter interrupt routine
#define bROM_CLK_FAST     0x10      // flash-ROM clock frequency selection: 0=normal(for Fosc>=16MHz), 1=fast(for Fosc<16MHz)
#define bRST              0x08      // ReadOnly: pin RST input
#define bT2EX_            0x08      // alternate pin for T2EX
#define bCAP2_            0x08      // alternate pin for CAP2
#define MASK_SYS_CK_SEL   0x07      // bit mask of system clock Fsys selection
/*
   Fxt = 24MHz(8MHz~25MHz for non-USB application), from external oscillator @XI&XO
   Fosc = bOSC_EN_INT ? 24MHz : Fxt
   Fpll = Fosc * 4 => 96MHz (32MHz~100MHz for non-USB application)
   Fusb4x = Fpll / 2 => 48MHz (Fixed)
              MASK_SYS_CK_SEL[2] [1] [0]
   Fsys = Fpll/3   =  32MHz:  1   1   1
   Fsys = Fpll/4   =  24MHz:  1   1   0
   Fsys = Fpll/6   =  16MHz:  1   0   1
   Fsys = Fpll/8   =  12MHz:  1   0   0
   Fsys = Fpll/16  =   6MHz:  0   1   1
   Fsys = Fpll/32  =   3MHz:  0   1   0
   Fsys = Fpll/128 = 750KHz:  0   0   1
   Fsys = Fpll/512 =187.5KHz: 0   0   0
*/

__sfr __at (0xA9) WAKE_CTRL;
#define bWAK_BY_USB       0x80      // enable wake-up by USB event
#define bWAK_RXD1_LO      0x40      // enable wake-up by RXD1 low level
#define bWAK_P1_5_LO      0x20      // enable wake-up by pin P1.5 low level
#define bWAK_P1_4_LO      0x10      // enable wake-up by pin P1.4 low level
#define bWAK_P1_3_LO      0x08      // enable wake-up by pin P1.3 low level
#define bWAK_RST_HI       0x04      // enable wake-up by pin RST high level
#define bWAK_P3_2E_3L     0x02      // enable wake-up by pin P3.2 (INT0) edge or pin P3.3 (INT1) low level
#define bWAK_RXD0_LO      0x01      // enable wake-up by RXD0 low level

__sfr __at (0xFE) RESET_KEEP;
__sfr __at (0xFF) WDOG_COUNT;

// Interrupt Registers
__sfr __at (0xA8) IE;
__sbit __at (0xAF) EA;
__sbit __at (0xAE) E_DIS;
__sbit __at (0xAD) ET2;
__sbit __at (0xAC) ES;
__sbit __at (0xAB) ET1;
__sbit __at (0xAA) EX1;
__sbit __at (0xA9) ET0;
__sbit __at (0xA8) EX0;

__sfr __at (0xB8) IP;
__sbit __at (0xBF) PH_FLAG;
__sbit __at (0xBE) PL_FLAG;
__sbit __at (0xBD) PT2;
__sbit __at (0xBC) PS;
__sbit __at (0xBB) PT1;
__sbit __at (0xBA) PX1;
__sbit __at (0xB9) PT0;
__sbit __at (0xB8) PX0;

__sfr __at (0xE8) IE_EX;
__sbit __at (0xEF) IE_WDOG;
__sbit __at (0xEE) IE_GPIO;
__sbit __at (0xED) IE_PWMX;
__sbit __at (0xEC) IE_UART1;
__sbit __at (0xEB) IE_ADC;
__sbit __at (0xEA) IE_USB;
__sbit __at (0xE9) IE_TKEY;
__sbit __at (0xE8) IE_SPI0;

__sfr __at (0xE9) IP_EX;
__sfr __at (0xC7) GPIO_IE;

// FlashROM and Data-Flash Registers
// __sfr16 __at (0x84) ROM_ADDR;
__sfr __at (0x84) ROM_ADDR_L;
__sfr __at (0x85) ROM_ADDR_H;
// __sfr16 __at (0x8E) ROM_DATA;
__sfr __at (0x8E) ROM_DATA_L;
__sfr __at (0x8F) ROM_DATA_H;
__sfr __at (0x86) ROM_CTRL;
#define ROM_CMD_WRITE     0x9A
#define ROM_CMD_READ      0x8E
#define ROM_STATUS        ROM_CTRL
#define bROM_ADDR_OK      0x40
#define bROM_CMD_ERR      0x02

// Port Registers
__sfr __at (0x90) P1;
__sbit __at (0x97) SCK;
__sbit __at (0x97) TXD1;
__sbit __at (0x96) MISO;
__sbit __at (0x96) RXD1;
__sbit __at (0x95) MOSI;
__sbit __at (0x95) PWM1;
__sbit __at (0x94) T2_;
__sbit __at (0x94) CAP1_;
__sbit __at (0x94) SCS;
__sbit __at (0x93) TXD_;
__sbit __at (0x92) RXD_;
__sbit __at (0x91) T2EX;
__sbit __at (0x91) CAP2;
__sbit __at (0x90) T2;
__sbit __at (0x90) CAP1;

__sfr __at (0x92) P1_MOD_OC;
__sfr __at (0x93) P1_DIR_PU;

__sfr __at (0xA0) P2;

__sfr __at (0xB0) P3;
__sbit __at (0xB7) UDM;
__sbit __at (0xB6) UDP;
__sbit __at (0xB5) T1;
__sbit __at (0xB4) PWM2;
__sbit __at (0xB4) RXD1_;
__sbit __at (0xB4) T0;
__sbit __at (0xB3) INT1;
__sbit __at (0xB2) TXD1_;
__sbit __at (0xB2) INT0;
__sbit __at (0xB2) VBUS1;
__sbit __at (0xB2) AIN3;
__sbit __at (0xB1) PWM2_;
__sbit __at (0xB1) TXD;
__sbit __at (0xB0) PWM1_;
__sbit __at (0xB0) RXD;

__sfr __at (0x96) P3_MOD_OC;
__sfr __at (0x97) P3_DIR_PU;
__sfr __at (0xC6) PIN_FUNC;
#define bUSB_IO_EN        0x80      // USB UDP/UDM I/O pin enable: 0=P3.6/P3.7 as GPIO, 1=P3.6/P3.7 as USB
__sfr __at (0xA2) XBUS_AUX;

// Timer0/1 Registers
__sfr __at (0x88) TCON;
__sbit __at (0x8F) TF1;
__sbit __at (0x8E) TR1;
__sbit __at (0x8D) TF0;
__sbit __at (0x8C) TR0;
__sbit __at (0x8B) IE1;
__sbit __at (0x8A) IT1;
__sbit __at (0x89) IE0;
__sbit __at (0x88) IT0;

__sfr __at (0x89) TMOD;             // timer 0/1 mode
#define bT1_GATE          0x80      // gate control of timer1: 0=timer1 run enable while TR1=1, 1=timer1 run enable while P3.3 (INT1) pin is high and TR1=1
#define bT1_CT            0x40      // counter or timer mode selection for timer1: 0=timer, use internal clock, 1=counter, use P3.5 (T1) pin falling edge as clock
#define bT1_M1            0x20      // timer1 mode high bit
#define bT1_M0            0x10      // timer1 mode low bit
#define MASK_T1_MOD       0x30      // bit mask of timer1 mode
// bT1_M1 & bT1_M0: timer1 mode
//   00: mode 0, 13-bit timer or counter by cascaded TH1 and lower 5 bits of TL1, the upper 3 bits of TL1 are ignored
//   01: mode 1, 16-bit timer or counter by cascaded TH1 and TL1
//   10: mode 2, TL1 operates as 8-bit timer or counter, and TH1 provide initial value for TL1 auto-reload
//   11: mode 3, stop timer1
#define bT0_GATE          0x08      // gate control of timer0: 0=timer0 run enable while TR0=1, 1=timer0 run enable while P3.2 (INT0) pin is high and TR0=1
#define bT0_CT            0x04      // counter or timer mode selection for timer0: 0=timer, use internal clock, 1=counter, use P3.4 (T0) pin falling edge as clock
#define bT0_M1            0x02      // timer0 mode high bit
#define bT0_M0            0x01      // timer0 mode low bit
#define MASK_T0_MOD       0x03      // bit mask of timer0 mode
// bT0_M1 & bT0_M0: timer0 mode
//   00: mode 0, 13-bit timer or counter by cascaded TH0 and lower 5 bits of TL0, the upper 3 bits of TL0 are ignored
//   01: mode 1, 16-bit timer or counter by cascaded TH0 and TL0
//   10: mode 2, TL0 operates as 8-bit timer or counter, and TH0 provide initial value for TL0 auto-reload
//   11: mode 3, TL0 is 8-bit timer or counter controlled by standard timer0 bits, TH0 is 8-bit timer using TF1 and controlled by TR1, timer1 run enable if it is not mode 3

__sfr __at (0x8A) TL0;
__sfr __at (0x8B) TL1;
__sfr __at (0x8C) TH0;
__sfr __at (0x8D) TH1;

// UART0 Registers
__sfr __at (0x98) SCON;
__sbit __at (0x9F) SM0;
__sbit __at (0x9E) SM1;
__sbit __at (0x9D) SM2;
__sbit __at (0x9C) REN;
__sbit __at (0x9B) TB8;
__sbit __at (0x9A) RB8;
__sbit __at (0x99) TI;
__sbit __at (0x98) RI;
__sfr __at (0x99) SBUF;

// UART1 Registers
__sfr __at (0xC0) SCON1;
__sbit __at (0xCF) U1SM0;
__sbit __at (0xCD) U1SMOD;
__sbit __at (0xCC) U1REN;
__sbit __at (0xCB) U1TB8;
__sbit __at (0xCA) U1RB8;
__sbit __at (0xC9) U1TI;
__sbit __at (0xC8) U1RI;
__sfr __at (0xC1) SBUF1;
__sfr __at (0xC2) SBAUD1;


// Timer2/Capture2 Registers
__sfr __at (0xC8) T2CON;
__sbit __at (0xCF) TF2;
__sbit __at (0xCF) CAP1F;
__sbit __at (0xCE) EXF2;
__sbit __at (0xCD) RCLK;
__sbit __at (0xCC) TCLK;
__sbit __at (0xCB) EXEN2;
__sbit __at (0xCA) TR2;
__sbit __at (0xC9) C_T2;
__sbit __at (0xC8) CP_RL2;

__sfr __at (0xC9) T2MOD;
#define bTMR_CLK          0x80      // fastest internal clock mode for timer 0/1/2 under faster clock mode: 0=use divided clock, 1=use original Fsys as clock without dividing
#define bT2_CLK           0x40      // timer2 internal clock frequency selection: 0=standard clock, Fsys/12 for timer mode, Fsys/4 for UART0 clock mode,
                                    //   1=faster clock, Fsys/4 @bTMR_CLK=0 or Fsys @bTMR_CLK=1 for timer mode, Fsys/2 @bTMR_CLK=0 or Fsys @bTMR_CLK=1 for UART0 clock mode
#define bT1_CLK           0x20      // timer1 internal clock frequency selection: 0=standard clock, Fsys/12, 1=faster clock, Fsys/4 if bTMR_CLK=0 or Fsys if bTMR_CLK=1
#define bT0_CLK           0x10      // timer0 internal clock frequency selection: 0=standard clock, Fsys/12, 1=faster clock, Fsys/4 if bTMR_CLK=0 or Fsys if bTMR_CLK=1
#define bT2_CAP_M1        0x08      // timer2 capture mode high bit
#define bT2_CAP_M0        0x04      // timer2 capture mode low bit
#define T2OE              0x02      // enable timer2 generated clock output: 0=disable output, 1=enable clock output at T2 pin, frequency = TF2/2
#define bT2_CAP1_EN       0x01      // enable T2 trigger function for capture 1 of timer2 if RCLK=0 & TCLK=0 & CP_RL2=1 & C_T2=0 & T2OE=0

// __sfr16 __at (0xCA) RCAP2;
__sfr __at (0xCA) RCAP2L;
__sfr __at (0xCB) RCAP2H;
// __sfr16 __at (0xCC) T2COUNT;
__sfr __at (0xCC) TL2;
__sfr __at (0xCD) TH2;
// __sfr16 __at (0xCE) T2CAP1
__sfr __at (0xCE) T2CAP1L;
__sfr __at (0xCF) T2CAP1H;

// PWM Registers
__sfr __at (0x9B) PWM_DATA2;
__sfr __at (0x9C) PWM_DATA1;
__sfr __at (0x9D) PWM_CTRL;


/*  USB Device Registers  */
__sfr __at (0x91) USB_C_CTRL;       // USB type-C control
#define bVBUS2_PD_EN      0x80      // USB VBUS2 10K pulldown resistance: 0=disable, 1=enable pullup
#define bUCC2_PD_EN       0x40      // USB CC2 5.1K pulldown resistance: 0=disable, 1=enable pulldown
#define bUCC2_PU1_EN      0x20      // USB CC2 pullup resistance control high bit
#define bUCC2_PU0_EN      0x10      // USB CC2 pullup resistance control low bit
#define bVBUS1_PD_EN      0x08      // USB VBUS1 10K pulldown resistance: 0=disable, 1=enable pullup
#define bUCC1_PD_EN       0x04      // USB CC1 5.1K pulldown resistance: 0=disable, 1=enable pulldown
#define bUCC1_PU1_EN      0x02      // USB CC1 pullup resistance control high bit
#define bUCC1_PU0_EN      0x01      // USB CC1 pullup resistance control low bit
// bUCC?_PU1_EN & bUCC?_PU0_EN: USB CC pullup resistance selection
//   00: disable pullup resistance
//   01: enable 56K pullup resistance for default USB power
//   10: enable 22K pullup resistance for 1.5A USB power
//   11: enable 10K pullup resistance for 3A USB power

__sfr __at (0xD1) UDEV_CTRL;        // USB device physical port control
#define bUD_PD_DIS        0x80      // disable USB UDP/UDM pulldown resistance: 0=enable pulldown, 1=disable
#define bUD_DP_PIN        0x20      // ReadOnly: indicate current UDP pin level
#define bUD_DM_PIN        0x10      // ReadOnly: indicate current UDM pin level
#define bUD_LOW_SPEED     0x04      // enable USB physical port low speed: 0=full speed, 1=low speed
#define bUD_GP_BIT        0x02      // general purpose bit
#define bUD_PORT_EN       0x01      // enable USB physical port I/O: 0=disable, 1=enable

__sfr __at (0xD2) UEP1_CTRL;        // endpoint 1 control
#define bUEP_R_TOG        0x80      // expected data toggle flag of USB endpoint X receiving (OUT): 0=DATA0, 1=DATA1
#define bUEP_T_TOG        0x40      // prepared data toggle flag of USB endpoint X transmittal (IN): 0=DATA0, 1=DATA1
#define bUEP_AUTO_TOG     0x10      // enable automatic toggle after successful transfer completion on endpoint 1/2/3: 0=manual toggle, 1=automatic toggle
#define bUEP_R_RES1       0x08      // handshake response type high bit for USB endpoint X receiving (OUT)
#define bUEP_R_RES0       0x04      // handshake response type low bit for USB endpoint X receiving (OUT)
#define MASK_UEP_R_RES    0x0C      // bit mask of handshake response type for USB endpoint X receiving (OUT)
#define UEP_R_RES_ACK     0x00
#define UEP_R_RES_TOUT    0x04
#define UEP_R_RES_NAK     0x08
#define UEP_R_RES_STALL   0x0C
// bUEP_R_RES1 & bUEP_R_RES0: handshake response type for USB endpoint X receiving (OUT)
//   00: ACK (ready)
//   01: no response, time out to host, for non-zero endpoint isochronous transactions
//   10: NAK (busy)
//   11: STALL (error)
#define bUEP_T_RES1       0x02      // handshake response type high bit for USB endpoint X transmittal (IN)
#define bUEP_T_RES0       0x01      // handshake response type low bit for USB endpoint X transmittal (IN)
#define MASK_UEP_T_RES    0x03      // bit mask of handshake response type for USB endpoint X transmittal (IN)
#define UEP_T_RES_ACK     0x00
#define UEP_T_RES_TOUT    0x01
#define UEP_T_RES_NAK     0x02
#define UEP_T_RES_STALL   0x03
// bUEP_T_RES1 & bUEP_T_RES0: handshake response type for USB endpoint X transmittal (IN)
//   00: DATA0 or DATA1 then expecting ACK (ready)
//   01: DATA0 or DATA1 then expecting no response, time out from host, for non-zero endpoint isochronous transactions
//   10: NAK (busy)
//   11: STALL (error)

__sfr __at (0xD3) UEP1_T_LEN;   // 端点1传输长度
__sfr __at (0xD4) UEP2_CTRL;    // endpoint 2 control
__sfr __at (0xD5) UEP2_T_LEN;   // 端点2传输长度
__sfr __at (0xD6) UEP3_CTRL;    // endpoint 3 control
__sfr __at (0xD7) UEP3_T_LEN;   // 端点3传输长度 
__sfr __at (0xD8) USB_INT_FG;   // USB interrupt flag
__sbit __at (0xD8^2) UIF_SUSPEND;
__sbit __at (0xD8^1) UIF_TRANSFER;
__sbit __at (0xD8^0) UIF_BUS_RST;

__sfr __at (0xD9) USB_INT_ST;       // ReadOnly: USB interrupt status
#define bUIS_IS_NAK       0x80      // ReadOnly: indicate current USB transfer is NAK received
#define bUIS_TOG_OK       0x40      // ReadOnly: indicate current USB transfer toggle is OK
#define bUIS_TOKEN1       0x20      // ReadOnly: current token PID code bit 1 received
#define bUIS_TOKEN0       0x10      // ReadOnly: current token PID code bit 0 received
#define MASK_UIS_TOKEN    0x30      // ReadOnly: bit mask of current token PID code received
#define UIS_TOKEN_OUT     0x00
#define UIS_TOKEN_SOF     0x10
#define UIS_TOKEN_IN      0x20
#define UIS_TOKEN_SETUP   0x30
// bUIS_TOKEN1 & bUIS_TOKEN0: current token PID code received
//   00: OUT token PID received
//   01: SOF token PID received
//   10: IN token PID received
//   11: SETUP token PID received
#define MASK_UIS_ENDP     0x0F      // ReadOnly: bit mask of current transfer endpoint number

__sfr __at (0xDA) USB_MIS_ST;
#define bUMS_SIE_FREE       0x20
#define bUMS_R_FIFO_RDY     0x10
#define bUMS_BUS_RESET      0x08
#define bUMS_SUSPEND        0x04
#define bUMS_ARB_LOST       0x02
#define bUMS_SOF_ACT        0x01

__sfr __at (0xDB) USB_RX_LEN;
__sfr __at (0xDC) UEP0_CTRL;
__sfr __at (0xDD) UEP0_T_LEN;
__sfr __at (0xDE) UEP4_CTRL;
__sfr __at (0xDF) UEP4_T_LEN;

__sfr __at (0xE1) USB_INT_EN;       // USB interrupt enable
#define bUIE_DEV_SOF      0x80      // enable interrupt for SOF received
#define bUIE_DEV_NAK      0x40      // enable interrupt for NAK responded
#define bUIE_FIFO_OV      0x10      // enable interrupt for FIFO overflow
#define bUIE_SUSPEND      0x04      // enable interrupt for USB suspend or resume event
#define bUIE_TRANSFER     0x02      // enable interrupt for USB transfer completion
#define bUIE_BUS_RST      0x01      // enable interrupt for USB bus reset event

__sfr __at (0xE2) USB_CTRL;         // USB base control
#define bUC_LOW_SPEED     0x40      // enable USB low speed: 0=full speed, 1=low speed
#define bUC_DEV_PU_EN     0x20      // USB device enable and internal pullup resistance enable
#define bUC_SYS_CTRL1     0x20      // USB system control high bit
#define bUC_SYS_CTRL0     0x10      // USB system control low bit
#define MASK_UC_SYS_CTRL  0x30      // bit mask of USB system control
// bUC_SYS_CTRL1 & bUC_SYS_CTRL0: USB system control
//   00: disable USB device and disable internal pullup resistance
//   01: enable USB device and disable internal pullup resistance, need external pullup resistance
//   1x: enable USB device and enable internal pullup resistance
#define bUC_INT_BUSY      0x08      // enable automatic responding busy during interrupt flag UIF_TRANSFER valid
#define bUC_RESET_SIE     0x04      // force reset USB SIE, need software clear
#define bUC_CLR_ALL       0x02      // force clear FIFO and count of USB
#define bUC_DMA_EN        0x01      // DMA enable and DMA interrupt enable for USB

__sfr __at (0xE3) USB_DEV_AD;
#define bUDA_GP_BIT         0x80
#define MASK_USB_ADDR     0x7F      // bit mask for USB device address

__sfr __at (0xE4) UEP2_DMA;
__sfr __at (0xE6) UEP3_DMA;

__sfr __at (0xEA) UEP4_1_MOD;       // endpoint 4/1 mode
#define bUEP1_RX_EN       0x80      // enable USB endpoint 1 receiving (OUT)
#define bUEP1_TX_EN       0x40      // enable USB endpoint 1 transmittal (IN)
#define bUEP1_BUF_MOD     0x10      // buffer mode of USB endpoint 1
// bUEPn_RX_EN & bUEPn_TX_EN & bUEPn_BUF_MOD: USB endpoint 1/2/3 buffer mode, buffer start address is UEPn_DMA
//   0 0 x:  disable endpoint and disable buffer
//   1 0 0:  64 bytes buffer for receiving (OUT endpoint)
//   1 0 1:  dual 64 bytes buffer by toggle bit bUEP_R_TOG selection for receiving (OUT endpoint), total=128bytes
//   0 1 0:  64 bytes buffer for transmittal (IN endpoint)
//   0 1 1:  dual 64 bytes buffer by toggle bit bUEP_T_TOG selection for transmittal (IN endpoint), total=128bytes
//   1 1 0:  64 bytes buffer for receiving (OUT endpoint) + 64 bytes buffer for transmittal (IN endpoint), total=128bytes
//   1 1 1:  dual 64 bytes buffer by bUEP_R_TOG selection for receiving (OUT endpoint) + dual 64 bytes buffer by bUEP_T_TOG selection for transmittal (IN endpoint), total=256bytes
#define bUEP4_RX_EN       0x08      // enable USB endpoint 4 receiving (OUT)
#define bUEP4_TX_EN       0x04      // enable USB endpoint 4 transmittal (IN)
// bUEP4_RX_EN & bUEP4_TX_EN: USB endpoint 4 buffer mode, buffer start address is UEP0_DMA
//   0 0:  single 64 bytes buffer for endpoint 0 receiving & transmittal (OUT & IN endpoint)
//   1 0:  single 64 bytes buffer for endpoint 0 receiving & transmittal (OUT & IN endpoint) + 64 bytes buffer for endpoint 4 receiving (OUT endpoint), total=128bytes
//   0 1:  single 64 bytes buffer for endpoint 0 receiving & transmittal (OUT & IN endpoint) + 64 bytes buffer for endpoint 4 transmittal (IN endpoint), total=128bytes
//   1 1:  single 64 bytes buffer for endpoint 0 receiving & transmittal (OUT & IN endpoint)
//           + 64 bytes buffer for endpoint 4 receiving (OUT endpoint) + 64 bytes buffer for endpoint 4 transmittal (IN endpoint), total=192bytes


__sfr __at (0xEB) UEP2_3_MOD;
#define bUEP3_RX_EN       0x80      // enable USB endpoint 3 receiving (OUT)
#define bUEP3_TX_EN       0x40      // enable USB endpoint 3 transmittal (IN)
#define bUEP3_BUF_MOD     0x10      // buffer mode of USB endpoint 3
#define bUEP2_RX_EN       0x08      // enable USB endpoint 2 receiving (OUT)
#define bUEP2_TX_EN       0x04      // enable USB endpoint 2 transmittal (IN)
#define bUEP2_BUF_MOD     0x01      // buffer mode of USB endpoint 2

__sfr __at (0xEC) UEP0_DMA;
__sfr __at (0xEE) UEP1_DMA;

/*----- XDATA: xRAM ------------------------------------------*/

#define XDATA_RAM_SIZE    0x0400    // size of expanded xRAM, xdata SRAM embedded chip

/*----- Reference Information --------------------------------------------*/
#define ID_CH552          0x52      // chip ID
#define ID_CH551          0x51      // chip ID

/* Interrupt routine address and interrupt number */
#define INT_ADDR_INT0     0x0003    // interrupt vector address for INT0
#define INT_ADDR_TMR0     0x000B    // interrupt vector address for timer0
#define INT_ADDR_INT1     0x0013    // interrupt vector address for INT1
#define INT_ADDR_TMR1     0x001B    // interrupt vector address for timer1
#define INT_ADDR_UART0    0x0023    // interrupt vector address for UART0
#define INT_ADDR_TMR2     0x002B    // interrupt vector address for timer2
#define INT_ADDR_SPI0     0x0033    // interrupt vector address for SPI0
#define INT_ADDR_TKEY     0x003B    // interrupt vector address for touch-key timer
#define INT_ADDR_USB      0x0043    // interrupt vector address for USB
#define INT_ADDR_ADC      0x004B    // interrupt vector address for ADC
#define INT_ADDR_UART1    0x0053    // interrupt vector address for UART1
#define INT_ADDR_PWMX     0x005B    // interrupt vector address for PWM1/2
#define INT_ADDR_GPIO     0x0063    // interrupt vector address for GPIO
#define INT_ADDR_WDOG     0x006B    // interrupt vector address for watch-dog timer
#define INT_NO_INT0       0         // interrupt number for INT0
#define INT_NO_TMR0       1         // interrupt number for timer0
#define INT_NO_INT1       2         // interrupt number for INT1
#define INT_NO_TMR1       3         // interrupt number for timer1
#define INT_NO_UART0      4         // interrupt number for UART0
#define INT_NO_TMR2       5         // interrupt number for timer2
#define INT_NO_SPI0       6         // interrupt number for SPI0
#define INT_NO_TKEY       7         // interrupt number for touch-key timer
#define INT_NO_USB        8         // interrupt number for USB
#define INT_NO_ADC        9         // interrupt number for ADC
#define INT_NO_UART1      10        // interrupt number for UART1
#define INT_NO_PWMX       11        // interrupt number for PWM1/2
#define INT_NO_GPIO       12        // interrupt number for GPIO
#define INT_NO_WDOG       13        // interrupt number for watch-dog timer

/* Special Program Space */
#define DATA_FLASH_ADDR   0xC000    // start address of Data-Flash
#define BOOT_LOAD_ADDR    0x3800    // start address of boot loader program
#define ROM_CFG_ADDR      0x3FF8    // chip configuration information address
#define ROM_CHIP_ID_HX    0x3FFA    // chip ID number highest byte (only low byte valid)
#define ROM_CHIP_ID_LO    0x3FFC    // chip ID number low word
#define ROM_CHIP_ID_HI    0x3FFE    // chip ID number high word


/*----- USB constant and structure define --------------------------------*/

/* USB PID */
#ifndef USB_PID_SETUP
#define USB_PID_NULL            0x00    /* reserved PID */
#define USB_PID_SOF             0x05
#define USB_PID_SETUP           0x0D
#define USB_PID_IN              0x09
#define USB_PID_OUT             0x01
#define USB_PID_ACK             0x02
#define USB_PID_NAK             0x0A
#define USB_PID_STALL           0x0E
#define USB_PID_DATA0           0x03
#define USB_PID_DATA1           0x0B
#define USB_PID_PRE             0x0C
#endif

/* USB standard device request code */
#ifndef USB_GET_DESCRIPTOR
#define USB_GET_STATUS          0x00
#define USB_CLEAR_FEATURE       0x01
#define USB_SET_FEATURE         0x03
#define USB_SET_ADDRESS         0x05
#define USB_GET_DESCRIPTOR      0x06
#define USB_SET_DESCRIPTOR      0x07
#define USB_GET_CONFIGURATION   0x08
#define USB_SET_CONFIGURATION   0x09
#define USB_GET_INTERFACE       0x0A
#define USB_SET_INTERFACE       0x0B
#define USB_SYNCH_FRAME         0x0C
#endif

/* USB hub class request code */
#ifndef HUB_GET_DESCRIPTOR
#define HUB_GET_STATUS          0x00
#define HUB_CLEAR_FEATURE       0x01
#define HUB_GET_STATE           0x02
#define HUB_SET_FEATURE         0x03
#define HUB_GET_DESCRIPTOR      0x06
#define HUB_SET_DESCRIPTOR      0x07
#endif

/* USB HID class request code */
#ifndef HID_GET_REPORT
#define HID_GET_REPORT          0x01
#define HID_GET_IDLE            0x02
#define HID_GET_PROTOCOL        0x03
#define HID_SET_REPORT          0x09
#define HID_SET_IDLE            0x0A
#define HID_SET_PROTOCOL        0x0B
#endif

/* Bit define for USB request type */
#ifndef USB_REQ_TYP_MASK
#define USB_REQ_TYP_IN          0x80            /* control IN, device to host */
#define USB_REQ_TYP_OUT         0x00            /* control OUT, host to device */
#define USB_REQ_TYP_READ        0x80            /* control read, device to host */
#define USB_REQ_TYP_WRITE       0x00            /* control write, host to device */
#define USB_REQ_TYP_MASK        0x60            /* bit mask of request type */
#define USB_REQ_TYP_STANDARD    0x00
#define USB_REQ_TYP_CLASS       0x20
#define USB_REQ_TYP_VENDOR      0x40
#define USB_REQ_TYP_RESERVED    0x60
#define USB_REQ_RECIP_MASK      0x1F            /* bit mask of request recipient */
#define USB_REQ_RECIP_DEVICE    0x00
#define USB_REQ_RECIP_INTERF    0x01
#define USB_REQ_RECIP_ENDP      0x02
#define USB_REQ_RECIP_OTHER     0x03
#endif

/* USB request type for hub class request */
#ifndef HUB_GET_HUB_DESCRIPTOR
#define HUB_CLEAR_HUB_FEATURE   0x20
#define HUB_CLEAR_PORT_FEATURE  0x23
#define HUB_GET_BUS_STATE       0xA3
#define HUB_GET_HUB_DESCRIPTOR  0xA0
#define HUB_GET_HUB_STATUS      0xA0
#define HUB_GET_PORT_STATUS     0xA3
#define HUB_SET_HUB_DESCRIPTOR  0x20
#define HUB_SET_HUB_FEATURE     0x20
#define HUB_SET_PORT_FEATURE    0x23
#endif

/* Hub class feature selectors */
#ifndef HUB_PORT_RESET
#define HUB_C_HUB_LOCAL_POWER   0
#define HUB_C_HUB_OVER_CURRENT  1
#define HUB_PORT_CONNECTION     0
#define HUB_PORT_ENABLE         1
#define HUB_PORT_SUSPEND        2
#define HUB_PORT_OVER_CURRENT   3
#define HUB_PORT_RESET          4
#define HUB_PORT_POWER          8
#define HUB_PORT_LOW_SPEED      9
#define HUB_C_PORT_CONNECTION   16
#define HUB_C_PORT_ENABLE       17
#define HUB_C_PORT_SUSPEND      18
#define HUB_C_PORT_OVER_CURRENT 19
#define HUB_C_PORT_RESET        20
#endif

/* USB descriptor type */
#ifndef USB_DESCR_TYP_DEVICE
#define USB_DESCR_TYP_DEVICE    0x01
#define USB_DESCR_TYP_CONFIG    0x02
#define USB_DESCR_TYP_STRING    0x03
#define USB_DESCR_TYP_INTERF    0x04
#define USB_DESCR_TYP_ENDP      0x05
#define USB_DESCR_TYP_QUALIF    0x06
#define USB_DESCR_TYP_SPEED     0x07
#define USB_DESCR_TYP_OTG       0x09
#define USB_DESCR_TYP_HID       0x21
#define USB_DESCR_TYP_REPORT    0x22
#define USB_DESCR_TYP_PHYSIC    0x23
#define USB_DESCR_TYP_CS_INTF   0x24
#define USB_DESCR_TYP_CS_ENDP   0x25
#define USB_DESCR_TYP_HUB       0x29
#endif

/* USB device class */
#ifndef USB_DEV_CLASS_HUB
#define USB_DEV_CLASS_RESERVED  0x00
#define USB_DEV_CLASS_AUDIO     0x01
#define USB_DEV_CLASS_COMMUNIC  0x02
#define USB_DEV_CLASS_HID       0x03
#define USB_DEV_CLASS_MONITOR   0x04
#define USB_DEV_CLASS_PHYSIC_IF 0x05
#define USB_DEV_CLASS_POWER     0x06
#define USB_DEV_CLASS_PRINTER   0x07
#define USB_DEV_CLASS_STORAGE   0x08
#define USB_DEV_CLASS_HUB       0x09
#define USB_DEV_CLASS_VEN_SPEC  0xFF
#endif

/* USB endpoint type and attributes */
#ifndef USB_ENDP_TYPE_MASK
#define USB_ENDP_DIR_MASK       0x80
#define USB_ENDP_ADDR_MASK      0x0F
#define USB_ENDP_TYPE_MASK      0x03
#define USB_ENDP_TYPE_CTRL      0x00
#define USB_ENDP_TYPE_ISOCH     0x01
#define USB_ENDP_TYPE_BULK      0x02
#define USB_ENDP_TYPE_INTER     0x03
#endif

#ifndef USB_DEVICE_ADDR
#define	USB_DEVICE_ADDR			0x02	/* 默认的USB设备地址 */
#endif
#ifndef DEFAULT_ENDP0_SIZE
#define DEFAULT_ENDP0_SIZE      8       /* default maximum packet size for endpoint 0 */
#endif
#ifndef MAX_PACKET_SIZE
#define MAX_PACKET_SIZE         64      /* maximum packet size */
#endif
#ifndef USB_BO_CBW_SIZE
#define USB_BO_CBW_SIZE			0x1F	/* 命令块CBW的总长度 */
#define USB_BO_CSW_SIZE			0x0D	/* 命令状态块CSW的总长度 */
#endif
#ifndef USB_BO_CBW_SIG0
#define USB_BO_CBW_SIG0         0x55    /* 命令块CBW识别标志'USBC' */
#define USB_BO_CBW_SIG1         0x53
#define USB_BO_CBW_SIG2         0x42
#define USB_BO_CBW_SIG3         0x43
#define USB_BO_CSW_SIG0         0x55    /* 命令状态块CSW识别标志'USBS' */
#define USB_BO_CSW_SIG1         0x53
#define USB_BO_CSW_SIG2         0x42
#define USB_BO_CSW_SIG3         0x53
#endif


/*----- USB related -----------------------------------------*/

typedef struct _USB_SETUP_REQ {
    UINT8 bRequestType;
    UINT8 bRequest;
    UINT8 wValueL;
    UINT8 wValueH;
    UINT8 wIndexL;
    UINT8 wIndexH;
    UINT8 wLengthL;
    UINT8 wLengthH;
} USB_SETUP_REQ, *PUSB_SETUP_REQ;
typedef USB_SETUP_REQ __xdata *PXUSB_SETUP_REQ;

typedef struct _USB_DEVICE_DESCR {
    UINT8 bLength;
    UINT8 bDescriptorType;
    UINT8 bcdUSBL;
    UINT8 bcdUSBH;
    UINT8 bDeviceClass;
    UINT8 bDeviceSubClass;
    UINT8 bDeviceProtocol;
    UINT8 bMaxPacketSize0;
    UINT8 idVendorL;
    UINT8 idVendorH;
    UINT8 idProductL;
    UINT8 idProductH;
    UINT8 bcdDeviceL;
    UINT8 bcdDeviceH;
    UINT8 iManufacturer;
    UINT8 iProduct;
    UINT8 iSerialNumber;
    UINT8 bNumConfigurations;
} USB_DEV_DESCR, *PUSB_DEV_DESCR;
typedef USB_DEV_DESCR __xdata *PXUSB_DEV_DESCR;

typedef struct _USB_CONFIG_DESCR {
    UINT8 bLength;
    UINT8 bDescriptorType;
    UINT8 wTotalLengthL;
    UINT8 wTotalLengthH;
    UINT8 bNumInterfaces;
    UINT8 bConfigurationValue;
    UINT8 iConfiguration;
    UINT8 bmAttributes;
    UINT8 MaxPower;
} USB_CFG_DESCR, *PUSB_CFG_DESCR;
typedef USB_CFG_DESCR __xdata *PXUSB_CFG_DESCR;

typedef struct _USB_INTERF_DESCR {
    UINT8 bLength;
    UINT8 bDescriptorType;
    UINT8 bInterfaceNumber;
    UINT8 bAlternateSetting;
    UINT8 bNumEndpoints;
    UINT8 bInterfaceClass;
    UINT8 bInterfaceSubClass;
    UINT8 bInterfaceProtocol;
    UINT8 iInterface;
} USB_ITF_DESCR, *PUSB_ITF_DESCR;
typedef USB_ITF_DESCR __xdata *PXUSB_ITF_DESCR;

typedef struct _USB_ENDPOINT_DESCR {
    UINT8 bLength;
    UINT8 bDescriptorType;
    UINT8 bEndpointAddress;
    UINT8 bmAttributes;
    UINT8 wMaxPacketSizeL;
    UINT8 wMaxPacketSizeH;
    UINT8 bInterval;
} USB_ENDP_DESCR, *PUSB_ENDP_DESCR;
typedef USB_ENDP_DESCR __xdata *PXUSB_ENDP_DESCR;

typedef struct _USB_CONFIG_DESCR_LONG {
    USB_CFG_DESCR   cfg_descr;
    USB_ITF_DESCR   itf_descr;
    USB_ENDP_DESCR  endp_descr[1];
} USB_CFG_DESCR_LONG, *PUSB_CFG_DESCR_LONG;
typedef USB_CFG_DESCR_LONG __xdata *PXUSB_CFG_DESCR_LONG;

typedef struct _USB_HUB_DESCR {
    UINT8 bDescLength;
    UINT8 bDescriptorType;
    UINT8 bNbrPorts;
    UINT8 wHubCharacteristicsL;
    UINT8 wHubCharacteristicsH;
    UINT8 bPwrOn2PwrGood;
    UINT8 bHubContrCurrent;
    UINT8 DeviceRemovable;
    UINT8 PortPwrCtrlMask;
} USB_HUB_DESCR, *PUSB_HUB_DESCR;
typedef USB_HUB_DESCR __xdata *PXUSB_HUB_DESCR;

typedef struct _USB_HID_DESCR {
    UINT8 bLength;
    UINT8 bDescriptorType;
    UINT8 bcdHIDL;
    UINT8 bcdHIDH;
    UINT8 bCountryCode;
    UINT8 bNumDescriptors;
    UINT8 bDescriptorTypeX;
    UINT8 wDescriptorLengthL;
    UINT8 wDescriptorLengthH;
} USB_HID_DESCR, *PUSB_HID_DESCR;
typedef USB_HID_DESCR __xdata *PXUSB_HID_DESCR;

typedef struct _UDISK_BOC_CBW {         /* command of BulkOnly USB-FlashDisk */
    UINT8 mCBW_Sig0;
    UINT8 mCBW_Sig1;
    UINT8 mCBW_Sig2;
    UINT8 mCBW_Sig3;
    UINT8 mCBW_Tag0;
    UINT8 mCBW_Tag1;
    UINT8 mCBW_Tag2;
    UINT8 mCBW_Tag3;
    UINT8 mCBW_DataLen0;
    UINT8 mCBW_DataLen1;
    UINT8 mCBW_DataLen2;
    UINT8 mCBW_DataLen3;                /* uppest byte of data length, always is 0 */
    UINT8 mCBW_Flag;                    /* transfer direction and etc. */
    UINT8 mCBW_LUN;
    UINT8 mCBW_CB_Len;                  /* length of command block */
    UINT8 mCBW_CB_Buf[16];              /* command block buffer */
} UDISK_BOC_CBW, *PUDISK_BOC_CBW;
typedef UDISK_BOC_CBW __xdata *PXUDISK_BOC_CBW;

typedef struct _UDISK_BOC_CSW {         /* status of BulkOnly USB-FlashDisk */
    UINT8 mCSW_Sig0;
    UINT8 mCSW_Sig1;
    UINT8 mCSW_Sig2;
    UINT8 mCSW_Sig3;
    UINT8 mCSW_Tag0;
    UINT8 mCSW_Tag1;
    UINT8 mCSW_Tag2;
    UINT8 mCSW_Tag3;
    UINT8 mCSW_Residue0;                /* return: remainder bytes */
    UINT8 mCSW_Residue1;
    UINT8 mCSW_Residue2;
    UINT8 mCSW_Residue3;                /* uppest byte of remainder length, always is 0 */
    UINT8 mCSW_Status;                  /* return: result status */
} UDISK_BOC_CSW, *PUDISK_BOC_CSW;
typedef UDISK_BOC_CSW __xdata *PXUDISK_BOC_CSW;

#endif // __CH552_SDCC_H__