"""Finishes a raw browser screenshot of icons/icon-source.html into the
extension's toolbar/store icons (16/48/128px PNGs).

icon-source.html renders the icon using real icon-package glyphs
(Feather Icons, MIT licensed: "message-circle" and "users") on a
512x512 canvas via Chrome's own SVG rendering. A screenshot of that
page has an opaque white background, so this script crops it to the
512x512 icon square and masks the corners to match the CSS
border-radius, making everything outside the rounded square
transparent — then downsamples for each output size.

Run with: python scripts/finish-icon.py <path-to-raw-screenshot.png>
"""

import sys
from pathlib import Path
from PIL import Image, ImageDraw

RENDER_SIZE = 512
CORNER_RADIUS = 112  # must match icon-source.html's border-radius
OUTPUT_SIZES = (16, 48, 128)
OUT_DIR = Path(__file__).resolve().parent.parent / "icons"


def main():
    if len(sys.argv) != 2:
        print("Usage: python scripts/finish-icon.py <path-to-raw-screenshot.png>")
        sys.exit(1)

    raw = Image.open(sys.argv[1]).convert("RGBA")
    cropped = raw.crop((0, 0, RENDER_SIZE, RENDER_SIZE))

    mask = Image.new("L", (RENDER_SIZE, RENDER_SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, RENDER_SIZE - 1, RENDER_SIZE - 1], radius=CORNER_RADIUS, fill=255
    )
    cropped.putalpha(mask)

    OUT_DIR.mkdir(exist_ok=True)
    for size in OUTPUT_SIZES:
        resized = cropped.resize((size, size), Image.LANCZOS)
        out_path = OUT_DIR / f"icon{size}.png"
        resized.save(out_path)
        print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
