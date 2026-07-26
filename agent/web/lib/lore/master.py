"""
DELPHI QUALIA — master data, single source of truth.
Generates both qualia.ts and the checking workbook.

Eight axes (−1..+1), each pole a real cross-cultural polarity:
  active—receptive | rising—falling | steady—restless | warm—cool
  outward—inward   | binding—dissolving | gentle—fierce | light—shadow

Tags:
  nature:  computed | birth | cast
  observes: moment | person | both
  claim:   measurement | convention | interpretation
"""

AXES = ["active","rising","steady","warm","outward","binding","gentle","light"]
# +1 pole names for readability in the sheet header
AXIS_POLES = {
  "active":  ("active","receptive"),
  "rising":  ("rising","falling"),
  "steady":  ("steady","restless"),
  "warm":    ("warm","cool"),
  "outward": ("outward","inward"),
  "binding": ("binding","dissolving"),
  "gentle":  ("gentle","fierce"),
  "light":   ("light","shadow"),
}

def E(id, system, name, glyph, qualities, ax, source, claim, nature, observes, observed):
    """ax is a dict of axis->value for the axes that apply; others default 0/absent."""
    return dict(id=id, system=system, name=name, glyph=glyph, qualities=qualities,
                ax=ax, source=source, claim=claim, nature=nature, observes=observes, observed=observed)

DATA = []

# =====================================================================
# CLASSICAL ELEMENTS (root layer — informs the zodiac)
# =====================================================================
DATA += [
 E("el-fire","element","Fire","△",["active","radiant","rising","eager","consuming"],
   {"active":0.9,"rising":0.6,"warm":0.9,"outward":0.6},
   "Aristotelian element theory; 20th-C personality reading","interpretation","computed","moment",
   "Hot + dry — heat that rises and can't be fenced in."),
 E("el-earth","element","Earth","▽",["grounded","enduring","practical","slow","fertile"],
   {"active":-0.5,"steady":0.8,"binding":0.7,"warm":-0.2},
   "Aristotelian element theory; 20th-C personality reading","interpretation","computed","moment",
   "Cold + dry — structure, weight, the regulation of form."),
 E("el-air","element","Air","△̶",["mobile","connective","abstract","restless","communicative"],
   {"active":0.4,"steady":-0.7,"outward":0.3,"binding":-0.3},
   "Aristotelian element theory; 20th-C personality reading","interpretation","computed","moment",
   "Hot + moist — movement, exchange, the space between things."),
 E("el-water","element","Water","▽̶",["flowing","feeling","receptive","deep","dissolving"],
   {"active":-0.8,"warm":-0.5,"outward":-0.6,"binding":-0.7,"gentle":0.4},
   "Aristotelian element theory; 20th-C personality reading","interpretation","computed","moment",
   "Cold + moist — flow that takes the shape of its vessel."),
]

# =====================================================================
# WESTERN TROPICAL ZODIAC (Sun's seasonal position) — element × modality × ruler
# nature computed, observes both (moment = current solar season; person = natal)
# =====================================================================
def wz(id,name,glyph,quals,ax,ruler,elem,mod,observed):
    return E(id,"western-zodiac",name,glyph,quals,ax,
             f"Hellenistic (Ptolemy); {mod} {elem}, {ruler}-ruled","interpretation","computed","both",observed)

DATA += [
 wz("wz-aries","Aries","♈",["initiating","bold","urgent","pioneering","combative"],
    {"active":0.9,"rising":0.7,"steady":-0.3,"warm":0.7,"outward":0.6,"gentle":-0.6,"light":0.4},
    "Mars","Fire","Cardinal","Cardinal fire at spring — the first push, the ram's charge."),
 wz("wz-taurus","Taurus","♉",["steadfast","sensual","patient","enduring","possessive"],
    {"active":-0.4,"steady":0.9,"warm":0.2,"binding":0.7,"gentle":0.4},
    "Venus","Earth","Fixed","Fixed earth — the settled field, slow abundance held."),
 wz("wz-gemini","Gemini","♊",["curious","versatile","quick","communicative","scattered"],
    {"active":0.5,"steady":-0.8,"outward":0.4,"binding":-0.4,"light":0.3},
    "Mercury","Air","Mutable","Mutable air — the twin voices, restless exchange."),
 wz("wz-cancer","Cancer","♋",["nurturing","protective","tidal","sensitive","withdrawing"],
    {"active":-0.5,"warm":0.3,"outward":-0.6,"binding":0.3,"gentle":0.7,"light":-0.3},
    "Moon","Water","Cardinal","Cardinal water at solstice — the sheltering shell, feeling as initiative."),
 wz("wz-leo","Leo","♌",["radiant","proud","fixed","self-possessed","generous","performing"],
    {"active":0.7,"steady":0.8,"warm":0.8,"outward":0.8,"gentle":0.1,"light":0.7},
    "Sun","Fire","Fixed","Fixed fire at high summer — the Sun's own sign, radiance that holds its center."),
 wz("wz-virgo","Virgo","♍",["precise","discerning","useful","refining","critical"],
    {"active":0.2,"steady":-0.3,"warm":-0.2,"outward":-0.3,"binding":0.6,"gentle":-0.2},
    "Mercury","Earth","Mutable","Mutable earth at harvest — the sorting hand, service through discernment."),
 wz("wz-libra","Libra","♎",["balancing","relational","aesthetic","diplomatic","hesitant"],
    {"active":0.3,"steady":-0.2,"outward":0.2,"binding":0.2,"gentle":0.6,"light":0.3},
    "Venus","Air","Cardinal","Cardinal air at equinox — the scales, harmony sought between."),
 wz("wz-scorpio","Scorpio","♏",["intense","penetrating","secretive","transformative","controlling"],
    {"active":0.4,"steady":0.7,"warm":-0.3,"outward":-0.8,"binding":0.3,"gentle":-0.5,"light":-0.7},
    "Mars/Pluto","Water","Fixed","Fixed water — the deep still pool, power held beneath the surface."),
 wz("wz-sagittarius","Sagittarius","♐",["expansive","questing","frank","optimistic","reckless"],
    {"active":0.7,"rising":0.4,"steady":-0.6,"warm":0.5,"outward":0.6,"light":0.5},
    "Jupiter","Fire","Mutable","Mutable fire — the archer's far aim, the road beyond the horizon."),
 wz("wz-capricorn","Capricorn","♑",["disciplined","ambitious","enduring","structural","austere"],
    {"active":0.3,"steady":0.7,"warm":-0.5,"outward":-0.2,"binding":0.9,"gentle":-0.3,"light":-0.2},
    "Saturn","Earth","Cardinal","Cardinal earth at winter solstice — the mountain climbed, structure for longevity."),
 wz("wz-aquarius","Aquarius","♒",["inventive","detached","communal","principled","aloof"],
    {"active":0.4,"steady":0.5,"warm":-0.6,"outward":0.3,"binding":-0.2,"light":0.4},
    "Saturn/Uranus","Air","Fixed","Fixed air — the far idea held firm, the water-bearer's gift to all."),
 wz("wz-pisces","Pisces","♓",["dreaming","compassionate","boundless","impressionable","escapist"],
    {"active":-0.7,"warm":-0.1,"outward":-0.7,"binding":-0.9,"gentle":0.7,"light":-0.4},
    "Jupiter/Neptune","Water","Mutable","Mutable water — the ocean with no edge, self dissolving into all."),
]

# =====================================================================
# VEDIC SIDEREAL ZODIAC (Sun's actual constellational position; ~24° off tropical)
# Same signs, sidereal framing — included as a distinct lens (the disagreement matters)
# We reuse the same quality shape but tag source/observes distinctly, sidereal offset noted.
# For brevity we mark these as a lens variant; author fully if desired.
# =====================================================================
DATA += [
 E("vs-note","vedic-sidereal","(Sidereal signs)","☾",
   ["same 12 signs, sidereal frame"],{},
   "Vedic sidereal (Lahiri ayanamsa) — ~24° behind tropical due to precession","convention","computed","both",
   "The Sun's actual position against the fixed stars, not the seasonal tropical frame. Author 12 as a distinct lens if the sidereal reading should differ."),
]

# =====================================================================
# CHINESE ZODIAC — 12 animals (Earthly Branches) — nature computed, observes both
# =====================================================================
def cz(id,name,glyph,quals,ax,branch,elem,observed):
    return E(id,"chinese-animal",name,glyph,quals,ax,
             f"Chinese zodiac, Branch {branch}; fixed element {elem}","convention","computed","both",observed)

DATA += [
 cz("cz-rat","Rat","鼠",["clever","adaptable","resourceful","opportunistic","restless"],
    {"active":0.6,"steady":-0.5,"outward":0.2,"light":0.3},"Zi","Water",
    "First branch — quick wit, the survivor who seizes the moment."),
 cz("cz-ox","Ox","牛",["steadfast","diligent","reliable","stubborn","enduring"],
    {"active":-0.3,"steady":0.9,"binding":0.7,"gentle":0.2},"Chou","Earth",
    "Second branch — the patient plough, strength that does not hurry."),
 cz("cz-tiger","Tiger","虎",["brave","fierce","impulsive","charismatic","rebellious"],
    {"active":0.8,"steady":-0.4,"warm":0.5,"outward":0.6,"gentle":-0.7},"Yin","Wood",
    "Third branch — the pouncing force, courage bordering on recklessness."),
 cz("cz-rabbit","Rabbit","兔",["gentle","tactful","artistic","cautious","retiring"],
    {"active":-0.4,"outward":-0.4,"gentle":0.8,"light":0.2},"Mao","Wood",
    "Fourth branch — the quiet grace, sensitivity that avoids conflict."),
 cz("cz-dragon","Dragon","龍",["magnificent","ambitious","proud","visionary","domineering"],
    {"active":0.8,"rising":0.5,"warm":0.4,"outward":0.8,"light":0.6},"Chen","Earth",
    "Fifth branch — the only mythic animal, power and fortune ascending."),
 cz("cz-snake","Snake","蛇",["wise","enigmatic","intuitive","secretive","strategic"],
    {"active":-0.2,"steady":0.4,"outward":-0.7,"binding":0.2,"light":-0.6},"Si","Fire",
    "Sixth branch — the coiled mind, depth and quiet cunning."),
 cz("cz-horse","Horse","馬",["energetic","free","restless","warm-social","independent","driven"],
    {"active":0.8,"steady":-0.8,"warm":0.5,"outward":0.5,"light":0.3},"Wu","Fire",
    "Seventh branch — military prowess, long-distance travel — momentum that resists the fence."),
 cz("cz-goat","Goat","羊",["gentle","artistic","empathetic","peace-loving","dependent"],
    {"active":-0.5,"outward":-0.3,"gentle":0.8,"binding":-0.2},"Wei","Earth",
    "Eighth branch — pastoral harmony, the rich inner life of the creative."),
 cz("cz-monkey","Monkey","猴",["clever","playful","inventive","versatile","mischievous"],
    {"active":0.7,"steady":-0.7,"outward":0.4,"light":0.4},"Shen","Metal",
    "Ninth branch — the trickster mind, brilliance in constant motion."),
 cz("cz-rooster","Rooster","雞",["confident","precise","forthright","proud","critical"],
    {"active":0.5,"steady":0.3,"outward":0.6,"gentle":-0.3,"light":0.5},"You","Metal",
    "Tenth branch — the herald of dawn, sharp attention and display."),
 cz("cz-dog","Dog","狗",["loyal","honest","protective","just","anxious"],
    {"active":0.2,"steady":0.4,"outward":0.1,"gentle":0.3},"Xu","Earth",
    "Eleventh branch — the faithful guardian, moral conviction and devotion."),
 cz("cz-pig","Pig","豬",["generous","sincere","easygoing","indulgent","trusting"],
    {"active":-0.2,"warm":0.3,"outward":-0.1,"gentle":0.6,"binding":-0.2},"Hai","Water",
    "Twelfth branch — the open hand, honest pleasure and good faith."),
]

# =====================================================================
# WU XING — five phases (year's Heavenly-Stem element modifies the animal)
# =====================================================================
def wx(id,name,glyph,quals,ax,observed):
    return E(id,"wuxing",name,glyph,quals,ax,
             "Wu Xing five-element theory (distinct from Western 4 elements)","interpretation","computed","both",observed)
DATA += [
 wx("wx-wood","Wood","木",["growing","upward","generative","flexible","expansive"],
    {"active":0.5,"rising":0.7,"steady":-0.3,"warm":0.2,"outward":0.4},
    "Spring, the generating phase — upward growth, the green shoot."),
 wx("wx-fire","Fire (Wu Xing)","火",["dynamic","passionate","volatile","illuminating","quick"],
    {"active":0.85,"rising":0.4,"warm":0.9,"outward":0.6,"light":0.7},
    "Summer, the peak of yang — upward heat, expansion at its height."),
 wx("wx-earth","Earth (Wu Xing)","土",["centering","stabilizing","nourishing","mediating","grounding"],
    {"active":0.0,"steady":0.7,"binding":0.5,"gentle":0.3},
    "Late summer, the turning between phases — the stable center."),
 wx("wx-metal","Metal","金",["refining","contracting","precise","cutting","disciplined"],
    {"active":0.2,"rising":-0.4,"warm":-0.4,"binding":0.6,"gentle":-0.4,"light":0.3},
    "Autumn, contraction — the harvest cut, refinement and clarity."),
 wx("wx-water","Water (Wu Xing)","水",["descending","still","deep","yielding","reflective"],
    {"active":-0.7,"rising":-0.6,"warm":-0.6,"outward":-0.6,"binding":-0.6,"light":-0.4},
    "Winter, descent — the deep stillness, downward and inward."),
]

# =====================================================================
# MOON PHASES — 8 — the anchor of honesty (position measured; quality interpretive)
# =====================================================================
def mp(id,name,glyph,quals,ax,observed):
    return E(id,"moon-phase",name,glyph,quals,ax,
             "Ephemeris (position measured); phase-quality is folk/agricultural","measurement","computed","moment",observed)
DATA += [
 mp("mp-new","New Moon","🌑",["seeding","hidden","potential","beginning","dark"],
    {"rising":0.2,"outward":-0.8,"light":-0.9},
    "Dark — the seed, the unmanifest start of the lunar cycle."),
 mp("mp-wax-cres","Waxing Crescent","🌒",["intending","emerging","tender","hopeful"],
    {"rising":0.5,"outward":-0.2,"light":-0.4},
    "First light — intention forming, the tender beginning."),
 mp("mp-first-q","First Quarter","🌓",["deciding","pushing","effortful","resolving"],
    {"active":0.5,"rising":0.6,"outward":0.2},
    "Half-lit, rising — decision, the push through resistance."),
 mp("mp-wax-gib","Waxing Gibbous","🌔",["building","gathering","intensifying","refining"],
    {"rising":0.6,"active":0.3,"outward":0.4,"light":0.4},
    "Illuminated fraction rising past half toward full — the month gathering to its peak."),
 mp("mp-full","Full Moon","🌕",["culminating","clear","revealed","complete","charged"],
    {"rising":0.0,"outward":0.8,"light":0.9},
    "Complete illumination — culmination, clarity, the peak of the cycle."),
 mp("mp-wan-gib","Waning Gibbous","🌖",["sharing","grateful","disseminating","releasing"],
    {"rising":-0.4,"outward":0.4,"light":0.5},
    "Past full, releasing — gratitude, dissemination, the giving-back."),
 mp("mp-last-q","Last Quarter","🌗",["reckoning","releasing","turning","clearing"],
    {"active":-0.3,"rising":-0.6,"outward":-0.2},
    "Half-lit, falling — release, reckoning, letting go."),
 mp("mp-wan-cres","Waning Crescent","🌘",["surrendering","resting","emptying","quiet"],
    {"active":-0.6,"rising":-0.7,"outward":-0.6,"light":-0.6},
    "Last light — surrender, rest, the return toward dark."),
]

# =====================================================================
# PLANETARY DAY RULERS — classical week (a real cycle) — 7
# =====================================================================
def pl(id,name,glyph,quals,ax,day,observed):
    return E(id,"planetary-day",name,glyph,quals,ax,
             f"Classical planetary week — {day}","convention","computed","moment",observed)
DATA += [
 pl("pd-sun","Sun (Sunday)","☉",["vital","radiant","central","sovereign"],
    {"active":0.6,"warm":0.8,"outward":0.7,"light":0.9},"Sunday","The day of vitality and the self's light."),
 pl("pd-moon","Moon (Monday)","☽",["feeling","reflective","tidal","nurturing"],
    {"active":-0.5,"outward":-0.5,"gentle":0.5,"light":-0.3},"Monday","The day of feeling and reflection."),
 pl("pd-mars","Mars (Tuesday)","♂",["forceful","urgent","cutting","courageous"],
    {"active":0.9,"warm":0.4,"gentle":-0.8},"Tuesday","The day of force and initiative."),
 pl("pd-mercury","Mercury (Wednesday)","☿",["quick","communicative","clever","connective"],
    {"active":0.5,"steady":-0.6,"outward":0.3,"light":0.3},"Wednesday","The day of mind and exchange."),
 pl("pd-jupiter","Jupiter (Thursday)","♃",["expansive","benevolent","generous","optimistic"],
    {"active":0.5,"rising":0.5,"warm":0.4,"outward":0.5,"gentle":0.5},"Thursday","The day of expansion and grace."),
 pl("pd-venus","Venus (Friday)","♀",["harmonious","loving","aesthetic","pleasurable"],
    {"active":-0.2,"warm":0.5,"outward":0.2,"gentle":0.8},"Friday","The day of love and harmony."),
 pl("pd-saturn","Saturn (Saturday)","♄",["disciplined","limiting","enduring","sober"],
    {"active":-0.1,"warm":-0.6,"binding":0.9,"gentle":-0.4,"light":-0.3},"Saturday","The day of structure and limit."),
]

# =====================================================================
# MAYAN TZOLK'IN — 20 nawales (day-signs) — ancient, day-based → moment
# =====================================================================
def tz(id,name,glyph,quals,ax,observed):
    return E(id,"tzolkin-daysign",name,glyph,quals,ax,
             "Maya Tzolk'in day-signs (nawales), K'iche' tradition — oldest continuous calendar in the Americas","convention","computed","both",observed)
DATA += [
 tz("tz-imix","Imix (Crocodile)","🐊",["primordial","nurturing","creative","instinctive"],
    {"active":0.3,"rising":0.6,"outward":-0.2,"gentle":0.4},"Primordial creative energy — the source waters, the beginning."),
 tz("tz-ik","Ik' (Wind)","🌬",["breath","spirit","communicative","inspiring"],
    {"active":0.5,"steady":-0.6,"outward":0.4},"Wind and breath — spirit moving, the animating force."),
 tz("tz-akbal","Ak'b'al (Night)","🌑",["introspective","dreaming","hidden","deep"],
    {"active":-0.5,"outward":-0.7,"light":-0.8},"Night and the house of dawn — the inner darkness, dream and mystery."),
 tz("tz-kan","Kan (Seed)","🌱",["potential","ripening","ordered","fertile"],
    {"rising":0.5,"steady":0.3,"binding":0.4},"Seed — latent potential, the ordering of growth."),
 tz("tz-chicchan","Chicchan (Serpent)","🐍",["vital","instinctive","charged","transformative"],
    {"active":0.6,"warm":0.4,"gentle":-0.3,"light":-0.2},"Serpent — life-force, the kundalini charge, bodily instinct."),
 tz("tz-cimi","Cimi (Death)","💀",["releasing","transforming","surrendering","transitional"],
    {"active":-0.4,"rising":-0.7,"binding":-0.6,"light":-0.5},"Death — release and transformation, the necessary ending."),
 tz("tz-manik","Manik (Deer)","🦌",["gentle","healing","cooperative","peaceful"],
    {"active":-0.2,"gentle":0.7,"outward":-0.2},"Deer — the healing hand, gentleness and cooperation."),
 tz("tz-lamat","Lamat (Star/Rabbit)","⭐",["abundant","harmonizing","fertile","playful"],
    {"active":0.3,"rising":0.4,"warm":0.4,"light":0.5},"Star — abundance and harmony, the seed of Venus."),
 tz("tz-muluc","Muluc (Water)","💧",["emotional","offering","fluid","remembering"],
    {"active":-0.5,"outward":-0.4,"binding":-0.5,"gentle":0.4},"Water — offering and emotion, the memory held in water."),
 tz("tz-oc","Oc (Dog)","🐕",["loyal","loving","guiding","faithful"],
    {"active":0.2,"warm":0.4,"gentle":0.6,"outward":0.2},"Dog — loyalty and guidance, the faithful heart."),
 tz("tz-chuen","Chuen (Monkey)","🐒",["playful","creative","weaving","artful"],
    {"active":0.6,"steady":-0.6,"outward":0.4,"light":0.4},"Monkey — the artist and trickster, weaving time itself."),
 tz("tz-eb","Eb (Road)","🛤",["service","humble","enduring","guiding"],
    {"active":0.1,"steady":0.4,"binding":0.3,"gentle":0.3},"Road — the path of life, service and the journey walked."),
 tz("tz-ben","Ben (Reed)","🎋",["upright","principled","aspiring","authoritative"],
    {"active":0.5,"rising":0.6,"steady":0.4,"binding":0.4},"Reed — the pillar, growth toward the sky, moral backbone."),
 tz("tz-ix","Ix (Jaguar)","🐆",["magical","earthbound","fierce","shamanic"],
    {"active":0.4,"outward":-0.6,"gentle":-0.4,"light":-0.5},"Jaguar — earth magic, the night hunter, shamanic power."),
 tz("tz-men","Men (Eagle)","🦅",["visionary","far-seeing","aspiring","free"],
    {"active":0.5,"rising":0.6,"outward":0.6,"light":0.6},"Eagle — the high vision, seeing far, the planetary mind."),
 tz("tz-cib","Cib (Wisdom/Owl)","🦉",["ancient","introspective","forgiving","knowing"],
    {"active":-0.3,"outward":-0.5,"binding":0.2,"light":-0.4},"Wisdom — ancestral knowing, the inner counsel, forgiveness."),
 tz("tz-caban","Caban (Earth)","🌍",["synchronizing","intelligent","moving","grounded"],
    {"active":0.3,"steady":0.3,"binding":0.4,"light":0.2},"Earth — synchronicity and movement, the mind of the planet."),
 tz("tz-etznab","Etznab (Mirror/Flint)","🔪",["truthful","cutting","clarifying","discerning"],
    {"active":0.4,"warm":-0.3,"binding":0.4,"gentle":-0.6,"light":0.4},"Flint mirror — the blade of truth, clarity that cuts illusion."),
 tz("tz-cauac","Cauac (Storm)","⛈",["cleansing","catalytic","renewing","turbulent"],
    {"active":0.6,"rising":0.3,"steady":-0.5,"gentle":-0.3},"Storm — the purifying tempest, renewal through upheaval."),
 tz("tz-ahau","Ahau (Sun)","☀",["enlightened","radiant","whole","ancestral"],
    {"active":0.5,"warm":0.7,"outward":0.7,"light":0.9},"Sun — enlightenment and wholeness, the ancestral light, the goal."),
]

# =====================================================================
# TZOLK'IN GALACTIC TONES — 13 — the "how" to the day-sign's "what"
# =====================================================================
def tone(id,num,name,quals,ax,observed):
    return E(id,"tzolkin-tone",f"{num} · {name}","•"*1,quals,ax,
             "Maya Tzolk'in galactic/cosmic tones (1–13) — the modulation of the day-sign","interpretation","computed","both",observed)
DATA += [
 tone("tn-1",1,"Magnetic",["unifying","purposeful","attracting","initiating"],{"rising":0.7,"active":0.4},"Unity and purpose — the tone that attracts and begins."),
 tone("tn-2",2,"Lunar",["polarizing","challenging","stabilizing"],{"steady":-0.2,"active":-0.2},"Challenge and polarity — the tone that reveals the obstacle."),
 tone("tn-3",3,"Electric",["activating","bonding","serving"],{"active":0.6,"rising":0.4},"Activation and service — the tone that sets in motion."),
 tone("tn-4",4,"Self-Existing",["defining","measuring","forming"],{"steady":0.6,"binding":0.5},"Form and measure — the tone that gives structure."),
 tone("tn-5",5,"Overtone",["empowering","commanding","radiating"],{"active":0.6,"outward":0.6},"Empowerment — the tone that gathers and radiates."),
 tone("tn-6",6,"Rhythmic",["organizing","balancing","equalizing"],{"steady":0.5,"active":0.2},"Balance and rhythm — the tone that organizes into flow."),
 tone("tn-7",7,"Resonant",["attuning","channeling","inspiring"],{"outward":-0.2,"light":0.3},"Attunement — the mystical center, the tone that channels."),
 tone("tn-8",8,"Galactic",["harmonizing","modeling","integrity"],{"steady":0.4,"gentle":0.3},"Integrity and harmony — the tone that models."),
 tone("tn-9",9,"Solar",["pulsing","realizing","intending"],{"active":0.6,"rising":0.5,"warm":0.4},"Realization — the tone that pulses intention into being."),
 tone("tn-10",10,"Planetary",["manifesting","producing","perfecting"],{"active":0.4,"binding":0.5},"Manifestation — the tone that produces the finished form."),
 tone("tn-11",11,"Spectral",["dissolving","releasing","liberating"],{"active":0.3,"binding":-0.7,"steady":-0.5},"Liberation — the tone that dissolves and frees."),
 tone("tn-12",12,"Crystal",["cooperating","dedicating","universalizing"],{"steady":0.5,"outward":0.4,"gentle":0.4},"Cooperation — the tone that gathers into community."),
 tone("tn-13",13,"Cosmic",["transcending","enduring","returning"],{"rising":-0.3,"outward":0.3,"light":0.4},"Transcendence — the tone of magic and return, the cycle's close."),
]

# =====================================================================
# VEDIC NAKSHATRAS — 27 — Moon's current mansion → MEASURED, moment
# (deity/symbol/shakti + sattva/rajas/tamas guna). Authored from sourced meanings.
# =====================================================================
def nk(id,name,glyph,quals,ax,deity,observed):
    return E(id,"nakshatra",name,glyph,quals,ax,
             f"Vedic nakshatra (lunar mansion); deity {deity}. Moon's position measured; qualities interpretive","measurement","computed","both",observed)
DATA += [
 nk("nk-ashwini","Ashwini","🐎",["pioneering","swift","healing","eager"],{"active":0.8,"rising":0.7,"gentle":0.3,"light":0.4},"Ashwini Kumaras","The horse-riders — swift healing, the dynamic pioneering start."),
 nk("nk-bharani","Bharani","🔥",["intense","transformative","disciplined","fertile"],{"active":0.5,"warm":0.3,"gentle":-0.4,"light":-0.3},"Yama","Bearing — creation and death, intense transformation through restraint."),
 nk("nk-krittika","Krittika","🔪",["sharp","purifying","fiery","cutting"],{"active":0.6,"warm":0.6,"gentle":-0.6,"light":0.5},"Agni","The cutter — purification by fire, the blade that refines."),
 nk("nk-rohini","Rohini","🌹",["fertile","sensual","growing","alluring"],{"active":0.2,"rising":0.5,"warm":0.4,"gentle":0.4},"Brahma/Prajapati","The red one — fertile beauty, growth and material abundance."),
 nk("nk-mrigashira","Mrigashira","🦌",["searching","curious","gentle","restless"],{"active":0.4,"steady":-0.6,"gentle":0.4,"outward":0.2},"Soma","The searching deer — seeking, curiosity, the gentle quest."),
 nk("nk-ardra","Ardra","💧",["stormy","transformative","sharp","emotional"],{"active":0.5,"steady":-0.5,"gentle":-0.5,"light":-0.4},"Rudra","The moist one — the storm's tears, destruction that clears the way."),
 nk("nk-punarvasu","Punarvasu","🏹",["renewing","returning","nurturing","optimistic"],{"active":0.3,"rising":0.5,"gentle":0.5,"light":0.4},"Aditi","Return of the light — renewal, the safe home rebuilt."),
 nk("nk-pushya","Pushya","🌼",["nourishing","protective","spiritual","steady"],{"active":0.1,"steady":0.5,"gentle":0.6,"binding":0.3},"Brihaspati","The nourisher — spiritual nurture, the most auspicious mansion."),
 nk("nk-ashlesha","Ashlesha","🐍",["hypnotic","penetrating","secretive","cunning"],{"active":0.3,"outward":-0.7,"gentle":-0.4,"light":-0.6},"Nagas","The coiled serpent — hypnotic power, the penetrating deep mind."),
 nk("nk-magha","Magha","👑",["regal","ancestral","proud","authoritative"],{"active":0.5,"steady":0.5,"outward":0.6,"light":0.4},"Pitrs (Ancestors)","The throne — ancestral power, regal authority and legacy."),
 nk("nk-purva-phalguni","Purva Phalguni","🛏",["pleasurable","creative","relaxed","generous"],{"active":0.2,"warm":0.5,"outward":0.3,"gentle":0.5},"Bhaga","The former red — pleasure and rest, creative enjoyment."),
 nk("nk-uttara-phalguni","Uttara Phalguni","🤝",["helpful","reliable","contractual","kind"],{"active":0.2,"steady":0.5,"gentle":0.5,"binding":0.4},"Aryaman","The latter red — friendship and contract, generous reliability."),
 nk("nk-hasta","Hasta","✋",["skillful","clever","crafting","dexterous"],{"active":0.4,"steady":0.2,"outward":0.2,"light":0.4},"Savitar","The hand — skill and craft, making the intangible real."),
 nk("nk-chitra","Chitra","💎",["brilliant","artistic","charismatic","designing"],{"active":0.5,"warm":0.3,"outward":0.6,"light":0.5},"Tvashtar","The bright jewel — the divine architect, dazzling craft and form."),
 nk("nk-swati","Swati","🌾",["independent","adaptable","flexible","self-going"],{"active":0.4,"steady":-0.7,"outward":0.2},"Vayu","The independent — the wind, self-directed movement and flexibility."),
 nk("nk-vishakha","Vishakha","🏆",["determined","goal-driven","ambitious","forked"],{"active":0.6,"rising":0.5,"warm":0.3,"gentle":-0.2},"Indra-Agni","The forked branch — determined purpose, the triumphal push."),
 nk("nk-anuradha","Anuradha","🪷",["devoted","friendly","cooperative","disciplined"],{"active":0.2,"steady":0.4,"gentle":0.5,"outward":0.2},"Mitra","The follower — devotion and friendship, success through cooperation."),
 nk("nk-jyeshtha","Jyeshtha","☂",["senior","protective","occult","responsible"],{"active":0.3,"outward":-0.4,"gentle":-0.2,"light":-0.4},"Indra","The eldest — seniority and protection, hidden power and responsibility."),
 nk("nk-mula","Mula","🌿",["rooting","investigating","destructive","truth-seeking"],{"active":0.3,"rising":-0.5,"binding":-0.4,"gentle":-0.4,"light":-0.5},"Nirriti","The root — getting to the bottom, destruction that reveals the core."),
 nk("nk-purva-ashadha","Purva Ashadha","🌊",["invincible","proud","cleansing","persuasive"],{"active":0.5,"rising":0.4,"outward":0.4},"Apas","The former unconquered — invincible waters, purifying confidence."),
 nk("nk-uttara-ashadha","Uttara Ashadha","🏔",["victorious","enduring","principled","upright"],{"active":0.4,"steady":0.6,"binding":0.4,"light":0.3},"Vishvedevas","The latter unconquered — lasting victory, integrity that endures."),
 nk("nk-shravana","Shravana","👂",["listening","learning","connecting","wise"],{"active":0.1,"steady":0.4,"outward":-0.2,"light":0.3},"Vishnu","The ear — listening and learning, wisdom gathered from others."),
 nk("nk-dhanishta","Dhanishta","🥁",["rhythmic","prosperous","musical","adaptable"],{"active":0.5,"rising":0.3,"outward":0.5,"warm":0.2},"Vasus","The drum — rhythm and wealth, the beat that gathers abundance."),
 nk("nk-shatabhisha","Shatabhisha","⭕",["healing","secretive","independent","mystical"],{"active":0.2,"outward":-0.6,"light":-0.4},"Varuna","The hundred healers — the veiled circle, mystic healing and solitude."),
 nk("nk-purva-bhadrapada","Purva Bhadrapada","🔥",["idealistic","intense","transformative","fiery"],{"active":0.5,"warm":0.2,"gentle":-0.4,"light":-0.3},"Aja Ekapada","The former blessed — the fire of transformation, passionate idealism."),
 nk("nk-uttara-bhadrapada","Uttara Bhadrapada","🐉",["deep","wise","calm","renouncing"],{"active":-0.4,"outward":-0.5,"binding":-0.3,"light":-0.3,"gentle":0.4},"Ahir Budhnya","The latter blessed — the deep serpent, still wisdom and surrender."),
 nk("nk-revati","Revati","🐟",["nourishing","compassionate","guiding","adaptable"],{"active":-0.1,"outward":-0.2,"gentle":0.8,"binding":-0.4},"Pushan","Wealth — compassion and safe passage, the shepherd of journeys."),
]

# =====================================================================
# EGYPTIAN DECANS — 36 — sidereal star clock (~2100 BCE), decan rising now → moment
# Authored at the group level (each decan = a deific star-group + theme).
# For the build we provide the 36 slots with sourced deity themes; polarities seeded.
# =====================================================================
DECAN_NAMES = [
 ("Sirius/Sothis","renewal, the flood, the new year's star"),
 ("Satet","the pouring-forth, inundation's herald"),
 ("Anuket","the embrace of the river, nourishment"),
 ("Sopdet-linked","brilliance rising, the sharp star"),
 ("Horus decan","the falcon's watch, sovereign sight"),
 ("Sobek decan","the crocodile's power, primal force"),
 ("Isis decan","the throne, protective magic"),
 ("Nephthys decan","the veiled sister, hidden support"),
 ("Osiris decan","death and regeneration, the grain"),
 ("Anubis decan","the guide of thresholds, the weigher"),
 ("Thoth decan","measure and word, the scribe's order"),
 (" Maat decan","balance, the feather of truth"),
 ("Sekhmet decan","the lion's fury, purifying heat"),
 ("Bastet decan","the cat's grace, protective warmth"),
 ("Hathor decan","love, music, the golden one"),
 ("Ptah decan","the craftsman, form spoken into being"),
 ("Khnum decan","the potter, bodies shaped on the wheel"),
 ("Neith decan","the weaver, the primordial web"),
 ("Set decan","the storm, chaos and the desert edge"),
 ("Nut decan","the arched sky, the swallowing dark"),
 ("Geb decan","the earth's body, the ground beneath"),
 ("Shu decan","the air between, the lifted space"),
 ("Tefnut decan","moisture, the first breath's dew"),
 ("Atum decan","the completed one, dusk's totality"),
 ("Ra decan","the noon sun, sovereign radiance"),
 ("Khepri decan","the dawn beetle, becoming, emergence"),
 ("Amun decan","the hidden, the unseen wind"),
 ("Min decan","fertility, the raised arm, generation"),
 ("Wadjet decan","the cobra's guard, the green eye"),
 ("Nekhbet decan","the vulture mother, high protection"),
 ("Serqet decan","the scorpion's sting and cure"),
 ("Heka decan","magic itself, the activating power"),
 ("Mafdet decan","swift justice, the running claw"),
 ("Renenutet decan","the harvest snake, nourishing fate"),
 ("Meskhenet decan","the birth-brick, destiny at arrival"),
 ("Aker decan","the double lion, the horizon's gate"),
]
for i,(nm,theme) in enumerate(DECAN_NAMES, start=1):
    # seed polarities lightly from theme keywords; author fully later
    ax = {}
    t = theme.lower()
    if any(w in t for w in ["sun","radiance","noon","brilliance","dawn","gold","light"]): ax["light"]=0.6; ax["warm"]=0.5; ax["outward"]=0.5
    if any(w in t for w in ["dark","hidden","veiled","death","dusk","swallow","night"]): ax["light"]=-0.6; ax["outward"]=-0.5
    if any(w in t for w in ["storm","fury","chaos","sting","fire","heat","lion"]): ax["gentle"]=-0.6; ax["active"]=0.5
    if any(w in t for w in ["love","grace","music","nourish","protect","embrace","harvest"]): ax["gentle"]=0.6; ax["warm"]=0.3
    if any(w in t for w in ["measure","order","balance","form","craft","weaver","potter","scribe"]): ax["binding"]=0.6; ax["steady"]=0.4
    if any(w in t for w in ["flood","renewal","emergence","becoming","birth","fertility","generation","new year"]): ax["rising"]=0.6; ax["active"]=0.4
    if not ax: ax={"active":0.0}
    DATA.append(E(f"dc-{i:02d}","egyptian-decan",f"Decan {i} · {nm}","✶",
        [w.strip() for w in theme.split(",")],ax,
        "Egyptian decan — sidereal star-group rising (~2100 BCE), later deific astrological entity","interpretation","computed","both",
        f"The {i}th decan — {theme}."))

# =====================================================================
# TAROT MAJOR ARCANA — 22 — CAST layer (drawn, not computed) → nature cast
# =====================================================================
def ta(id,num,name,quals,ax,observed):
    return E(id,"tarot-major",name,num,quals,ax,
             "Rider-Waite-Smith major arcana (early 20th-C authored system)","interpretation","cast","person",observed)
DATA += [
 ta("ta-0","0","The Fool",["beginnings","leap","innocence","spontaneity"],{"active":0.6,"rising":0.7,"steady":-0.6,"light":0.4},"The edge of the cliff — infinite potential, the leap without a plan."),
 ta("ta-1","I","The Magician",["manifestation","will","skill","focus"],{"active":0.7,"outward":0.5,"binding":0.4,"light":0.5},"The channel — will focused, idea made real."),
 ta("ta-2","II","The High Priestess",["intuition","mystery","inner-knowing","stillness"],{"active":-0.6,"outward":-0.7,"light":-0.6},"The veiled threshold — intuition, the unseen known within."),
 ta("ta-3","III","The Empress",["abundance","nurture","fertility","creativity"],{"active":0.2,"rising":0.5,"warm":0.5,"gentle":0.7},"The garden — fertile abundance, the creative mother."),
 ta("ta-4","IV","The Emperor",["structure","authority","order","stability"],{"active":0.4,"steady":0.7,"binding":0.9,"gentle":-0.3},"The throne — structure and authority, the founding order."),
 ta("ta-5","V","The Hierophant",["tradition","teaching","meaning","conformity"],{"steady":0.6,"binding":0.6,"light":0.2},"The teacher — tradition and shared meaning, the bridge to the sacred."),
 ta("ta-6","VI","The Lovers",["union","choice","alignment","values"],{"active":0.3,"warm":0.5,"outward":0.3,"gentle":0.5},"The choice — union and alignment, the values one commits to."),
 ta("ta-7","VII","The Chariot",["drive","willpower","direction","victory"],{"active":0.8,"rising":0.5,"steady":0.2,"gentle":-0.3},"The charioteer — will harnessed, opposing forces driven forward."),
 ta("ta-8","VIII","Strength",["courage","gentleness","inner-power","patience"],{"active":0.3,"warm":0.4,"gentle":0.7},"The gentle hand on the lion — courage as softness, power through patience."),
 ta("ta-9","IX","The Hermit",["solitude","search","inner-light","withdrawal"],{"active":-0.5,"outward":-0.8,"light":-0.2},"The lantern in the dark — solitude, the inner light sought alone."),
 ta("ta-10","X","Wheel of Fortune",["cycles","turning-point","fate","momentum"],{"active":0.3,"steady":-0.8,"rising":0.0},"The turning wheel — fortune's cycle, what rises and falls by fate."),
 ta("ta-11","XI","Justice",["balance","truth","consequence","fairness"],{"steady":0.5,"binding":0.6,"gentle":-0.2,"light":0.5},"The scales and sword — truth weighed, consequence made clear."),
 ta("ta-12","XII","The Hanged Man",["suspension","surrender","new-perspective","pause"],{"active":-0.6,"rising":-0.4,"binding":-0.5},"The suspended one — surrender, the world seen upside-down."),
 ta("ta-13","XIII","Death",["ending","transformation","release","rebirth"],{"active":-0.2,"rising":-0.6,"binding":-0.6,"gentle":-0.4,"light":-0.4},"The great transition — an ending that clears the ground for rebirth."),
 ta("ta-14","XIV","Temperance",["balance","blending","patience","moderation"],{"active":0.0,"steady":0.4,"gentle":0.5,"binding":0.2},"The mixing of waters — balance, patient synthesis of opposites."),
 ta("ta-15","XV","The Devil",["bondage","shadow","desire","attachment"],{"active":0.3,"binding":0.7,"gentle":-0.6,"light":-0.7},"The chains — bondage and shadow, the desire that binds."),
 ta("ta-16","XVI","The Tower",["upheaval","sudden-change","revelation","collapse"],{"active":0.7,"steady":-0.9,"gentle":-0.8,"light":0.3},"The lightning-struck tower — sudden collapse, revelation by force."),
 ta("ta-17","XVII","The Star",["hope","renewal","serene","faith","healing"],{"active":-0.2,"rising":0.3,"gentle":0.6,"light":0.5},"The calm after the Tower — hope renewed, the guiding light."),
 ta("ta-18","XVIII","The Moon",["illusion","dream","unconscious","uncertainty"],{"active":-0.4,"outward":-0.6,"light":-0.8},"The path between towers — illusion and dream, the uncertain dark."),
 ta("ta-19","XIX","The Sun",["joy","clarity","vitality","warmth","success"],{"active":0.6,"warm":0.9,"outward":0.6,"light":0.9},"The unclouded day — joy and clarity, life at full light."),
 ta("ta-20","XX","Judgement",["awakening","reckoning","calling","renewal"],{"active":0.5,"rising":0.6,"outward":0.4,"light":0.6},"The trumpet's call — awakening, the reckoning that renews."),
 ta("ta-21","XXI","The World",["completion","wholeness","integration","fulfillment"],{"active":0.3,"rising":0.0,"binding":0.3,"light":0.5,"gentle":0.4},"The dancer in the wreath — completion, the cycle whole and integrated."),
]

# =====================================================================
# IFÁ / ORISHA — CAST layer — a reflective 16-cowrie-inspired draw (NOT computed)
# Framed as homage; sourced respectfully; nature cast.
# We include a representative set of principal Orisha (not the full 256 odu).
# =====================================================================
def orisha(id,name,quals,ax,domain):
    return E(id,"orisha-cast",name,"◈",quals,ax,
             "Yoruba Ifá tradition (principal Orisha) — reflective draw inspired by the 16-cowrie method; NOT a traditional babalawo reading","interpretation","cast","person",domain)
DATA += [
 orisha("or-eshu","Eshu-Elegba",["opening","crossroads","messenger","trickster","choice"],{"active":0.6,"steady":-0.6,"outward":0.3,"light":0.2},"Guardian of the crossroads and messenger — the opener of the way, the moment of choice."),
 orisha("or-ogun","Ogun",["force","labor","iron","clearing","courage"],{"active":0.9,"warm":0.4,"gentle":-0.6,"binding":0.3},"Orisha of iron and labor — the force that clears the path, work and courage."),
 orisha("or-yemoja","Yemoja",["nurture","ocean","motherhood","depth","cleansing"],{"active":-0.4,"outward":-0.3,"gentle":0.8,"binding":-0.4},"Mother of waters — nurture and the deep ocean, cleansing and the source of life."),
 orisha("or-oshun","Oshun",["love","sweetness","fertility","beauty","flow"],{"active":0.2,"warm":0.6,"outward":0.4,"gentle":0.7},"Orisha of the river — love, sweetness, fertility and beauty."),
 orisha("or-shango","Shango",["fire","thunder","passion","justice","command"],{"active":0.8,"warm":0.7,"outward":0.6,"gentle":-0.4,"light":0.4},"Orisha of thunder — fire, passion, and the force of kingly justice."),
 orisha("or-oya","Oya",["wind","change","storm","transformation","boundary"],{"active":0.7,"steady":-0.7,"gentle":-0.4,"light":-0.2},"Orisha of wind and change — the storm that transforms, guardian of thresholds."),
 orisha("or-obatala",  "Obatala",["clarity","peace","wisdom","purity","creation"],{"active":-0.2,"steady":0.5,"gentle":0.6,"light":0.6},"Orisha of white cloth — clarity, wisdom, peace, the shaper of forms."),
 orisha("or-orunmila","Orunmila",["wisdom","destiny","knowledge","counsel"],{"active":0.0,"outward":-0.3,"binding":0.3,"light":0.3},"Orisha of wisdom and destiny — the oracle, the keeper of the odu."),
]

# =====================================================================
# I CHING — CAST layer — 8 trigrams as the representative reflective draw
# =====================================================================
def tri(id,name,glyph,quals,ax,observed):
    return E(id,"iching-trigram",name,glyph,quals,ax,
             "I Ching eight trigrams (bagua) — reflective draw","interpretation","cast","person",observed)
DATA += [
 tri("ic-qian","Qian (Heaven)","☰",["creative","strong","initiating","persistent"],{"active":0.9,"rising":0.6,"light":0.6},"The creative — pure yang, heaven's initiating strength."),
 tri("ic-kun","Kun (Earth)","☷",["receptive","yielding","nurturing","devoted"],{"active":-0.9,"gentle":0.6,"binding":0.3},"The receptive — pure yin, earth's yielding devotion."),
 tri("ic-zhen","Zhen (Thunder)","☳",["arousing","shocking","initiating","moving"],{"active":0.7,"steady":-0.6,"rising":0.5},"The arousing — thunder, the shock that sets in motion."),
 tri("ic-kan","Kan (Water)","☵",["dangerous","deep","flowing","abysmal"],{"active":-0.3,"outward":-0.5,"binding":-0.4,"light":-0.5},"The abysmal — water, the deep and the danger flowed through."),
 tri("ic-gen","Gen (Mountain)","☶",["stillness","stopping","meditative","stable"],{"active":-0.4,"steady":0.8,"binding":0.5},"Keeping still — the mountain, the pause and inner quiet."),
 tri("ic-xun","Xun (Wind)","☴",["gentle","penetrating","gradual","flexible"],{"active":0.3,"steady":-0.4,"gentle":0.6},"The gentle — wind and wood, penetrating by persistence."),
 tri("ic-li","Li (Fire)","☲",["clinging","clarity","radiance","illuminating"],{"active":0.5,"warm":0.7,"outward":0.5,"light":0.8},"The clinging — fire, clarity and light that depends on its fuel."),
 tri("ic-dui","Dui (Lake)","☱",["joyous","open","pleasurable","reflective"],{"active":0.3,"warm":0.4,"outward":0.5,"gentle":0.5},"The joyous — the lake, open pleasure and glad exchange."),
]

# =====================================================================
# CELTIC TREE — MODERN (Graves 1948) — birth-assigned, honestly labeled
# =====================================================================
def celtic(id,name,glyph,quals,ax,observed):
    return E(id,"celtic-tree",name,glyph,quals,ax,
             "Celtic tree 'zodiac' — MODERN system (Robert Graves, 1948); Ogham itself is an ancient script, not a calendar","interpretation","birth","person",observed)
# representative subset (author all 13 if kept); flagged clearly as modern
DATA += [
 celtic("ct-birch","Birch","🌳",["pioneering","resilient","fresh","driven"],{"active":0.6,"rising":0.6,"steady":-0.2},"The pioneer tree — new beginnings, resilience in harsh ground. (Modern: Graves.)"),
 celtic("ct-oak","Oak","🌳",["strong","protective","enduring","noble"],{"active":0.4,"steady":0.7,"binding":0.5,"gentle":0.2},"The doorway tree — strength and protection, the enduring noble. (Modern: Graves.)"),
 celtic("ct-willow","Willow","🌳",["intuitive","emotional","yielding","lunar"],{"active":-0.4,"outward":-0.4,"gentle":0.5,"light":-0.3},"The moon tree — intuition and emotion, bending without breaking. (Modern: Graves.)"),
]

# =====================================================================
# RUNES — Elder Futhark — the runes are ANCIENT (attested rune poems);
# a rune 'zodiac' is modern, but a rune CAST is legitimate → cast layer.
# representative subset of 8 (author all 24 if kept).
# =====================================================================
def rune(id,name,glyph,quals,ax,observed):
    return E(id,"rune-cast",name,glyph,quals,ax,
             "Elder Futhark runes (attested via rune poems) — reflective cast; a rune 'zodiac' by birthdate is modern, a cast is traditional","interpretation","cast","person",observed)
DATA += [
 rune("ru-fehu","Fehu","ᚠ",["wealth","abundance","mobile-power","beginnings"],{"active":0.5,"rising":0.5,"outward":0.3},"Cattle/wealth — mobile abundance, the fire of new resources."),
 rune("ru-uruz","Uruz","ᚢ",["strength","vitality","wild","primal"],{"active":0.7,"warm":0.3,"gentle":-0.4},"The aurochs — raw strength and vitality, untamed power."),
 rune("ru-thurisaz","Thurisaz","ᚦ",["force","defense","conflict","catalytic"],{"active":0.7,"gentle":-0.7,"light":-0.2},"The thorn/giant — reactive force, defense and disruptive power."),
 rune("ru-ansuz","Ansuz","ᚨ",["wisdom","communication","insight","divine-word"],{"active":0.4,"outward":0.3,"light":0.5},"The god/mouth — wisdom and the word, inspired communication."),
 rune("ru-raidho","Raidho","ᚱ",["journey","rhythm","order","movement"],{"active":0.5,"steady":0.2,"binding":0.3},"The ride — the journey and its right rhythm, movement with order."),
 rune("ru-kenaz","Kenaz","ᚲ",["illumination","craft","knowledge","forge"],{"active":0.4,"warm":0.5,"light":0.6},"The torch — illumination and craft, knowledge kindled."),
 rune("ru-gebo","Gebo","ᚷ",["gift","exchange","union","balance"],{"active":0.1,"outward":0.3,"gentle":0.5},"The gift — exchange and union, the balance of giving and receiving."),
 rune("ru-wunjo","Wunjo","ᚹ",["joy","harmony","fellowship","fulfillment"],{"active":0.3,"warm":0.5,"outward":0.4,"gentle":0.5},"Joy — harmony and fellowship, the reward of alignment."),
]

print(f"TOTAL ENTRIES: {len(DATA)}")
by_nature={}
by_system={}
for e in DATA:
    by_nature[e['nature']]=by_nature.get(e['nature'],0)+1
    by_system[e['system']]=by_system.get(e['system'],0)+1
print("by nature:",by_nature)
print("by system:")
for s,n in by_system.items(): print(f"   {s}: {n}")

import json
with open("/home/claude/lore/data.json","w") as f:
    json.dump({"axes":AXES,"axis_poles":AXIS_POLES,"data":DATA},f,indent=1,ensure_ascii=False)
print("wrote data.json")
