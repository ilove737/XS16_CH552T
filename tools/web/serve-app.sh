#!/usr/bin/env bash
# 一键启动 XS16 WebHID 配置工具
# 用法:
#   ./serve-app.sh              # HTTP 模式 (localhost 可用)
#   ./serve-app.sh --https 域名  # HTTPS 模式 (远程访问可用)
#
# HTTPS 模式需要先安装 mkcert:
#   sudo apt install libnss3-tools
#   wget https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v1.4.4-linux-amd64
#   chmod +x mkcert-v1.4.4-linux-amd64 && sudo mv mkcert-v1.4.4-linux-amd64 /usr/local/bin/mkcert
#   mkcert -install
#   mkcert 你的域名
set -euo pipefail

PORT="${XS16_WEB_PORT:-8000}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

HTTPS_MODE=false
DOMAIN=""

if [ "${1:-}" = "--https" ]; then
  HTTPS_MODE=true
  DOMAIN="${2:-}"
  if [ -z "$DOMAIN" ]; then
    echo "用法: $0 --https 域名" >&2
    exit 1
  fi
  CERT="${DOMAIN}.pem"
  KEY="${DOMAIN}-key.pem"
  if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
    echo "未找到证书文件 $CERT / $KEY，请先执行: mkcert $DOMAIN" >&2
    exit 1
  fi
fi

if [ "$HTTPS_MODE" = false ]; then
  # HTTP 模式
  if curl -s -o /dev/null "http://localhost:$PORT/" 2>/dev/null; then
    echo "检测到 http://localhost:$PORT 已在运行，直接打开。"
  else
    python3 -m http.server "$PORT" &
    SERVER_PID=$!
    trap "kill $SERVER_PID 2>/dev/null || true" EXIT INT TERM
    for _ in $(seq 1 30); do
      curl -s -o /dev/null "http://localhost:$PORT/" 2>/dev/null && break
      sleep 0.3
    done
  fi
  URL="http://localhost:$PORT/"
else
  # HTTPS 模式
  URL="https://$DOMAIN:$PORT/"
  if curl -sk -o /dev/null "$URL" 2>/dev/null; then
    echo "检测到 $URL 已在运行，直接打开。"
  else
    python3 -c "
import http.server, ssl, os
os.chdir('$DIR')
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(certfile='$CERT', keyfile='$KEY')
httpd = http.server.HTTPServer(('0.0.0.0', $PORT), http.server.SimpleHTTPRequestHandler)
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
httpd.serve_forever()
" &
    SERVER_PID=$!
    trap "kill $SERVER_PID 2>/dev/null || true" EXIT INT TERM
    for _ in $(seq 1 30); do
      curl -sk -o /dev/null "$URL" 2>/dev/null && break
      sleep 0.3
    done
  fi
fi

# 选择浏览器
if command -v google-chrome >/dev/null 2>&1; then
  BROWSER=google-chrome
elif command -v chromium >/dev/null 2>&1; then
  BROWSER=chromium
elif command -v chromium-browser >/dev/null 2>&1; then
  BROWSER=chromium-browser
else
  echo "未找到 Chrome/Chromium，请手动在浏览器打开 $URL"
  xdg-open "$URL" 2>/dev/null || true
  echo "按 Ctrl+C 停止服务"
  wait
fi

echo "正在以应用模式打开 $URL（关闭窗口后按 Ctrl+C 退出后台服务）"
"$BROWSER" --app="$URL" &
wait
