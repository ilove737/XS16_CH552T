#!/usr/bin/env python3
"""
生成 XS16 键位映射编辑器图标 (4x4 键盘按键布局)。

输出:
  - icon.svg         矢量源文件 (512x512)
渲染 (需 rsvg-convert + ImageMagick `convert`) 由各尺寸 PNG 与 icon.ico 由下方 render() 完成。

用法:
  python3 gen_icon.py            # 生成 icon.svg 并渲染全部 PNG/ICO
  python3 gen_icon.py --key 100 --gap 8
"""
import argparse
import subprocess
import os

# 4x4 键帽上的字符
KEYS = [
    ["X", "S", "1", "6"],
    ["L", "X", "S", "%"],
    ["@", "W", "Z", "H"],
    ["♥️", "L", "G", "Z"],
]
# 高亮键帽坐标 (row, col)，使用品牌青色
HI = {(0, 0), (1, 2), (2, 3), (3, 1)}

BASE = 512          # 画布尺寸
BOARD_MARGIN = 16   # 底板到画布边缘
BOARD_RX = 64       # 底板圆角
RX = 18             # 键帽圆角
FONT = 48           # 字号


def build_svg(key: int, gap: int) -> str:
    grid = 4 * key + 3 * gap
    off = BOARD_MARGIN + (BASE - 2 * BOARD_MARGIN - grid) // 2  # 居中的起始偏移

    def cx(c):
        return off + c * (key + gap)

    def cy(r):
        return off + r * (key + gap)

    rects, texts = [], []
    for r in range(4):
        for c in range(4):
            x, y = cx(c), cy(r)
            fill = "url(#keyHi)" if (r, c) in HI else "url(#key)"
            rects.append(
                f'      <rect x="{x}" y="{y}" width="{key}" height="{key}" rx="{RX}" fill="{fill}"/>'
            )
            ch = KEYS[r][c]
            tcol = "#0c3b35" if (r, c) in HI else "#3a4658"
            texts.append(
                f'      <text x="{x + key / 2:.1f}" y="{y + key / 2 + 16:.1f}" '
                f'font-size="{FONT}" fill="{tcol}">{ch}</text>'
            )

    return f'''<svg width="{BASE}" height="{BASE}" viewBox="0 0 {BASE} {BASE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="board" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b3a55"/>
      <stop offset="1" stop-color="#1b2536"/>
    </linearGradient>
    <linearGradient id="key" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8edf5"/>
      <stop offset="1" stop-color="#c2ccdb"/>
    </linearGradient>
    <linearGradient id="keyHi" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4fd1c5"/>
      <stop offset="1" stop-color="#2bb3a3"/>
    </linearGradient>
  </defs>

  <rect x="{BOARD_MARGIN}" y="{BOARD_MARGIN}" width="{BASE - 2 * BOARD_MARGIN}" height="{BASE - 2 * BOARD_MARGIN}" rx="{BOARD_RX}" ry="{BOARD_RX}" fill="url(#board)"/>

  <g font-family="Arial, 'Segoe UI', sans-serif" font-weight="700" text-anchor="middle">
{chr(10).join(rects)}
{chr(10).join(texts)}
  </g>
</svg>
'''


# 渲染后会被删除的中间尺寸 (Tauri 仅引用 icon.png + icon.ico)
_INTERMEDIATE_SIZES = [1024, 512, 256, 128, 64, 48, 32, 16]


def render():
    """用 rsvg-convert 与 ImageMagick 渲染 PNG 与 ICO，并清理冗余中间文件。"""
    sizes = list(_INTERMEDIATE_SIZES)
    for s in sizes:
        subprocess.run(
            ["rsvg-convert", "-w", str(s), "-h", str(s), "icon.svg", "-o", f"{s}x{s}.png"],
            check=True,
        )
    # 512 与 1024 作为发布母版 (从中间产物复制后随即清理)
    subprocess.run(["cp", "512x512.png", "icon.png"], check=True)
    subprocess.run(["cp", "1024x1024.png", "icon_1024.png"], check=True)
    # ICO: 不超过 256
    ico_src = [f"{s}x{s}.png" for s in [256, 128, 64, 48, 32, 16]]
    subprocess.run(["convert", *ico_src, "icon.ico"], check=True)
    # 清理全部中间尺寸 PNG，只保留 Tauri 引用的资源
    for s in sizes:
        f = f"{s}x{s}.png"
        if os.path.exists(f):
            os.remove(f)
    print("已清理中间尺寸 PNG，仅保留 icon.png / icon_1024.png / icon.ico / icon.svg")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", type=int, default=100, help="键帽尺寸 (默认 100)")
    ap.add_argument("--gap", type=int, default=8, help="键帽间距 (默认 8)")
    ap.add_argument("--no-render", action="store_true", help="只生成 SVG，不渲染 PNG/ICO")
    args = ap.parse_args()

    svg = build_svg(args.key, args.gap)
    with open("icon.svg", "w") as f:
        f.write(svg)
    print(f"icon.svg 生成完成 (key={args.key}, gap={args.gap})")

    if not args.no_render:
        render()
        print("PNG / ICO 渲染完成")


if __name__ == "__main__":
    main()
