#!/usr/bin/env python3
"""
Delphi Realms — tradition-accurate symbol data + procedural drawing.

Design principle: don't trust an AI (or a system font) to render sacred
structure. Derive every symbol from its actual defining data and draw it
as vector geometry, so it is correct by construction.

  I Ching  -> 6-bit King Wen line pattern (bottom-to-top, yang=solid, yin=broken)
  Runes    -> Elder Futhark stroke coordinates, in aett order Fehu..Othala
  Orisha   -> diloggun: N cowrie shells "mouth up" out of 16 (the actual cast)
  Tarot    -> suit + rank structure (pip layout) for the Minors; Majors are art-led

This module is imported by label_deck.py. It exposes, per realm:
  NAMES[realm]         ordered list of card titles
  draw_symbol(realm, i, draw, cx, cy, size, gold, ink)  # paints symbol i

Colors passed in so the deck stays on-palette (gold on indigo).
"""

from PIL import ImageDraw

GOLD = (233, 214, 168)
INK = (12, 8, 24)

# =====================================================================
# I CHING — King Wen sequence as 6-bit patterns, read BOTTOM to TOP.
# 1 = yang (solid line), 0 = yin (broken line). Bit order: index 0 = bottom line.
# These are the canonical King Wen line figures.
# =====================================================================

# each entry: bottom line first ... top line last
ICHING_LINES = [
    "111111","000000","100010","010001","111010","010111","010000","000010",
    "111011","110111","111000","000111","101111","111101","001000","000100",
    "100110","011001","110000","000011","100101","101001","000001","100000",
    "100111","111001","100001","011110","010010","101101","001110","011100",
    "001111","111100","000101","101000","101011","110101","001010","010100",
    "110001","100011","111110","011111","000110","011000","010110","011010",
    "101110","011101","100100","001001","001011","110100","001101","101100",
    "110110","011011","110010","010011","110011","001100","101010","010101",
]

ICHING_NAMES = [
    "1 · The Creative", "2 · The Receptive", "3 · Difficulty at the Beginning",
    "4 · Youthful Folly", "5 · Waiting", "6 · Conflict", "7 · The Army",
    "8 · Holding Together", "9 · Small Taming", "10 · Treading",
    "11 · Peace", "12 · Standstill", "13 · Fellowship", "14 · Great Possession",
    "15 · Modesty", "16 · Enthusiasm", "17 · Following", "18 · Work on the Decayed",
    "19 · Approach", "20 · Contemplation", "21 · Biting Through", "22 · Grace",
    "23 · Splitting Apart", "24 · Return", "25 · Innocence", "26 · Great Taming",
    "27 · Nourishment", "28 · Great Preponderance", "29 · The Abysmal",
    "30 · The Clinging", "31 · Influence", "32 · Duration", "33 · Retreat",
    "34 · Great Power", "35 · Progress", "36 · Darkening of the Light",
    "37 · The Family", "38 · Opposition", "39 · Obstruction", "40 · Deliverance",
    "41 · Decrease", "42 · Increase", "43 · Breakthrough", "44 · Coming to Meet",
    "45 · Gathering Together", "46 · Pushing Upward", "47 · Oppression",
    "48 · The Well", "49 · Revolution", "50 · The Cauldron", "51 · The Arousing",
    "52 · Keeping Still", "53 · Development", "54 · The Marrying Maiden",
    "55 · Abundance", "56 · The Wanderer", "57 · The Gentle", "58 · The Joyous",
    "59 · Dispersion", "60 · Limitation", "61 · Inner Truth",
    "62 · Small Preponderance", "63 · After Completion", "64 · Before Completion",
]


def draw_hexagram(draw, cx, cy, size, gold, ink, pattern):
    """Draw a 6-line hexagram centered at (cx, cy). size = total height."""
    n = 6
    gap = size / (n * 1.7)
    lw = size / (n * 1.4)               # line thickness
    full = size * 0.62                  # full line width
    brk = full * 0.30                   # gap in a broken (yin) line
    top = cy - size / 2
    # pattern index 0 is the BOTTOM line -> draw from bottom up
    for row in range(n):
        bit = pattern[row]
        y = (top + size) - (row + 0.5) * (size / n)
        if bit == "1":
            draw.rounded_rectangle(
                [cx - full/2, y - lw/2, cx + full/2, y + lw/2],
                radius=lw/2, fill=gold)
        else:
            draw.rounded_rectangle(
                [cx - full/2, y - lw/2, cx - brk/2, y + lw/2],
                radius=lw/2, fill=gold)
            draw.rounded_rectangle(
                [cx + brk/2, y - lw/2, cx + full/2, y + lw/2],
                radius=lw/2, fill=gold)


# =====================================================================
# RUNES — Elder Futhark, aett order Fehu..Othala (24).
# Each rune = list of strokes; each stroke = list of (x,y) in a unit box
# where x in [0,1] (left..right), y in [0,1] (top..bottom). Vertical
# staves are the classic straight forms.
# =====================================================================

RUNE_NAMES = [
    "Fehu · f", "Uruz · u", "Thurisaz · th", "Ansuz · a", "Raidho · r",
    "Kenaz · k", "Gebo · g", "Wunjo · w",                       # Freyr's aett
    "Hagalaz · h", "Nauthiz · n", "Isa · i", "Jera · j",
    "Eihwaz · ei", "Perthro · p", "Algiz · z", "Sowilo · s",    # Heimdall's aett
    "Tiwaz · t", "Berkano · b", "Ehwaz · e", "Mannaz · m",
    "Laguz · l", "Ingwaz · ng", "Dagaz · d", "Othala · o",      # Tyr's aett
]

# stroke sets in unit coordinates (0,0)=top-left, (1,1)=bottom-right
RUNE_STROKES = [
    # Fehu ᚠ
    [[(0.3,0),(0.3,1)],[(0.3,0.15),(0.85,0.0)],[(0.3,0.5),(0.85,0.35)]],
    # Uruz ᚢ
    [[(0.25,1),(0.25,0.1),(0.75,0.35)],[(0.75,0.35),(0.75,1)]],
    # Thurisaz ᚦ
    [[(0.3,0),(0.3,1)],[(0.3,0.28),(0.7,0.5),(0.3,0.72)]],
    # Ansuz ᚨ
    [[(0.3,0),(0.3,1)],[(0.3,0.15),(0.8,0.35)],[(0.3,0.45),(0.8,0.65)]],
    # Raidho ᚱ
    [[(0.3,0),(0.3,1)],[(0.3,0.05),(0.75,0.28),(0.3,0.5)],[(0.42,0.5),(0.8,1)]],
    # Kenaz ᚲ
    [[(0.75,0.05),(0.3,0.5),(0.75,0.95)]],
    # Gebo ᚷ (X)
    [[(0.2,0.05),(0.8,0.95)],[(0.8,0.05),(0.2,0.95)]],
    # Wunjo ᚹ
    [[(0.3,0),(0.3,1)],[(0.3,0.05),(0.75,0.2),(0.3,0.45)]],
    # Hagalaz ᚺ
    [[(0.25,0),(0.25,1)],[(0.75,0),(0.75,1)],[(0.25,0.4),(0.75,0.6)]],
    # Nauthiz ᚾ
    [[(0.3,0),(0.3,1)],[(0.15,0.65),(0.85,0.35)]],
    # Isa ᛁ
    [[(0.5,0),(0.5,1)]],
    # Jera ᛃ (two interlocking hooks)
    [[(0.55,0.05),(0.8,0.3),(0.55,0.5)],[(0.45,0.5),(0.2,0.7),(0.45,0.95)]],
    # Eihwaz ᛇ
    [[(0.5,0),(0.5,1)],[(0.5,0.1),(0.8,0.0)],[(0.5,0.9),(0.2,1.0)]],
    # Perthro ᛈ
    [[(0.3,0),(0.3,1)],[(0.3,0.05),(0.75,0.05)],[(0.75,0.05),(0.75,0.35)],[(0.75,0.35),(0.3,0.4)]],
    # Algiz ᛉ
    [[(0.5,0.25),(0.5,1)],[(0.5,0.25),(0.15,0.0)],[(0.5,0.25),(0.85,0.0)]],
    # Sowilo ᛊ (lightning)
    [[(0.75,0.05),(0.35,0.35),(0.7,0.55),(0.3,0.9)]],
    # Tiwaz ᛏ (arrow up)
    [[(0.5,0.25),(0.5,1)],[(0.2,0.5),(0.5,0.15),(0.8,0.5)]],
    # Berkano ᛒ
    [[(0.3,0),(0.3,1)],[(0.3,0.05),(0.78,0.25),(0.3,0.5)],[(0.3,0.5),(0.78,0.72),(0.3,0.95)]],
    # Ehwaz ᛖ (M-like)
    [[(0.22,1),(0.22,0.0)],[(0.78,1),(0.78,0.0)],[(0.22,0.1),(0.5,0.5),(0.78,0.1)]],
    # Mannaz ᛗ
    [[(0.2,0),(0.2,1)],[(0.8,0),(0.8,1)],[(0.2,0.1),(0.5,0.55),(0.8,0.1)],[(0.2,0.1),(0.8,0.55)],[(0.8,0.1),(0.2,0.55)]],
    # Laguz ᛚ
    [[(0.35,0),(0.35,1)],[(0.35,0.05),(0.75,0.3)]],
    # Ingwaz ᛜ (diamond)
    [[(0.5,0.15),(0.8,0.5),(0.5,0.85),(0.2,0.5),(0.5,0.15)]],
    # Dagaz ᛞ (bowtie/hourglass X-box)
    [[(0.2,0.1),(0.2,0.9)],[(0.8,0.1),(0.8,0.9)],[(0.2,0.1),(0.8,0.9)],[(0.2,0.9),(0.8,0.1)]],
    # Othala ᛟ
    [[(0.5,0.1),(0.78,0.35),(0.5,0.6),(0.22,0.35),(0.5,0.1)],[(0.5,0.6),(0.32,0.95)],[(0.5,0.6),(0.68,0.95)]],
]


def draw_rune(draw, cx, cy, size, gold, ink, strokes):
    """Draw a rune from unit-box strokes, centered at (cx, cy)."""
    lw = max(2, int(size * 0.055))
    x0 = cx - size / 2
    y0 = cy - size / 2
    def P(pt):
        return (x0 + pt[0] * size, y0 + pt[1] * size)
    for stroke in strokes:
        pts = [P(p) for p in stroke]
        draw.line(pts, fill=gold, width=lw, joint="curve")
        for p in pts:                      # round the joints/ends
            r = lw / 2
            draw.ellipse([p[0]-r, p[1]-r, p[0]+r, p[1]+r], fill=gold)


# =====================================================================
# ORISHA — diloggun. The 16 principal odu correspond to N shells landing
# "mouth up" (1..16). We render the actual cast: N open cowries + (16-N)
# closed, arranged in the traditional grid on the mat.
# =====================================================================

ORISHA_NAMES = [
    "1 · Okana", "2 · Eji Oko", "3 · Ogunda", "4 · Irosun", "5 · Oche",
    "6 · Obara", "7 · Odi", "8 · Eji Ogbe", "9 · Osa", "10 · Ofun",
    "11 · Owani", "12 · Ejila Shebora", "13 · Metanla", "14 · Merinla",
    "15 · Marunla", "16 · Merindilogun",
]


def draw_cowrie(draw, cx, cy, r, gold, ink, mouth_up):
    """A single cowrie shell. mouth_up=True shows the toothed 'open mouth'."""
    if mouth_up:
        # bright shell, dark slit with serrations (the divining face)
        draw.ellipse([cx-r, cy-r*1.35, cx+r, cy+r*1.35], fill=gold)
        draw.line([cx, cy-r*0.9, cx, cy+r*0.9], fill=ink, width=max(2, int(r*0.28)))
        # little teeth
        teeth = 4
        for i in range(teeth):
            ty = cy - r*0.7 + i*(r*1.4/(teeth-1))
            draw.line([cx-r*0.22, ty, cx+r*0.22, ty], fill=ink, width=max(1,int(r*0.12)))
    else:
        # closed back: dim outline only
        draw.ellipse([cx-r, cy-r*1.35, cx+r, cy+r*1.35],
                     outline=gold, width=max(1, int(r*0.18)))
        draw.ellipse([cx-r*0.45, cy-r*0.6, cx+r*0.45, cy+r*0.6],
                     outline=gold, width=max(1, int(r*0.10)))


def draw_odu(draw, cx, cy, size, gold, ink, n_up):
    """Cast of 16 cowries in a 4x4 mat; n_up shells are mouth-up."""
    cols, rows = 4, 4
    r = size * 0.085
    spacing = size / 4.3
    gx = cx - spacing * (cols - 1) / 2
    gy = cy - spacing * (rows - 1) / 2
    idx = 0
    for row in range(rows):
        for col in range(cols):
            x = gx + col * spacing
            y = gy + row * spacing
            draw_cowrie(draw, x, y, r, gold, ink, idx < n_up)
            idx += 1


# =====================================================================
# TAROT — structure only. Majors are art-led (no drawn symbol, just the
# title band). Minors get a clean pip layout by suit so the 56 are
# internally consistent even before custom art.
# =====================================================================

_MAJORS = [
    "The Fool", "The Magician", "The High Priestess", "The Empress",
    "The Emperor", "The Hierophant", "The Lovers", "The Chariot",
    "Strength", "The Hermit", "Wheel of Fortune", "Justice",
    "The Hanged Man", "Death", "Temperance", "The Devil",
    "The Tower", "The Star", "The Moon", "The Sun",
    "Judgement", "The World",
]
_RANKS = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven",
          "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King"]
_SUITS = ["Wands", "Cups", "Swords", "Pentacles"]

TAROT_NAMES = list(_MAJORS)
for _s in _SUITS:
    for _r in _RANKS:
        TAROT_NAMES.append(f"{_r} of {_s}")


def draw_suit_glyph(draw, cx, cy, r, gold, ink, suit):
    if suit == "Wands":
        draw.line([cx, cy-r, cx, cy+r], fill=gold, width=max(2,int(r*0.35)))
        draw.ellipse([cx-r*0.5, cy-r*1.3, cx+r*0.5, cy-r*0.4], outline=gold, width=max(2,int(r*0.22)))
    elif suit == "Cups":
        draw.arc([cx-r, cy-r*0.7, cx+r, cy+r*0.9], 0, 180, fill=gold, width=max(2,int(r*0.3)))
        draw.line([cx, cy+r*0.8, cx, cy+r*1.2], fill=gold, width=max(2,int(r*0.3)))
        draw.line([cx-r*0.5, cy+r*1.2, cx+r*0.5, cy+r*1.2], fill=gold, width=max(2,int(r*0.3)))
    elif suit == "Swords":
        draw.line([cx, cy-r*1.2, cx, cy+r*0.8], fill=gold, width=max(2,int(r*0.3)))
        draw.line([cx-r*0.6, cy+r*0.4, cx+r*0.6, cy+r*0.4], fill=gold, width=max(2,int(r*0.3)))
    else:  # Pentacles
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], outline=gold, width=max(2,int(r*0.2)))
        pts = []
        import math
        for i in range(5):
            a = -math.pi/2 + i * 4*math.pi/5   # 5-pointed star
            pts.append((cx + r*0.8*math.cos(a), cy + r*0.8*math.sin(a)))
        draw.line(pts + [pts[0]], fill=gold, width=max(2,int(r*0.16)))


def draw_tarot(draw, cx, cy, size, gold, ink, index):
    """Majors: no drawn symbol (art-led). Minors: suit glyph."""
    if index < 22:
        return  # major arcana — leave the art to speak
    minor = index - 22
    suit = _SUITS[minor // 14]
    r = size * 0.16
    draw_suit_glyph(draw, cx, cy, r, gold, ink, suit)


# =====================================================================
# PUBLIC DISPATCH
# =====================================================================

NAMES = {
    "tarot": TAROT_NAMES,
    "iching": ICHING_NAMES,
    "runes": RUNE_NAMES,
    "orisha": ORISHA_NAMES,
}


def draw_symbol(realm, i, draw, cx, cy, size, gold=GOLD, ink=INK):
    if realm == "iching":
        draw_hexagram(draw, cx, cy, size, gold, ink, ICHING_LINES[i])
    elif realm == "runes":
        draw_rune(draw, cx, cy, size, gold, ink, RUNE_STROKES[i])
    elif realm == "orisha":
        draw_odu(draw, cx, cy, size, gold, ink, i + 1)   # odu k = k shells up
    elif realm == "tarot":
        draw_tarot(draw, cx, cy, size, gold, ink, i)


if __name__ == "__main__":
    # sanity: counts + a contact sheet of every symbol
    from PIL import Image, ImageDraw as _D
    for r, ns in NAMES.items():
        print(f"{r:8} {len(ns)}")
    for realm in ["iching", "runes", "orisha"]:
        ns = NAMES[realm]
        cols = 8
        rows = (len(ns) + cols - 1) // cols
        cell = 150
        img = Image.new("RGB", (cols*cell, rows*cell), (18, 10, 34))
        d = _D.Draw(img)
        for i in range(len(ns)):
            cx = (i % cols)*cell + cell//2
            cy = (i // cols)*cell + cell//2
            draw_symbol(realm, i, d, cx, cy, cell*0.62)
        img.save(f"/tmp/sheet_{realm}.png")
        print("wrote", f"/tmp/sheet_{realm}.png")
