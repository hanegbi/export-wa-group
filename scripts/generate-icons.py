"""Generates the extension's toolbar/store icons (16/48/128px PNGs).

Draws at high resolution and downsamples for crisp edges at every size.
Run with: python scripts/generate-icons.py
"""

from pathlib import Path
from PIL import Image, ImageDraw

ACCENT = (37, 211, 102, 255)  # #25d366, matches the popup's --accent
GLYPH = (255, 255, 255, 255)

RENDER_SIZE = 512
OUTPUT_SIZES = (16, 48, 128)
OUT_DIR = Path(__file__).resolve().parent.parent / "icons"


def draw_icon():
    img = Image.new("RGBA", (RENDER_SIZE, RENDER_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    corner_radius = RENDER_SIZE * 0.22
    draw.rounded_rectangle(
        [0, 0, RENDER_SIZE - 1, RENDER_SIZE - 1],
        radius=corner_radius,
        fill=ACCENT,
    )

    # Download glyph: a downward arrow into a tray, echoing the popup's
    # download icon so the toolbar icon and in-app iconography match.
    cx = RENDER_SIZE / 2
    stroke = RENDER_SIZE * 0.075

    shaft_top = RENDER_SIZE * 0.24
    shaft_bottom = RENDER_SIZE * 0.56
    draw.line([(cx, shaft_top), (cx, shaft_bottom)], fill=GLYPH, width=int(stroke))

    arrow_half = RENDER_SIZE * 0.16
    arrow_tip_y = shaft_bottom + RENDER_SIZE * 0.09
    draw.line(
        [(cx - arrow_half, shaft_bottom - RENDER_SIZE * 0.03), (cx, arrow_tip_y)],
        fill=GLYPH,
        width=int(stroke),
        joint="curve",
    )
    draw.line(
        [(cx + arrow_half, shaft_bottom - RENDER_SIZE * 0.03), (cx, arrow_tip_y)],
        fill=GLYPH,
        width=int(stroke),
        joint="curve",
    )

    tray_y = RENDER_SIZE * 0.74
    tray_half = RENDER_SIZE * 0.22
    draw.line(
        [(cx - tray_half, tray_y), (cx + tray_half, tray_y)],
        fill=GLYPH,
        width=int(stroke),
        joint="curve",
    )

    return img


def main():
    OUT_DIR.mkdir(exist_ok=True)
    master = draw_icon()
    for size in OUTPUT_SIZES:
        resized = master.resize((size, size), Image.LANCZOS)
        out_path = OUT_DIR / f"icon{size}.png"
        resized.save(out_path)
        print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
