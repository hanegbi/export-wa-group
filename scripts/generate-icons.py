"""Generates the extension's toolbar/store icons (16/48/128px PNGs).

Design: a WhatsApp-green chat bubble with a negative-space "W" (the
letter is the background green showing through a cutout in the white
bubble), plus a small pair of overlapping avatar dots to signal "group".

Draws at high resolution and downsamples for crisp edges at every size.
Run with: python scripts/generate-icons.py
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ACCENT = (37, 211, 102, 255)  # #25d366, matches the popup's --accent
WHITE = (255, 255, 255, 255)

RENDER_SIZE = 512
OUTPUT_SIZES = (16, 48, 128)
OUT_DIR = Path(__file__).resolve().parent.parent / "icons"
FONT_PATH = "C:/Windows/Fonts/arialbd.ttf"


def rounded_square(size, radius_ratio, fill):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=size * radius_ratio, fill=fill
    )
    return layer


def draw_bubble(draw, box, tail_side="left"):
    """A rounded rectangle with a small speech-bubble tail at the bottom."""
    x0, y0, x1, y1 = box
    radius = (x1 - x0) * 0.30
    draw.rounded_rectangle(box, radius=radius, fill=WHITE)

    tail_w = (x1 - x0) * 0.16
    tail_h = (y1 - y0) * 0.14
    if tail_side == "left":
        tx = x0 + (x1 - x0) * 0.22
        draw.polygon(
            [(tx, y1 - radius * 0.4), (tx + tail_w, y1 - radius * 0.4), (tx - tail_w * 0.35, y1 + tail_h)],
            fill=WHITE,
        )
    else:
        tx = x1 - (x1 - x0) * 0.22
        draw.polygon(
            [(tx - tail_w, y1 - radius * 0.4), (tx, y1 - radius * 0.4), (tx + tail_w * 0.35, y1 + tail_h)],
            fill=WHITE,
        )


def draw_group_dots(draw, cx, cy, r):
    """Two overlapping avatar-style circles, reading as 'a group'."""
    back_center = (cx - r * 0.55, cy - r * 0.15)
    front_center = (cx + r * 0.45, cy + r * 0.35)

    def circle(center, radius, fill):
        draw.ellipse(
            [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius],
            fill=fill,
        )

    circle(back_center, r, WHITE)
    circle(front_center, r * 1.18, ACCENT)  # gap/halo cut into the back circle
    circle(front_center, r, WHITE)


def draw_icon():
    img = rounded_square(RENDER_SIZE, 0.22, ACCENT)
    draw = ImageDraw.Draw(img)

    bubble_box = (
        RENDER_SIZE * 0.14,
        RENDER_SIZE * 0.10,
        RENDER_SIZE * 0.86,
        RENDER_SIZE * 0.62,
    )
    draw_bubble(draw, bubble_box, tail_side="left")

    # Negative-space "W": drawn in the background's own green, so the
    # bubble reads as cut open where the letter sits.
    font = ImageFont.truetype(FONT_PATH, int(RENDER_SIZE * 0.34))
    bx0, by0, bx1, by1 = bubble_box
    bcx, bcy = (bx0 + bx1) / 2, (by0 + by1) / 2 - RENDER_SIZE * 0.01
    text_bbox = draw.textbbox((0, 0), "W", font=font)
    tw, th = text_bbox[2] - text_bbox[0], text_bbox[3] - text_bbox[1]
    draw.text(
        (bcx - tw / 2 - text_bbox[0], bcy - th / 2 - text_bbox[1]),
        "W",
        font=font,
        fill=ACCENT,
    )

    draw_group_dots(draw, RENDER_SIZE * 0.755, RENDER_SIZE * 0.775, RENDER_SIZE * 0.115)

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
