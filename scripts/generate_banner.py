import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

WIDTH = 1280
HEIGHT = 640

# 1. Base Dark Canvas
base = Image.new("RGBA", (WIDTH, HEIGHT), (12, 14, 18, 255))
glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow)

# Ambient Backglows
# Left hero visualizer emerald glow
glow_draw.ellipse((-80, -60, 680, 680), fill=(16, 185, 129, 45))
# Right side typography glow
glow_draw.ellipse((650, 40, 1200, 580), fill=(30, 215, 96, 25))
# Deep subtle violet accent glow
glow_draw.ellipse((850, -80, 1380, 450), fill=(139, 92, 246, 25))

glow = glow.filter(ImageFilter.GaussianBlur(90))
base = Image.alpha_composite(base, glow)

# Helper: rounded card with crisp border and deep drop shadow
def create_card(img, size, radius=18, border_color=(255, 255, 255, 35), border_width=2):
    img = img.resize(size, Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", size, 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, size[0], size[1]), radius, fill=255)

    border_img = Image.new("RGBA", size, (0, 0, 0, 0))
    border_draw = ImageDraw.Draw(border_img)
    border_draw.rounded_rectangle(
        (border_width//2, border_width//2, size[0] - border_width//2, size[1] - border_width//2),
        radius,
        outline=border_color,
        width=border_width
    )

    card = Image.composite(img, Image.new("RGBA", size, (0, 0, 0, 0)), mask)
    card = Image.alpha_composite(card, border_img)

    # Shadow
    shadow_pad = 40
    shadow_size = (size[0] + shadow_pad * 2, size[1] + shadow_pad * 2)
    shadow = Image.new("RGBA", shadow_size, (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.rounded_rectangle(
        (shadow_pad - 2, shadow_pad + 12, shadow_pad + size[0] + 2, shadow_pad + size[1] + 18),
        radius + 4,
        fill=(0, 0, 0, 200)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    shadow.paste(card, (shadow_pad, shadow_pad), card)
    return shadow, shadow_pad

# Load screenshots
turntable_img = Image.open("docs/screenshots/02_turntable.png")
coverflow_img = Image.open("docs/screenshots/03_coverflow.png")
vinyl_img = Image.open("docs/screenshots/06_vinyl_2d.png")

# Left Collage
card_tt, pad_tt = create_card(turntable_img, (470, 280), radius=18, border_color=(30, 215, 96, 85), border_width=2)
card_cf, pad_cf = create_card(coverflow_img, (485, 290), radius=18, border_color=(255, 255, 255, 45), border_width=2)
card_vn, pad_vn = create_card(vinyl_img, (220, 220), radius=110, border_color=(16, 185, 129, 120), border_width=3)

base.paste(card_tt, (55 - pad_tt, 50 - pad_tt), card_tt)
base.paste(card_cf, (135 - pad_cf, 305 - pad_cf), card_cf)
base.paste(card_vn, (475 - pad_vn, 365 - pad_vn), card_vn)

# 2. Right Side: Logo, Typography & High-Contrast Chips
draw = ImageDraw.Draw(base)

font_title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 64)
font_subtitle = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 22)
font_desc = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 16)
font_chip = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 14)
font_badge = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 13)

text_x = 680

# Insert Official High-Res AudioHub App Icon
logo_path = "docs/audiohub-logo.png"
if os.path.exists(logo_path):
    logo_img = Image.open(logo_path).convert("RGBA")
    logo_img = logo_img.resize((72, 72), Image.Resampling.LANCZOS)
    
    # Shadow for logo
    logo_shadow = Image.new("RGBA", (102, 102), (0, 0, 0, 0))
    ls_draw = ImageDraw.Draw(logo_shadow)
    ls_draw.rounded_rectangle((12, 14, 90, 92), radius=22, fill=(0, 0, 0, 180))
    logo_shadow = logo_shadow.filter(ImageFilter.GaussianBlur(10))
    base.paste(logo_shadow, (text_x - 15, 85 - 15), logo_shadow)
    base.paste(logo_img, (text_x, 85), logo_img)

# Version Pill Badge next to logo
badge_x = text_x + 88
badge_y = 105
draw.rounded_rectangle((badge_x, badge_y, badge_x + 115, badge_y + 32), radius=16, fill=(139, 92, 246, 50), outline=(192, 132, 252, 220), width=1)
draw.text((badge_x + 14, badge_y + 7), "v0.1.0 ALPHA", font=font_badge, fill=(243, 232, 255, 255))

# Title: AudioHub
title_y = 175
draw.text((text_x + 2, title_y + 2), "AudioHub", font=font_title, fill=(0, 0, 0, 180))
draw.text((text_x, title_y), "AudioHub", font=font_title, fill=(255, 255, 255, 255))

# Emerald Subtitle
sub_y = title_y + 80
draw.text((text_x, sub_y), "Sovereign Homelab Audio Ecosystem", font=font_subtitle, fill=(30, 215, 96, 255))

# Description Lines
desc_y = sub_y + 40
desc_lines = [
    "High-fidelity streaming, multi-device synchronized handoff,",
    "Three.js 3D vinyl turntable, Apple Cover Flow crate digging,",
    "100% offline QR sharing, and Subsonic API compatibility."
]
for i, line in enumerate(desc_lines):
    draw.text((text_x, desc_y + i * 24), line, font=font_desc, fill=(209, 213, 219, 255))

# High-Contrast Readable Chips (Dark solid backgrounds with bright text and colored neon borders)
chip_y = desc_y + len(desc_lines) * 24 + 32
chips = [
    ("🎛️ 3D Vinyl Engine", (18, 26, 22, 245), (30, 215, 96, 220), (255, 255, 255, 255)),
    ("📱 Subsonic REST", (32, 22, 14, 245), (249, 115, 22, 220), (255, 255, 255, 255)),
    ("🐳 Docker Ready", (16, 24, 38, 245), (59, 130, 246, 220), (255, 255, 255, 255)),
    ("🔒 100% Offline QR", (26, 18, 36, 245), (168, 85, 247, 220), (255, 255, 255, 255)),
]

curr_cx = text_x
row2_cy = chip_y + 42
for idx, (c_text, bg_col, border_col, text_col) in enumerate(chips):
    bbox = font_chip.getbbox(c_text)
    cw = (bbox[2] - bbox[0]) + 26
    cy = chip_y if idx < 2 else row2_cy
    if idx == 2:
        curr_cx = text_x
    # Draw solid high-contrast chip with colored neon border
    draw.rounded_rectangle((curr_cx, cy, curr_cx + cw, cy + 34), radius=17, fill=bg_col, outline=border_col, width=2)
    draw.text((curr_cx + 13, cy + 7), c_text, font=font_chip, fill=text_col)
    curr_cx += cw + 14

# Subtle Bottom Emerald Glow Line
draw.line([(0, HEIGHT - 2), (WIDTH, HEIGHT - 2)], fill=(30, 215, 96, 100), width=2)

output_path = "docs/banner.png"
base.convert("RGB").save(output_path, "PNG", quality=95)
print(f"High-contrast banner with real logo saved to {output_path}")
