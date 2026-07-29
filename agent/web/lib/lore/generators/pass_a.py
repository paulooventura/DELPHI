# PASS A — the complete mainframe.
# Adds: Pawukon (30 wuku + 5 pancawara), Arabic anwa' (28), planetary hours (7),
# Chinese shi (12), muhurta (30), numerology (0-9).
# Adds tier: measured|celebrated to ALL entries. Fills axis density on sparse systems.
import json
base=json.load(open("data.json"))
DATA=base["data"]; AXES=base["axes"]; POLES=base["axis_poles"]

def E(id,system,name,glyph,quals,ax,source,claim,nature,observes,observed,origin,honesty="render",tier=None,extra=None):
    # tier defaults from claim if not given
    if tier is None:
        tier = "measured" if claim=="measurement" else "celebrated"
    d=dict(id=id,system=system,name=name,glyph=glyph,qualities=quals,ax=ax,source=source,
           claim=claim,nature=nature,observes=observes,observed=observed,origin=origin,
           honesty=honesty,tier=tier)
    if extra: d.update(extra)
    return d

# ---- First: add tier to every EXISTING entry ----
for e in DATA:
    if "tier" not in e:
        # measurement -> measured; everything else -> celebrated
        # BUT convention counts that are exact (tzolkin, chinese, planetary-day, pawukon) are the
        # calendrical backbone; still "celebrated" for their QUALITY reading, measured for their POSITION.
        # We tier by the QUALITY claim: only pure measurement is "measured".
        e["tier"] = "measured" if e.get("claim")=="measurement" else "celebrated"

# =====================================================================
# BALINESE PAWUKON — 30 wuku. computed, celebrated. origin bali/java.
# Each wuku embodies a symbolic phase (from the Watugunung myth cycle).
# =====================================================================
WUKU=[("Sinta","beginning, origin, the first light",{"active":0.4,"rising":0.6,"light":0.4}),
("Landep","sharpness, discernment, the honed blade",{"active":0.5,"gentle":-0.4,"light":0.4}),
("Ukir","aspiration, the mountain, growth upward",{"rising":0.6,"steady":0.3}),
("Kulantir","movement, restlessness, setting out",{"active":0.5,"steady":-0.5}),
("Tolu","balance, three-fold stability, grounding",{"steady":0.5,"binding":0.3}),
("Gumbreg","vitality, animal force, fertility",{"active":0.5,"warm":0.3,"rising":0.4}),
("Wariga","knowledge of time, calendar-wisdom, order",{"binding":0.4,"light":0.3}),
("Warigadean","provision, resourcefulness, gathering",{"active":0.3,"binding":0.3}),
("Julungwangi","fragrance, beauty, blossoming grace",{"warm":0.4,"outward":0.4,"gentle":0.4}),
("Sungsang","reversal, inversion, turning inward",{"active":-0.3,"outward":-0.5}),
("Dungulan","victory of dharma, good over evil (Galungan)",{"active":0.5,"rising":0.5,"light":0.6}),
("Kuningan","ancestral blessing, gratitude, the golden day",{"warm":0.4,"gentle":0.5,"light":0.5}),
("Langkir","fierceness, warning, the shadow-guard",{"active":0.4,"gentle":-0.6,"light":-0.5}),
("Medangsia","refinement, cleansing, purification",{"binding":0.3,"gentle":0.3,"light":0.3}),
("Pujut","aspiration fulfilled, the summit reached",{"rising":0.5,"outward":0.4}),
("Pahang","resilience, endurance, holding firm",{"steady":0.6,"binding":0.4}),
("Krulut","love, music, tenderness, the heart",{"warm":0.5,"outward":0.4,"gentle":0.7}),
("Merakih","longing, striving, reaching toward",{"active":0.4,"rising":0.4}),
("Tambir","adaptation, ambiguity, the shifting face",{"steady":-0.5,"light":-0.2}),
("Medangkungan","depth, hidden foundation, the well",{"outward":-0.5,"binding":0.3,"light":-0.3}),
("Matal","rootedness, anchoring, the firm base",{"steady":0.7,"binding":0.5}),
("Uye","nurture, animal-care, tending life",{"gentle":0.6,"warm":0.3}),
("Menail","refuge, sanctuary, the sheltered space",{"outward":-0.4,"gentle":0.4,"binding":0.3}),
("Prangbakat","striving-force, the industrious push",{"active":0.6,"rising":0.4}),
("Bala","strength, army, marshaled power",{"active":0.6,"binding":0.4,"gentle":-0.3}),
("Ugu","service, humility, the useful hand",{"active":0.2,"gentle":0.4,"outward":-0.2}),
("Wayang","shadow-play, illusion, art and story",{"outward":-0.3,"light":-0.4,"gentle":0.3}),
("Kulawu","maturity, the grey wisdom, seasoned depth",{"steady":0.5,"outward":-0.3,"light":-0.2}),
("Dukut","abundance of grass, pastoral plenty",{"rising":0.4,"warm":0.3,"gentle":0.4}),
("Watugunung","culmination, downfall and enlightenment, the cycle's close",{"rising":-0.3,"light":0.5,"outward":0.3})]
for i,(nm,gloss,ax) in enumerate(WUKU,start=1):
    DATA.append(E(f"wk-{i:02d}","pawukon-wuku",nm,"᭟",[w.strip() for w in gloss.split(",")][:3],ax,
        "Balinese/Javanese Pawukon — 30 wuku (210-day cycle), from the Watugunung myth","convention","computed","both",
        f"Wuku {i} of 30 — {gloss}.",["bali","java"],tier="celebrated",extra={"wukuNum":i}))

# Pancawara — 5-day Balinese market week, each with urip (numeric value) + character
PANCA=[("Umanis","sweetness, openness, giving",{"warm":0.4,"gentle":0.5,"outward":0.3}),
("Paing","intensity, focus, sharpness",{"active":0.5,"gentle":-0.3}),
("Pon","abundance, brightness, wealth",{"warm":0.3,"outward":0.4,"light":0.4}),
("Wage","endurance, groundedness, patience",{"steady":0.5,"binding":0.4}),
("Kliwon","spiritual potency, the sacred hinge, transition",{"outward":-0.3,"light":-0.2,"binding":-0.2})]
for i,(nm,gloss,ax) in enumerate(PANCA,start=1):
    DATA.append(E(f"pc-{i}","pancawara",nm,"᭞",[w.strip() for w in gloss.split(",")][:3],ax,
        "Balinese Pancawara — the 5-day market week (each day carries urip / character)","convention","computed","both",
        f"Pancawara {i} of 5 — {gloss}.",["bali","java"],tier="celebrated"))

# =====================================================================
# ARABIC ANWA' / MANAZIL AL-QAMAR — 28 lunar stations. computed, celebrated.
# The Moon's nightly station; pre-Islamic Arabian star-calendar (distinct from nakshatra).
# =====================================================================
MANAZIL=[("Al-Sharatain","the two signs, the ram's horns — beginning",{"active":0.5,"rising":0.5}),
("Al-Butayn","the little belly — hidden gestation",{"outward":-0.4,"rising":0.3}),
("Al-Thurayya","the Pleiades, abundance — the many gathered",{"rising":0.4,"outward":0.4,"light":0.4}),
("Al-Dabaran","the follower — persistence, pursuit",{"active":0.3,"steady":0.4}),
("Al-Haqa","the white spot — subtlety, small light",{"light":0.3,"outward":-0.2}),
("Al-Hana","the brand-mark — identity, distinction",{"outward":0.3}),
("Al-Dhira","the forearm — reach, strength extended",{"active":0.5,"outward":0.4}),
("Al-Nathra","the gap, the manger — nourishment, shelter",{"gentle":0.4,"binding":0.2}),
("Al-Tarf","the glance — vigilance, the watchful eye",{"active":0.3,"light":0.3}),
("Al-Jabha","the forehead — pride, prominence",{"outward":0.5,"light":0.4}),
("Al-Zubra","the mane — dignity, radiant strength",{"warm":0.3,"outward":0.4,"light":0.4}),
("Al-Sarfa","the turning — change of weather, the shift",{"steady":-0.5}),
("Al-Awwa","the barker — announcement, the herald's cry",{"active":0.4,"outward":0.4}),
("Al-Simak","the unarmed, Spica — the lofty, the exalted",{"rising":0.5,"light":0.4}),
("Al-Ghafr","the covering — concealment, gentle veiling",{"outward":-0.4,"gentle":0.4,"light":-0.3}),
("Al-Zubana","the claws — grasping, negotiation",{"active":0.3,"gentle":-0.2}),
("Al-Iklil","the crown — honor, the encircling",{"binding":0.4,"outward":0.4,"light":0.3}),
("Al-Qalb","the heart, Antares — passion, the deep core",{"warm":0.4,"outward":-0.3,"light":-0.3}),
("Al-Shaula","the sting — sharpness, the raised tail",{"active":0.4,"gentle":-0.5}),
("Al-Naaim","the ostriches — freedom, roaming",{"active":0.4,"steady":-0.5}),
("Al-Balda","the empty place — fallow, potential, rest",{"active":-0.4,"outward":-0.3}),
("Sad al-Dhabih","the slayer's luck — decisive fortune",{"active":0.4,"gentle":-0.3}),
("Sad Bula","the swallower's luck — absorption, taking in",{"outward":-0.3,"binding":0.2}),
("Sad al-Suud","the luckiest of the lucky — grace, flow",{"warm":0.4,"gentle":0.5,"light":0.4}),
("Sad al-Akhbiya","the luck of tents — shelter, the hidden home",{"outward":-0.4,"binding":0.3}),
("Al-Fargh al-Muqaddam","the fore-spout — pouring out, release",{"active":0.3,"binding":-0.4}),
("Al-Fargh al-Muakhkhar","the rear-spout — the last pouring, completion",{"rising":-0.3,"binding":-0.3}),
("Al-Risha","the well-rope, the fish — connection, drawing up",{"binding":-0.2,"gentle":0.3,"outward":-0.2})]
for i,(nm,gloss,ax) in enumerate(MANAZIL,start=1):
    DATA.append(E(f"mz-{i:02d}","anwa-manzil",nm,"☾",[w.strip() for w in gloss.split("—")[1].split(",")][:3] if "—" in gloss else [gloss],ax,
        "Arabic anwā' / manāzil al-qamar — the 28 lunar stations (pre-Islamic Arabian star-calendar)","convention","computed","both",
        f"Lunar station {i} of 28 — {gloss}.",["arabia"],tier="celebrated",extra={"manzilNum":i}))

# =====================================================================
# PLANETARY HOURS — 7 rulers, rotating through the day (Chaldean order). SUB-DAY.
# computed, celebrated. Quality-bearing → feeds the chord, shifts through the day.
# =====================================================================
PHOURS=[("Saturn","☄","limitation, discipline, gravity, the sober hour",{"active":-0.2,"warm":-0.6,"binding":0.8,"gentle":-0.4,"light":-0.3}),
("Jupiter","♃","expansion, fortune, generosity, the benevolent hour",{"active":0.5,"rising":0.5,"warm":0.4,"outward":0.5,"gentle":0.5}),
("Mars","♂","force, urgency, courage, the sharp hour",{"active":0.9,"warm":0.4,"gentle":-0.8}),
("Sun","☉","vitality, clarity, sovereignty, the radiant hour",{"active":0.6,"warm":0.8,"outward":0.7,"light":0.9}),
("Venus","♀","love, harmony, beauty, the sweet hour",{"active":-0.1,"warm":0.5,"outward":0.2,"gentle":0.8}),
("Mercury","☿","mind, exchange, quickness, the clever hour",{"active":0.5,"steady":-0.6,"outward":0.3,"light":0.3}),
("Moon","☽","feeling, tide, reflection, the fluid hour",{"active":-0.5,"outward":-0.4,"gentle":0.5,"light":-0.3})]
for nm,gl,gloss,ax in PHOURS:
    DATA.append(E(f"ph-{nm.lower()}","planetary-hour",f"{nm} hour",gl,[w.strip() for w in gloss.split(",")][:3],ax,
        "Classical planetary hours (Chaldean order) — unequal hours dividing day/night, each planet-ruled","convention","computed","moment",
        f"The hour of {nm} — {gloss}. Hours are unequal, stretching with the season's daylight.",["mediterranean","babylon"],tier="celebrated"))

# =====================================================================
# CHINESE SHI — 12 double-hours, each an Earthly Branch + animal. SUB-DAY.
# =====================================================================
SHI=[("Zi","Rat","23:00–01:00 — midnight, stillness, the seed of yang",{"active":-0.4,"outward":-0.5,"light":-0.6}),
("Chou","Ox","01:00–03:00 — deep night, patient labor unseen",{"steady":0.6,"outward":-0.4,"light":-0.5}),
("Yin","Tiger","03:00–05:00 — before dawn, the stirring, first courage",{"active":0.5,"rising":0.5,"light":-0.2}),
("Mao","Rabbit","05:00–07:00 — sunrise, gentle emergence, the soft light",{"rising":0.5,"gentle":0.5,"light":0.4}),
("Chen","Dragon","07:00–09:00 — morning vigor, the rising power",{"active":0.6,"rising":0.6,"outward":0.5,"light":0.5}),
("Si","Snake","09:00–11:00 — late morning, focused warmth, coiled intent",{"active":0.3,"warm":0.4,"outward":-0.3}),
("Wu","Horse","11:00–13:00 — noon, the peak of yang, full radiance",{"active":0.7,"warm":0.7,"outward":0.6,"light":0.8}),
("Wei","Goat","13:00–15:00 — early afternoon, ease, gentle grazing",{"active":-0.2,"gentle":0.5,"warm":0.3}),
("Shen","Monkey","15:00–17:00 — afternoon, cleverness, restless play",{"active":0.6,"steady":-0.6,"outward":0.3}),
("You","Rooster","17:00–19:00 — sunset, gathering-in, the herald of dusk",{"active":0.3,"outward":0.4,"light":0.2}),
("Xu","Dog","19:00–21:00 — evening, loyalty, the guarded hearth",{"steady":0.4,"gentle":0.3,"outward":-0.2}),
("Hai","Pig","21:00–23:00 — late night, rest, honest sleep",{"active":-0.5,"gentle":0.4,"outward":-0.4,"light":-0.4})]
for br,an,gloss,ax in SHI:
    DATA.append(E(f"shi-{br.lower()}","chinese-shi",f"{br} ({an}) hour","時",[w.strip() for w in gloss.split("—")[1].split(",")][:3],ax,
        "Chinese shí (時辰) — the 12 traditional double-hours, each an Earthly Branch + animal","convention","computed","moment",
        f"The double-hour of {an} — {gloss}.",["china","east-asia"],tier="celebrated",extra={"branch":br,"animal":an}))

# =====================================================================
# NUMEROLOGY — 0-9. celebrated. Reads the moment's live numbers (date/hour reduced).
# =====================================================================
NUM=[("0","the void, potential, the unmanifest circle",{"outward":-0.5,"light":-0.4,"binding":-0.3}),
("1","unity, initiation, the singular will",{"active":0.8,"rising":0.6,"outward":0.4}),
("2","duality, balance, receptive pairing",{"active":-0.4,"gentle":0.5,"steady":0.2}),
("3","creativity, synthesis, joyful expression",{"active":0.5,"rising":0.4,"outward":0.5,"warm":0.3}),
("4","structure, foundation, the stable square",{"steady":0.8,"binding":0.7}),
("5","change, freedom, restless motion",{"active":0.6,"steady":-0.8,"outward":0.3}),
("6","harmony, care, nurturing responsibility",{"warm":0.4,"gentle":0.7,"binding":0.2}),
("7","mystery, inwardness, the seeker's depth",{"active":-0.4,"outward":-0.7,"light":-0.3}),
("8","power, cycle, material mastery, the infinite loop",{"active":0.5,"binding":0.5,"outward":0.4}),
("9","completion, wisdom, the closing turn",{"rising":-0.3,"outward":0.3,"light":0.4,"gentle":0.4})]
for n,gloss,ax in NUM:
    DATA.append(E(f"num-{n}","numerology",f"Number {n}",n,[w.strip() for w in gloss.split(",")][:3],ax,
        "Numerology 0–9 — cross-cultural number-quality (Pythagorean, Vedic, Chinese roots)","interpretation","computed","both",
        f"The quality of {n} — {gloss}.",["global"],tier="celebrated",extra={"digit":int(n)}))

# =====================================================================
# MUHURTA — 30 named day-parts (~48 min each), Vedic. computed, celebrated. SUB-DAY.
# The 30 muhurtas of the day, several with distinct traditional character.
# =====================================================================
MUHURTA=[("Rudra","fierce power, dissolution",{"active":0.5,"gentle":-0.6}),("Ahi","the serpent, latent danger",{"outward":-0.4,"light":-0.4}),
("Mitra","friendship, warmth, alliance",{"warm":0.4,"gentle":0.5}),("Pitri","the ancestors, memory, lineage",{"outward":-0.3,"steady":0.3}),
("Vasu","wealth, the good things, abundance",{"warm":0.3,"rising":0.4}),("Vara","the boon, blessing, choice",{"gentle":0.4,"light":0.3}),
("Vishvavasu","universal wealth, shared good",{"outward":0.4,"warm":0.3}),("Abhijit","the victorious, midday's crown — most auspicious",{"active":0.5,"outward":0.5,"light":0.7,"rising":0.4}),
("Rohini","growth, fertility, ascent",{"rising":0.5,"warm":0.3}),("Bala","strength, vigor",{"active":0.6}),
("Vijaya","victory, triumph, the winning turn",{"active":0.5,"rising":0.5,"outward":0.4}),("Naishreyasa","the highest good, excellence",{"rising":0.4,"light":0.4}),
("Varuna","the waters, depth, cosmic order",{"active":-0.3,"outward":-0.4,"binding":-0.2,"light":-0.2}),("Aryaman","nobility, honor, the shared path",{"steady":0.4,"gentle":0.4}),
("Bhaga","fortune, delight, the portioned gift",{"warm":0.4,"gentle":0.4,"outward":0.3}),("Girisha","the mountain-lord, stillness, height",{"steady":0.6,"outward":-0.3}),
("Ajapada","the one-footed, mysterious fire",{"active":0.3,"warm":0.2,"light":-0.2}),("Ahirbudhnya","the deep serpent, the abyss's wisdom",{"outward":-0.6,"binding":-0.3,"light":-0.3}),
("Pushan","the nourisher, safe passage",{"gentle":0.5,"binding":-0.2}),("Ashvini","the horse-twins, swift healing",{"active":0.7,"rising":0.5,"gentle":0.3}),
("Yama","restraint, the boundary, mortality",{"binding":0.5,"gentle":-0.4,"light":-0.3}),("Agni","fire, transformation, the kindling",{"active":0.6,"warm":0.7,"light":0.5}),
("Vidhatri","the ordainer, disposition, arrangement",{"binding":0.5,"steady":0.3}),("Kanda","the segment, division, articulation",{"binding":0.4}),
("Aditi","boundlessness, the infinite mother",{"outward":0.3,"gentle":0.6,"rising":0.3}),("Jiva","life-force, vitality, the living breath",{"active":0.5,"rising":0.4,"warm":0.3}),
("Vishnu","preservation, sustenance, the pervading",{"steady":0.5,"gentle":0.4,"light":0.3}),("Dyumadgadyuti","radiant splendor, brilliance",{"warm":0.4,"outward":0.5,"light":0.7}),
("Brahma","the sacred dawn-hour, creation, pure potential",{"rising":0.6,"light":0.5,"outward":-0.2}),("Samudram","the ocean, vastness, the gathering deep",{"outward":-0.3,"binding":-0.3,"gentle":0.3})]
for i,(nm,gloss,ax) in enumerate(MUHURTA,start=1):
    DATA.append(E(f"muh-{i:02d}","muhurta",nm,"⸙",[w.strip() for w in gloss.split(",")][:3],ax,
        "Vedic muhūrta — 30 divisions of the day (~48 min each), each with traditional character","convention","computed","moment",
        f"Muhūrta {i} of 30 — {gloss}.",["india"],tier="celebrated",extra={"muhurtaNum":i}))

# =====================================================================
# AXIS DENSITY — fill sparse computed systems toward full 8-axis coverage.
# We add gentle non-zero values where a system's character clearly implies a pole
# but was left blank. Conservative: only add where defensible.
# =====================================================================
def fill(id, **adds):
    for e in DATA:
        if e["id"]==id:
            for k,v in adds.items():
                if k not in e["ax"]: e["ax"][k]=v
            return

# Moon phases: add outward/gentle nuance
fill("mp-new", active=-0.3, gentle=0.2); fill("mp-wax-cres", active=0.2, warm=0.1)
fill("mp-first-q", steady=-0.2, gentle=-0.2); fill("mp-wax-gib", warm=0.2, steady=0.1)
fill("mp-full", active=0.3, warm=0.3, gentle=-0.1); fill("mp-wan-gib", active=-0.2, gentle=0.4)
fill("mp-last-q", steady=-0.2, binding=-0.2); fill("mp-wan-cres", gentle=0.3, binding=-0.3)
# Tzolkin tones: add outward/warm/gentle nuance where implied
fill("tn-1", outward=0.4, light=0.3); fill("tn-2", gentle=-0.2, outward=-0.2)
fill("tn-3", outward=0.4, warm=0.2); fill("tn-4", outward=-0.2); fill("tn-5", warm=0.3, light=0.4)
fill("tn-6", gentle=0.3, warm=0.2); fill("tn-7", light=0.3, active=-0.2); fill("tn-8", outward=0.3, light=0.3)
fill("tn-9", outward=0.4); fill("tn-10", outward=0.3, steady=0.3); fill("tn-11", outward=0.3, light=0.2)
fill("tn-12", warm=0.3, light=0.3); fill("tn-13", gentle=0.4, warm=0.2)

# tier recount + totals
from collections import Counter
tc=Counter(e["tier"] for e in DATA)
nc=Counter(e["nature"] for e in DATA)
sc=Counter(e["system"] for e in DATA)
print("TOTAL:",len(DATA))
print("tier:",dict(tc))
print("nature:",dict(nc))
print("\nsystems:")
for s,n in sorted(sc.items()): print(f"  {s:20} {n}")
json.dump({"axes":AXES,"axis_poles":POLES,"data":DATA},open("data.json","w"),indent=1,ensure_ascii=False)
print("\nwrote data.json")
