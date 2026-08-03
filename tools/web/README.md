# XS16_CH552T 键位映射编辑器 (WebHID)

基于 WebHID 的 XS16 键盘键位配置工具，无需安装驱动或后端服务。

## 使用方式

### 本地使用（推荐）

```bash
./serve-app.sh
```

自动启动 HTTP 服务并用 Chrome 应用模式打开编辑器。

### 远程使用（HTTPS 必需）

Chrome 的 WebHID API 需要安全上下文（HTTPS 或 localhost）。远程访问时需配置 HTTPS：

```bash
# 1. 安装 mkcert
sudo apt install libnss3-tools
wget https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v1.4.4-linux-amd64
chmod +x mkcert-v1.4.4-linux-amd64
sudo mv mkcert-v1.4.4-linux-amd64 /usr/local/bin/mkcert
mkcert -install

# 2. 为域名生成证书
mkcert 你的域名

# 3. 启动 HTTPS 服务
./serve-app.sh --https 你的域名
```

浏览器访问 `https://你的域名:8000`。

### 手动启动

```bash
# HTTP（仅 localhost 可用）
python3 -m http.server 8000

# HTTPS（远程可用）
python3 -c "
import http.server, ssl
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(certfile='域名.pem', keyfile='域名-key.pem')
httpd = http.server.HTTPServer(('0.0.0.0', 8000), http.server.SimpleHTTPRequestHandler)
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
httpd.serve_forever()
"
```

## 功能说明

- **16 键网格**：主编辑区，显示当前层的键位映射
- **104 键盘图**：编辑弹窗中的可视化按键选择器，支持点击选择键位
- **按键捕获**：编辑弹窗中自动捕获物理键盘按键，联动 104 键盘图高亮
- **组合键支持**：修饰键（Ctrl/Shift/Alt/Win）点击切换复选框，支持组合键选择
- **鼠标动作**：Fn0 层支持鼠标动作（左键/右键/移动/滚轮）
- **导入导出**：支持 `.txt`（可读格式）和 `.bin`（原始二进制）格式

## 文件结构

```
tools/web/
├── index.html       # 主页面
├── app.js           # 主逻辑（UI 控制、网格渲染、编辑弹窗、设备通信）
├── keymap.js        # 键码表、修饰符、布局数据、解析/格式化
├── hid.js           # WebHID 通信层
├── capture.js       # 键盘按键捕获
├── styles.css       # 样式
├── serve-app.sh     # 一键启动脚本（支持 HTTP/HTTPS）
├── manifest.json    # PWA 清单
├── icon.svg         # 应用图标
└── README.md        # 本文件
```

## 浏览器兼容性

需要 Chrome 89+ 或 Edge 89+，支持 WebHID API。