#!/usr/bin/env bash
set -euo pipefail

# 神田事務所サイト用 動画フレーム抽出スクリプト
# 使い方:
#   1. videos/kanda-office-demo.mp4 を配置
#   2. bash scripts/extract-kanda-office-frames.sh
#   3. bun scripts/seed-kanda-office-frames.ts

INPUT="${KANDA_VIDEO:-videos/kanda-office-demo.mp4}"
OUTDIR="public/generated-frames/kanda-office"
FPS="${KANDA_FPS:-1/3}" # 3秒に1枚

if [[ ! -f "$INPUT" ]]; then
  echo "input video not found: $INPUT" >&2
  exit 1
fi

mkdir -p "$OUTDIR"
rm -f "$OUTDIR"/*.jpg

ffmpeg -y -i "$INPUT" -vf "fps=${FPS}" "$OUTDIR/frame-%03d.jpg"

echo "extracted to $OUTDIR"
ls "$OUTDIR" | wc -l | awk '{print $1" frames"}'
