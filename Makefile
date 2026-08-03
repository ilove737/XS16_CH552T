# CH552 USB 键盘/鼠标项目 Makefile
# 使用 SDCC (Small Device C Compiler) 在 Linux 下编译
# xs16：单键盘，无左右手区分

# 输出目录
OUTDIR = build

# 编译器设置
CC      = sdcc
AS      = sdas8051
OBJCOPY = objcopy
PACKIHX = packihx

# 目标微控制器
MCU = XS16_CH552T
TARGET = XS16_CH552T

# 基础编译选项
CFLAGS  = -mmcs51
CFLAGS += --xram-loc 0x0000 --xram-size 0x0400 --code-size 0x3800
CFLAGS += --iram-size 256

# 源文件（位于 src/ 目录）
SOURCES_C := main.c \
             CompositeKM.C \
             Debug.C \
             Timer.C \
             GPIO.C \
             UART1.C \
             DataFlash.C \
             FlashWrite.c \
             scanKey.c

# 目标文件列表（不含目录路径）
OBJECTS_C := $(SOURCES_C:.c=.rel)
OBJECTS_C := $(OBJECTS_C:.C=.rel)

# ============================================================================
# 编译规则
# ============================================================================

# 编译 .c 文件（源位于 src/）
$(OUTDIR)/%.rel: src/%.c | $(OUTDIR)
	$(CC) $(CFLAGS) -c $< -o $@

# 编译 .C 文件（大写扩展名，源位于 src/）
$(OUTDIR)/%.rel: src/%.C | $(OUTDIR)
	$(CC) $(CFLAGS) -c $< -o $@

# 链接生成 hex 固件
$(OUTDIR)/$(TARGET).hex: $(addprefix $(OUTDIR)/,$(OBJECTS_C))
	$(CC) $(CFLAGS) -o $(OUTDIR)/$(TARGET).ihx $(addprefix $(OUTDIR)/,$(OBJECTS_C))
	$(PACKIHX) $(OUTDIR)/$(TARGET).ihx > $@

# 创建输出目录
$(OUTDIR):
	mkdir -p $@

# ============================================================================
# 顶层目标
# ============================================================================

all: $(OUTDIR)/$(TARGET).hex

clean:
	rm -rf $(OUTDIR)

install-deps:
	sudo apt-get update
	sudo apt-get install sdcc

flash: all
	wchisp flash $(OUTDIR)/$(TARGET).hex

info:
	@echo "编译 $(TARGET)，目标芯片 CH552"
	@echo "源文件: $(SOURCES_C)"
	@echo "输出目录: $(OUTDIR)/"
	@echo "SDCC 版本: $(shell sdcc -v 2>&1 | head -n1)"

.PHONY: all clean install-deps flash info
