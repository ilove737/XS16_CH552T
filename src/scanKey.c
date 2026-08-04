#include "CH552.H"
#include "scanKey.h"
#include "Debug.H"
#include "GPIO.H"
#include "keyMap.h"
#include "CompositeKM.H"

UINT8 allKey[4];       // 当前扫描原始结果
UINT8 stableKey[4];    // 防抖确认后的稳定按键状态
UINT8 debounceBuf[4];  // 防抖缓冲区，保存上一次扫描值
UINT8 debounceCnt[4];  // 每个字节的连续一致计数器（达到阈值才确认稳定）
UINT8 HIDFrames[8];
UINT8 HIDFramesPointer = 2; // 从帧的第三个字节开始添加普通按键的KeyCode
UINT8 HIDFrames0 = 0;

UINT8 mouseBtnDown = 0;  // 鼠标按钮按下状态，0=未按下，1=已按下

/*
 * 鼠标连续移动状态变量
 * mouseDX/mouseDY/mouseDW 存储当前按下的移动/滚轮键的位移量，
 * mouseMoveCnt 是发送节拍计数器，每 MOUSE_MOVE_INTERVAL 个 tick 发送一次。
 * 这些变量在 makeHIDFrames() 中设置，在 scanKeyChange() 中持续发送。
 */
UINT8 mouseDX = 0;       // 鼠标 X 轴位移量（0 = 无移动）
UINT8 mouseDY = 0;       // 鼠标 Y 轴位移量
UINT8 mouseDW = 0;       // 鼠标滚轮位移量
UINT8 mouseMoveCnt = 0;  // 连续移动发送计数器

// 将变量映射到指定的位地址。0xB0~0xB4 对应 P3 口的第 0~4 位（P3.0~P3.4）
__sbit __at (0xB0) row1;
__sbit __at (0xB1) row2;
__sbit __at (0xB2) row3;
__sbit __at (0xB3) row4;
__sbit __at (0xB4) row5;

void initGPIO(void)
{
	// 开漏输入输出，有上拉，内部电路可以加速由低到高的电平爬升	
	Port1Cfg(3, 0);
	Port1Cfg(3, 1);
	Port1Cfg(3, 2);
	Port1Cfg(3, 3);
	Port1Cfg(3, 4);
	// 推挽输入输出
	Port3Cfg(1, 0);
	Port3Cfg(1, 1);
	Port3Cfg(1, 2);
	Port3Cfg(1, 3);
	Port3Cfg(1, 4);
	Port3Cfg(1, 5);
	Port3Cfg(1, 6);
	Port3Cfg(1, 7);
}

/*
 * 生成 USB HID 报告帧并通过端点 1 发送
 *
 * 处理流程：
 *   1. 清零 HID 报告帧
 *   2. 第一轮遍历：检测 Fn 功能键，设置 PCON 标志位（必须在普通键之前）
 *   3. 第二轮遍历：根据当前键位映射（普通/Fn0）生成 HID 键码
 *   4. 通过 USB 端点 1 发送报告
 *
 * 注意：scanKeyChange() 中的防抖逻辑确保只有稳定状态变化时才调用此函数。
 */
void makeHIDFrames(void)
{
    UINT8 i;       // 行索引（0~3，共 4 行）
    UINT8 bit;     // 列索引（0~3，共 4 列）

    /*
     * 步骤 1：清零 HID 报告帧
     * HID 键盘报告格式：8 字节
     *   [0] 修饰键位 (Modifier)
     *   [1] 保留字节 ( Reserved)
     *   [2~7] 普通按键键码 (最多 6 个按键)
     */
    for (i = 0; i < 8; i++)
    {
        HIDFrames[i] = 0;
    }
    HIDFrames0 = 0;          // 修饰键累加器清零
    HIDFramesPointer = 2;    // 普通键码从第 3 字节开始写入

    /*
     * 步骤 2：处理 Fn 功能键
     * Fn 键的键位映射中 [0] = 0xff，[1] = 0/1 表示 Fn0/Fn1。
     * 检测到 Fn 键按下时设置 PCON 中的 GF0/GF1 标志位，
     * 后续步骤 3 将根据这些标志选择对应的键位映射表。
     * 必须在步骤 3 之前完成，因为普通键需要知道当前使用哪个层。
     *
     * 这里将原 FnKey() 函数内联展开，与 AllKey 的处理方式保持一致。
     */
    PCON &= (~GF0); // 清零 Fn0 层标志位
    PCON &= (~GF1); // 清零 Fn1 层标志位
    {
        // Fn 键识别基于当前场景槽的主层键位区（sceneMapTable[currentScene] + 16）
        // 键位格式：[mod, key] 交替；mod == KEY_FnX(0xff) 表示该键是功能键，
        //   key == 0 表示 Fn0 层，key == 1 表示 Fn1 层。
        UINT8 scene = currentScene;
        UINT8C *mainBase = sceneMapTable[scene] + MAP_MAIN_OFF;
        for (i = 0; i < 4; i++)
        {
            if (allKey[i])	// 如果当前行有按键按下
            {
                for (bit = 0; bit < 4; bit++)
                {
                    if (allKey[i] & (1 << bit))
                    {
                        UINT8 idx = i * 4 + bit;
                        if (mainBase[idx * 2] == KEY_FnX)
                        {
                            if (mainBase[idx * 2 + 1] == 0) PCON |= GF0;
                            if (mainBase[idx * 2 + 1] == 1) PCON |= GF1;
                        }
                    }
                }
            }
        }
    }

    /*
     * 步骤 3：处理普通按键
     * 根据当前 Fn 层状态（PCON.GF0/GF1），从对应的键位映射表中
     * 查出 HID 键码和修饰键，填入 HIDFrames。
     *
     * 特殊约定：修饰键字节 = 0xFE 表示该键触发鼠标动作，
     * 此时填充 HIDMouse[4] 并通过端点 2 发送鼠标报告。
     */
    {
        UINT8C *keyMap;       // 指向当前选中的键位映射表（Flash 地址，按 [mod,key] 交替访问）
        UINT8 index;          // 按键索引（0~15）
        UINT8 mod;            // 修饰键位值（0xFE=鼠标动作, KEY_FnX=功能键, 其他=修饰键）
        UINT8 code;           // 按键键码（或鼠标动作码）
        UINT8 mouseClickPressed = 0;  // 本轮扫描是否有鼠标点击键按下

        // 每轮扫描开始时清零连续移动量，之后由按键处理重新赋值
        mouseDX = 0;
        mouseDY = 0;
        mouseDW = 0;

        // 根据 Fn 层状态从当前场景槽（sceneMapTable[currentScene]）取键位表
        // 每槽 80 字节：[0..15]应用名 | [16..47]主层键位 | [48..79]Fn层键位
        {
            UINT8 scene = currentScene;
            UINT8C *slot = sceneMapTable[scene];
            if (PCON & (GF0 | GF1))
            {
                keyMap = slot + MAP_FN_OFF;      // Fn 层
            }
            else
            {
                keyMap = slot + MAP_MAIN_OFF;    // 主层
            }
        }

        for (i = 0; i < 4; i++)
        {
            if (allKey[i])
            {
                for (bit = 0; bit < 4; bit++)
                {
                    if (allKey[i] & (1 << bit))
                    {
                        index = i * 4 + bit;
                        mod = keyMap[index * 2];
                        code = keyMap[index * 2 + 1];

                        if (mod == 0xFE)
                        {
                            /*
                             * 鼠标动作处理分支
                             * 修饰键字节 0xFE 表示该键位映射为鼠标操作，
                             * 键码字节指定具体动作（点击/移动/滚轮）。
                             *
                             * 点击类动作（MOUSE_LCLICK/RCLICK/MCLICK）：
                             *   按下时发送按下报告，松开时发送释放报告，
                             *   确保两次报告分属不同的 USB 帧（主机轮询间隔 10ms）。
                             * 移动/滚轮动作：
                             *   每次触发立即发送一次位移报告。
                             */
                            UINT8 mouseFrame[4] = {0, 0, 0, 0};

                            switch (code)
                            {
                                case MOUSE_LCLICK: mouseFrame[0] |= 0x01; break;
                                case MOUSE_RCLICK: mouseFrame[0] |= 0x02; break;
                                case MOUSE_MCLICK: mouseFrame[0] |= 0x04; break;
                                case MOUSE_UP:     mouseFrame[2] = (UINT8)-5; break;
                                case MOUSE_DOWN:   mouseFrame[2] = 5;    break;
                                case MOUSE_LEFT:   mouseFrame[1] = (UINT8)-5; break;
                                case MOUSE_RIGHT:  mouseFrame[1] = 5;    break;
                                case MOUSE_WHEEL_UP:   mouseFrame[3] = 1;  break;
                                case MOUSE_WHEEL_DN:   mouseFrame[3] = (UINT8)-1; break;
                            }

                            if (code <= MOUSE_MCLICK)
                            {
                                // 点击类动作：只在未按下时发送按下报告
                                mouseClickPressed = 1;
                                if (!mouseBtnDown)
                                {
                                    mouseBtnDown = 1;
                                    Enp2IntInSend(mouseFrame);
                                }
                            }
                            else
                            {
                                /*
                                 * 移动/滚轮动作：将位移量存入全局变量，
                                 * 由 scanKeyChange() 持续发送。
                                 * mouseDX/mouseDY/mouseDW 在每轮循环开始时已清零，
                                 * 此处赋值后将在循环结束后的连续移动逻辑中发送第一帧。
                                 */
                                mouseDX = mouseFrame[1];
                                mouseDY = mouseFrame[2];
                                mouseDW = mouseFrame[3];
                            }
                        }
                        else
                        {
                            // 普通键盘按键处理：修饰键累加 + 键码写入
                            if (mod != KEY_FnX)
                                HIDFrames0 += mod;

                            if (HIDFramesPointer < 8 && code > 0)
                            {
                                HIDFrames[HIDFramesPointer] = code;
                                HIDFramesPointer++;
                            }
                        }
                    }
                }
            }
        }

        /*
         * 鼠标点击释放处理
         * 如果 mouseBtnDown 已置位但本轮没有点击键按下，
         * 说明用户已松开按键，发送释放报告并清除状态。
         * 按下和释放之间至少间隔 6ms 防抖时间 + 按键保持时间，
         * 远超主机 10ms 轮询间隔，确保按下报告能被主机正确接收。
         */
        if (mouseBtnDown && !mouseClickPressed)
        {
            UINT8 releaseFrame[4] = {0, 0, 0, 0};
            Enp2IntInSend(releaseFrame);
            mouseBtnDown = 0;
        }

        /*
         * 鼠标连续移动第一帧发送
         * 当检测到新的移动/滚轮按键按下时（mouseDX/DY/DW 非零），
         * 立即发送第一帧以确保即时响应，同时设置计数器为后续的节拍发送做准备。
         */
        if (mouseDX || mouseDY || mouseDW)
        {
            UINT8 moveFrame[4] = {0, mouseDX, mouseDY, mouseDW};
            Enp2IntInSend(moveFrame);
            mouseMoveCnt = MOUSE_MOVE_INTERVAL;
        }
    }

    /*
     * 步骤 4：发送 HID 报告
     * HIDFrames0 记录了所有修饰键（Ctrl/Shift/Alt/Win）的累加值，
     * 填到帧的第一个字节，然后通过 USB 端点 1 发送。
     */
    HIDFrames[0] = HIDFrames0;
    Enp1IntInSend(HIDFrames);
    // sendKeyHID(HIDFrames);
}
/*
 * 扫描矩阵键盘 + 按键防抖处理
 * 该函数由定时器 T0 中断（每 2ms）调用，执行以下步骤：
 *   1. 逐行拉低 P3.0~P3.4，读取 P1 口列状态，存入 allKey[5]
 *   2. 对每个字节进行防抖处理：
 *      - 若本次采样值与 debounceBuf 一致，递增 debounceCnt
 *      - 若不一致，重置 debounceBuf 和 debounceCnt
 *      - 当 debounceCnt 达到 DEBOUNCE_THRESHOLD 时，将稳定状态
 *        更新到 stableKey，并记录变化标志
 *   3. 只有当 stableKey 有变化时，才调用 makeHIDFrames() 发送 HID 报告
 */
void scanKeyChange(void)
{
    UINT8 i = 0;
    UINT8 changed = 0;  // 稳定状态变化标志

    /*
     * 步骤 1：逐行扫描矩阵键盘
     * 先将 5 行全部拉高，再依次将当前行拉低，
     * 读取 P1 口（8 位列）的状态，取反后存入 allKey。
     */
    for (i = 0; i < 4; i++)
    {
        P3 |= 0x0f;			// 四行全部拉高
		P3 &= (~(1 << i));	// 逐行拉低
		
        allKey[i] = 0;
        allKey[i] |= ~P1;
    }

    /*
     * 步骤 2：对每个字节做防抖确认
     *
     * 防抖原理：连续 N 次（DEBOUNCE_THRESHOLD）采样结果一致，
     * 才认为该字节的按键状态已经稳定，避免触点弹跳导致的误触发。
     *
     * 以定时器 2ms 中断一次为例：
     *   DEBOUNCE_THRESHOLD = 3 → 约 6ms 后确认状态
     *   DEBOUNCE_THRESHOLD = 5 → 约 10ms 后确认状态
     */
    for (i = 0; i < 4; i++)
    {
        if (allKey[i] == debounceBuf[i])
        {
            /*
             * 本次采样与上一次一致：递增计数器
             * 限制最大值防止溢出，同时确保只有达到阈值时才更新
             */
            if (debounceCnt[i] < DEBOUNCE_THRESHOLD)
            {
                debounceCnt[i]++;
            }

            /*
             * 连续采样达到阈值，且与当前稳定状态不同时，
             * 更新稳定状态并标记变化
             */
            if (debounceCnt[i] >= DEBOUNCE_THRESHOLD && stableKey[i] != allKey[i])
            {
                stableKey[i] = allKey[i];
                changed = 1;
            }
        }
        else
        {
            /*
             * 本次采样与上一次不一致：说明可能处于抖动中，
             * 重置缓冲区为当前值，计数器归零，重新开始计数
             */
            debounceBuf[i] = allKey[i];
            debounceCnt[i] = 0;
        }
    }

    /*
     * 步骤 3：只有稳定状态发生变化时，才生成并发送 HID 报告
     * 这比原始代码（每次扫描变化都触发）减少了大量因抖动引起的冗余报告
     */
    if (changed)
        makeHIDFrames();

    /*
     * 步骤 4：鼠标连续移动
     * 当 mouseDX/mouseDY/mouseDW 有非零值时（由 makeHIDFrames() 设置），
     * 每 MOUSE_MOVE_INTERVAL 个 tick 发送一次移动报告，实现按住键持续移动效果。
     *
     * 计数器递减到 0 时发送，然后重置计数器。
     * 当按键松开时，makeHIDFrames() 会将 mouseDX/DY/DW 清零，
     * 此处自然停止发送。
     */
    if (mouseDX || mouseDY || mouseDW)
    {
        if (mouseMoveCnt == 0)
        {
            UINT8 moveFrame[4] = {0, mouseDX, mouseDY, mouseDW};
            Enp2IntInSend(moveFrame);
            mouseMoveCnt = MOUSE_MOVE_INTERVAL;
        }
        else
        {
            mouseMoveCnt--;
        }
    }
}