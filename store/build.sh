#!/usr/bin/env bash
# Renders every store image into store/images/ with headless Chrome.
# Run from the repo root in Git Bash:  bash store/build.sh
set -euo pipefail

CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
PORT=8766
OUT="store/images"
mkdir -p "$OUT"

python -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 1

shoot() { # name width height query
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$2,$3" --virtual-time-budget=4000 \
    --screenshot="$(pwd -W 2>/dev/null || pwd)/$OUT/$1.png" \
    "http://127.0.0.1:$PORT/store/shot.html?$4" >/dev/null 2>&1
  echo "$1"
}

for style in paper deep context; do
  for scene in ready range running list file; do
    shoot "screenshot-$style-$scene" 1280 800 "kind=screenshot&scene=$scene&style=$style"
  done
done
for style in paper deep lines; do
  shoot "tile-$style" 440 280 "kind=tile&style=$style"
  shoot "marquee-$style" 1400 560 "kind=marquee&style=$style"
done
