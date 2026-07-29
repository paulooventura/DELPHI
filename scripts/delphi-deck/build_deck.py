#!/usr/bin/env python3
"""
Delphi Deck Builder — tradition-accurate, legible, uniform.

Combines two things text-to-image can't do reliably:
  1. the SYMBOL  — drawn as vector geometry from each tradition's real
     structure (realms.py): King Wen hexagrams, Elder Futhark runes,
     diloggun cowrie casts. Correct by construction.
  2. the TITLE   — composited in a real font, identical placement.

Two modes:

  --mode overlay   Put art in ./art/<realm>/ (wordless Midjourney output).
                   The builder stamps the accurate symbol + title band on
                   top. Use for I Ching / Runes / Orisha so the sacred
                   figure is exact, not AI-hallucinated. Also fine for Tarot.

  --mode generate  No art needed. Builds complete cards on a deep-indigo
                   starfield background with the drawn symbol + title.
                   Instant, uniform, ships a working oracle today; swap to
                   overlay per-realm later as art comes in.

USAGE
  python build_deck.py --realm iching --mode generate --out ./out/iching
  python build_deck.py --realm runes  --mode overlay  --art ./art/runes --out ./out/runes
  python build_deck.py --all --mode generate --out ./out
"""

import argparse
import math
import os
import random
import re
import sys

from PIL import Image, ImageDraw, ImageFont
import realms

# ---- palette -------------------------------------------------------
BG_TOP = (36, 21, 70)
BG_BOT = (6, 3, 16)
GOLD = (233, 214, 168)
GOLD_DIM = (150, 128, 86)
INK = (12, 8, 24)

CARD_W, CARD_H = 800, 1200
IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def natural_key(s):
    return [int(t) if t.isdigit() else t.lower()
            for t in re.split(r"(\d+)", s)]


def find_font(preferred):
    cands = []
    if preferred:
        cands += [preferred, os.path.join(os.path.dirname(__file__), preferred)]
    cands += [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
    ]
    for c in cands:
        if c and os.path.exists(c):
            return c
    return None


def starfield(w, h, seed):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / h
        r = int(BG_TOP[0]*(1-t) + BG_BOT[0]*t)
        g = int(BG_TOP[1]*(1-t) + BG_BOT[1]*t)
        b = int(BG_TOP[2]*(1-t) + BG_BOT[2]*t)
        for x in range(w):
            px[x, y] = (r, g, b)
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for _ in range(int(w*h/2600)):
        x, y = rnd.randint(0, w-1), rnd.randint(0, h-1)
        rad = rnd.choice([0, 0, 1, 1, 2])
        op = rnd.randint(90, 235)
        c = rnd.choice([(255,255,255), (220,205,255), (255,240,205)])
        d.ellipse([x, y, x+rad, y+rad],
                  fill=(int(c[0]*op/255), int(c[1]*op/255), int(c[2]*op/255)))
    return img


def draw_frame(draw, w, h):
    m = int(w*0.055)
    draw.rectangle([m, m, w-m, h-m], outline=GOLD_DIM, width=2)
    inm = m + 10
    draw.rectangle([inm, inm, w-inm, h-inm], outline=(GOLD_DIM[0]//2+20,
                   GOLD_DIM[1]//2+20, GOLD_DIM[2]//2+20), width=1)


def tracked_width(draw, text, font, sp):
    return sum(draw.textlength(c, font=font)+sp for c in text) - sp


def draw_tracked(draw, xy, text, font, fill, sp):
    x, y = xy
    for c in text:
        draw.text((x, y), c, font=font, fill=fill)
        x += draw.textlength(c, font=font) + sp


def fit_font(draw, text, fp, start, floor, max_w, sp):
    s = start
    while s >= floor:
        f = ImageFont.truetype(fp, s)
        if tracked_width(draw, text, f, sp) <= max_w:
            return f
        s -= 2
    return ImageFont.truetype(fp, floor)


def add_title(img, title, font_path, subtitle=None):
    W, H = img.size
    d = ImageDraw.Draw(img, "RGBA")
    band_h = int(H*0.135)
    d.rectangle([0, H-band_h, W, H], fill=(INK[0], INK[1], INK[2], 205))
    d.line([0, H-band_h, W, H-band_h], fill=(GOLD[0], GOLD[1], GOLD[2], 130), width=2)
    text = title.upper()
    sp = 3
    font = fit_font(d, text, font_path, int(H*0.048), int(H*0.030),
                    int(W*0.86), sp)
    tw = tracked_width(d, text, font, sp)
    ty = (H-band_h) + band_h*(0.22 if subtitle else 0.32)
    draw_tracked(d, ((W-tw)/2, ty), text, font, GOLD+(255,), sp)
    if subtitle:
        sf = ImageFont.truetype(font_path, int(H*0.024))
        sw = d.textlength(subtitle, font=sf)
        d.text(((W-sw)/2, ty+font.size*1.2), subtitle, font=sf,
               fill=(GOLD_DIM[0], GOLD_DIM[1], GOLD_DIM[2], 230))
    return img


def build_card(realm, i, title, mode, art_path, font_path, out_path):
    if mode == "generate":
        img = starfield(CARD_W, CARD_H, seed=hash((realm, i)) & 0xffff)
        d = ImageDraw.Draw(img)
        draw_frame(d, CARD_W, CARD_H)
        # soft aura behind the symbol
        cx, cy = CARD_W//2, int(CARD_H*0.40)
        for rr, op in [(230, 22), (170, 30), (110, 40)]:
            d.ellipse([cx-rr, cy-rr, cx+rr, cy+rr],
                      fill=(60, 40, 110))  # subtle; layered
        img = img.convert("RGB")
        d = ImageDraw.Draw(img)
        draw_frame(d, CARD_W, CARD_H)
        sym_size = CARD_H*0.30
        realms.draw_symbol(realm, i, d, cx, cy, sym_size)
    else:
        img = Image.open(art_path).convert("RGB")
        img = img.resize((CARD_W, CARD_H))
        d = ImageDraw.Draw(img)
        # for the three structured realms, stamp the exact figure over the art
        if realm in ("iching", "runes", "orisha"):
            cx, cy = CARD_W//2, int(CARD_H*0.40)
            realms.draw_symbol(realm, i, d, cx, cy, CARD_H*0.26)

    img = add_title(img, title, font_path)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path, quality=94)


def collect_art(art_dir):
    fs = [f for f in os.listdir(art_dir)
          if os.path.splitext(f)[1].lower() in IMG_EXTS]
    fs.sort(key=natural_key)
    return fs


def process(realm, mode, art_dir, out_dir, font_path, dry):
    names = realms.NAMES[realm]
    art = collect_art(art_dir) if mode == "overlay" else [None]*len(names)
    print(f"\n[{realm}] {len(names)} cards, mode={mode}")
    for i, title in enumerate(names):
        ap = os.path.join(art_dir, art[i]) if (mode == "overlay" and i < len(art)) else None
        if mode == "overlay" and ap is None:
            print(f"  ! no art for {title}"); continue
        slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
        out = os.path.join(out_dir, f"{i+1:02d}_{slug}.jpg")
        print(f"  {i+1:>2}. {title}")
        if not dry:
            build_card(realm, i, title, mode, ap, font_path, out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--realm", choices=list(realms.NAMES))
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--mode", choices=["generate", "overlay"], default="generate")
    ap.add_argument("--art", default="./art")
    ap.add_argument("--out", required=True)
    ap.add_argument("--font", default=None)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    fp = find_font(a.font)
    if not fp:
        sys.exit("No font found. Pass --font path/to/serif.ttf")
    print("font:", fp)

    todo = list(realms.NAMES) if a.all else [a.realm]
    if not a.all and not a.realm:
        sys.exit("Pass --realm <name> or --all")
    for realm in todo:
        art_dir = os.path.join(a.art, realm) if a.all else a.art
        out_dir = os.path.join(a.out, realm) if a.all else a.out
        if a.mode == "overlay" and not os.path.isdir(art_dir):
            print(f"[{realm}] skip — no art dir {art_dir}"); continue
        process(realm, a.mode, art_dir, out_dir, fp, a.dry_run)
    print("\nDone." if not a.dry_run else "\nDry run — nothing written.")


if __name__ == "__main__":
    main()
