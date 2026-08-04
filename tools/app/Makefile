# =============================================================================
# XS16_CH552T 键位映射编辑器 - 构建 Makefile
#
# 提供两类产物：
#   1. web  前端 bundle（dist/bundle.js + index.html + styles.css）
#   2. tauri 桌面应用安装包（src-tauri/target/release/bundle/）
# =============================================================================

# ---- 工具检测 ----
NPM       ?= npm
NODE      ?= node
ESBUILD   := npx esbuild@0.21.5
CARGO     ?= cargo

# ---- 目录 / 文件 ----
SRC_DIR    := src
DIST_DIR   := dist
TAURI_DIR  := src-tauri

# 前端 bundle 入口与产物
FRONT_ENTRY := $(SRC_DIR)/app.js
BUNDLE_OUT  := $(DIST_DIR)/bundle.js
HTML_OUT    := $(DIST_DIR)/index.html
CSS_OUT     := $(DIST_DIR)/styles.css

# 前端源码依赖（任一更新则重新打包）
FRONT_SRC := $(SRC_DIR)/app.js \
             $(SRC_DIR)/ipc-hid.js \
             $(SRC_DIR)/keymap.js \
             $(SRC_DIR)/capture.js

# 桌面应用 release bundle 目录与可执行文件
BUNDLE_DIR := $(TAURI_DIR)/target/release/bundle
APP_BIN    := $(TAURI_DIR)/target/release/xs16keymap

.PHONY: all web app dev run clean help

all: web

# ---- 前端 bundle 构建 ----
web: $(BUNDLE_OUT) $(HTML_OUT) $(CSS_OUT)

$(BUNDLE_OUT): $(FRONT_SRC)
	@echo ">> 构建前端 bundle: $@"
	$(ESBUILD) $(FRONT_ENTRY) --bundle --format=iife --outfile=$@

$(HTML_OUT): $(SRC_DIR)/index.html
	@echo ">> 复制 index.html -> $(DIST_DIR)/"
	cp $(SRC_DIR)/index.html $(DIST_DIR)/

$(CSS_OUT): $(SRC_DIR)/styles.css
	@echo ">> 复制 styles.css -> $(DIST_DIR)/"
	cp $(SRC_DIR)/styles.css $(DIST_DIR)/

# ---- 桌面应用构建（Tauri 安装包） ----
app: web
	@echo ">> 构建 Tauri 桌面应用安装包..."
	cd $(TAURI_DIR) && $(CARGO) build --release

# ---- 开发模式 ----
dev:
	@echo ">> 启动 Tauri 开发模式..."
	cd $(TAURI_DIR) && $(CARGO) dev

# ---- 运行已构建的产物 ----
# 若 release 二进制不存在，先编译再运行。
run: web $(APP_BIN)
	@echo ">> 运行 $(APP_BIN)"
	$(APP_BIN)

# release 二进制构建（依赖前端 bundle 已就绪）
$(APP_BIN): $(BUNDLE_OUT) $(HTML_OUT) $(CSS_OUT)
	@echo ">> 编译 Tauri release 二进制..."
	cd $(TAURI_DIR) && $(CARGO) build --release
	@touch $@

# ---- 清理 ----
clean:
	@echo ">> 清理 dist/ 构建产物"
	rm -rf $(DIST_DIR)
	@echo ">> 清理 Rust target/ 构建产物"
	rm -rf $(TAURI_DIR)/target

# ---- 帮助 ----
help:
	@echo "可用目标:"
	@echo "  make         构建前端 bundle（= make web）"
	@echo "  make web     仅构建前端 bundle（dist/）"
	@echo "  make app     构建桌面应用安装包（含前端 bundle）"
	@echo "  make dev     启动 Tauri 开发模式"
	@echo "  make run     编译并运行 release 产物（若已编译则直接运行）"
	@echo "  make clean   清理所有构建产物"
	@echo "  make help    显示本帮助"
