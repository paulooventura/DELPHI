# Completion pass — appends to master DATA: full sidereal 12, decans seated individually,
# Celtic 13, Cherokee 13 moons (honest convention), geo-heritage origin layer,
# and foreground/acknowledge honesty tiers.
import json
base = json.load(open("data.json"))
AXES = base["axes"]; POLES = base["axis_poles"]; DATA = base["data"]

def E(id, system, name, glyph, qualities, ax, source, claim, nature, observes, observed, origin=None, honesty="render"):
    d = dict(id=id, system=system, name=name, glyph=glyph, qualities=qualities, ax=ax,
             source=source, claim=claim, nature=nature, observes=observes, observed=observed)
    d["origin"] = origin or []          # regions this tradition arose in
    d["honesty"] = honesty              # render | foreground | acknowledge
    return d

# add origin+honesty defaults to existing entries by system
ORIGIN = {
  "element":["mediterranean","greece"], "western-zodiac":["mediterranean","babylon","greece"],
  "vedic-sidereal":["india"], "chinese-animal":["china","east-asia"], "wuxing":["china","east-asia"],
  "moon-phase":["global"], "planetary-day":["mediterranean","babylon"],
  "tzolkin-daysign":["mesoamerica"], "tzolkin-tone":["mesoamerica"], "nakshatra":["india"],
  "egyptian-decan":["egypt","nile"], "tarot-major":["europe"], "orisha-cast":["west-africa","yorubaland"],
  "iching-trigram":["china"], "celtic-tree":["modern"], "rune-cast":["scandinavia","germanic"],
}
for e in DATA:
    e.setdefault("origin", ORIGIN.get(e["system"], ["global"]))
    e.setdefault("honesty", "render")

# =====================================================================
# VEDIC SIDEREAL ZODIAC — full 12 (drop the placeholder row)
# Same signs as tropical but ~24° behind; the DIVERGENCE is the point.
# Qualities are the sidereal/Jyotish emphasis (guna, planetary dignity), not a copy.
# =====================================================================
DATA[:] = [e for e in DATA if e["id"] != "vs-note"]
def vs(id,name,glyph,quals,ax,ruler,observed):
    return E(id,"vedic-sidereal",name,glyph,quals,ax,
             f"Vedic sidereal (Lahiri ayanamsa); {ruler}-ruled — the fixed-star frame, ~24° behind tropical","convention","computed","both",observed,
             origin=["india"])
DATA += [
 vs("vsz-mesha","Mesha (Aries)","♈",["assertive","kindled","raw","impelling"],
    {"active":0.9,"rising":0.6,"steady":-0.2,"warm":0.6,"gentle":-0.5},"Mangala (Mars)",
    "Sidereal Aries — Mars-ruled kindling, the raw impelling force before the tropical season."),
 vs("vsz-vrishabha","Vrishabha (Taurus)","♉",["stable","sensory","fixed","fertile"],
    {"active":-0.4,"steady":0.9,"warm":0.2,"binding":0.6,"gentle":0.4},"Shukra (Venus)",
    "Sidereal Taurus — where the Moon is exalted; steady sensory fertility."),
 vs("vsz-mithuna","Mithuna (Gemini)","♊",["dual","communicative","clever","mobile"],
    {"active":0.5,"steady":-0.8,"outward":0.3,"light":0.3},"Budha (Mercury)",
    "Sidereal Gemini — Mercury's dual mind, the sidereal twins."),
 vs("vsz-karka","Karka (Cancer)","♋",["nurturing","emotional","cyclic","protective"],
    {"active":-0.5,"outward":-0.5,"gentle":0.7,"light":-0.2},"Chandra (Moon)",
    "Sidereal Cancer — the Moon's own home, Jupiter exalted; feeling as shelter."),
 vs("vsz-simha","Simha (Leo)","♌",["sovereign","radiant","dignified","fixed"],
    {"active":0.7,"steady":0.8,"warm":0.8,"outward":0.7,"light":0.7},"Surya (Sun)",
    "Sidereal Leo — the Sun's own sign, royal dignity held against the fixed stars."),
 vs("vsz-kanya","Kanya (Virgo)","♍",["discerning","serviceable","exacting","pure"],
    {"active":0.2,"steady":-0.2,"binding":0.6,"gentle":-0.2},"Budha (Mercury)",
    "Sidereal Virgo — where Mercury is exalted; discernment and refinement."),
 vs("vsz-tula","Tula (Libra)","♎",["balancing","relational","just","aesthetic"],
    {"active":0.3,"outward":0.2,"binding":0.2,"gentle":0.5,"light":0.3},"Shukra (Venus)",
    "Sidereal Libra — Saturn exalted here; the scales of relation and justice."),
 vs("vsz-vrishchika","Vrishchika (Scorpio)","♏",["intense","occult","penetrating","transformative"],
    {"active":0.4,"steady":0.6,"warm":-0.3,"outward":-0.8,"gentle":-0.5,"light":-0.7},"Mangala (Mars)",
    "Sidereal Scorpio — Mars-ruled depth, the occult still water, transformation held."),
 vs("vsz-dhanus","Dhanus (Sagittarius)","♐",["aspiring","dharmic","expansive","questing"],
    {"active":0.7,"rising":0.5,"steady":-0.5,"warm":0.5,"outward":0.6,"light":0.5},"Guru (Jupiter)",
    "Sidereal Sagittarius — Jupiter's own sign, the dharmic archer's far aim."),
 vs("vsz-makara","Makara (Capricorn)","♑",["disciplined","ambitious","enduring","structural"],
    {"active":0.3,"steady":0.7,"warm":-0.5,"binding":0.9,"gentle":-0.3,"light":-0.2},"Shani (Saturn)",
    "Sidereal Capricorn — Saturn's own sign, Mars exalted; the disciplined climb."),
 vs("vsz-kumbha","Kumbha (Aquarius)","♒",["principled","detached","communal","reforming"],
    {"active":0.4,"steady":0.5,"warm":-0.6,"outward":0.3,"light":0.3},"Shani (Saturn)",
    "Sidereal Aquarius — Saturn's other home; the water-bearer's detached gift to all."),
 vs("vsz-meena","Meena (Pisces)","♓",["devotional","boundless","compassionate","dissolving"],
    {"active":-0.7,"outward":-0.7,"binding":-0.9,"gentle":0.7,"light":-0.3},"Guru (Jupiter)",
    "Sidereal Pisces — Jupiter-ruled, Venus exalted; devotion dissolving into the boundless."),
]

# =====================================================================
# EGYPTIAN DECANS — reseat all 36 individually with proper per-decan qualities
# (replace the theme-seeded set). Grouped by the classical decan sequence.
# =====================================================================
DATA[:] = [e for e in DATA if e["system"] != "egyptian-decan"]
DECANS = [
 ("Tepy-a Khentet","first of Khentet",["heralding","emergent","fertile"],{"rising":0.7,"active":0.4,"light":0.3}),
 ("Khentet Khert","lower Khentet",["gestating","hidden","preparing"],{"rising":0.3,"outward":-0.4,"light":-0.3}),
 ("Tjemat Khert","lower Tjemat",["binding","forming","containing"],{"binding":0.6,"steady":0.4}),
 ("Sirius (Sopdet)","the flood-star",["renewing","brilliant","annual"],{"rising":0.8,"warm":0.5,"light":0.9,"outward":0.6}),
 ("Satet","the archer of the flood",["pouring","releasing","abundant"],{"active":0.5,"rising":0.6,"binding":-0.4}),
 ("Anuket","the embracer",["nourishing","enclosing","sustaining"],{"gentle":0.6,"binding":0.3,"warm":0.2}),
 ("Sopdu","the sharp one",["piercing","vigilant","frontier"],{"active":0.5,"gentle":-0.4,"light":0.4}),
 ("Sesheta","the counting star",["ordering","recording","precise"],{"binding":0.6,"steady":0.4,"light":0.3}),
 ("Kenmut","the dark bull",["potent","earthy","stubborn"],{"active":0.3,"steady":0.6,"warm":-0.2}),
 ("Semed Khert","lower Semed",["yielding","transitional","soft"],{"active":-0.3,"gentle":0.4,"binding":-0.3}),
 ("Semed Seru","upper Semed",["rising-power","commanding"],{"active":0.5,"rising":0.4,"outward":0.4}),
 ("Sawy Seru","guardians",["protective","watchful","paired"],{"steady":0.5,"gentle":0.2,"binding":0.4}),
 ("Areq Heru","the binder of Horus",["consolidating","sovereign","fixing"],{"binding":0.7,"steady":0.5,"light":0.4}),
 ("Remen Heru Khert","lower arm of Horus",["reaching","extending","active"],{"active":0.6,"outward":0.4}),
 ("Remen Heru Seru","upper arm of Horus",["lifting","aspiring","strong"],{"active":0.6,"rising":0.5,"outward":0.4}),
 ("Waret","the thigh",["grounding","supporting","stable"],{"steady":0.6,"binding":0.4,"warm":-0.1}),
 ("Tepy-a Akhwy","first of the two Akh-spirits",["luminous","ancestral","spirit"],{"light":0.6,"outward":-0.2}),
 ("Akhwy","the two spirits",["dual","mediating","liminal"],{"outward":-0.3,"light":0.2,"steady":-0.2}),
 ("Bawy","the two souls",["twinned","balancing","reflective"],{"steady":0.3,"outward":-0.2,"gentle":0.3}),
 ("Khentu Heru","in front of Horus",["leading","forward","vigilant"],{"active":0.6,"rising":0.4,"outward":0.5}),
 ("Khentu Khert","the lower foremost",["descending","deepening","inward"],{"active":-0.3,"outward":-0.5,"light":-0.4}),
 ("Qed","the builder",["constructing","enduring","methodical"],{"binding":0.8,"steady":0.6}),
 ("Sawy Qed","guardians of the builder",["defending","conserving","firm"],{"steady":0.6,"binding":0.5,"gentle":-0.2}),
 ("Khau","the thousands",["multiplying","abundant","teeming"],{"rising":0.5,"active":0.4,"outward":0.4}),
 ("Aret","the jaw / devourer",["consuming","transforming","fierce"],{"active":0.4,"gentle":-0.6,"light":-0.3}),
 ("Remen Hery","upper shoulder",["bearing","strong","upholding"],{"active":0.5,"steady":0.5,"binding":0.4}),
 ("Tjesaru","the two Tjeser stars",["sacred","set-apart","pure"],{"binding":0.4,"gentle":0.4,"light":0.5}),
 ("Ipedju","the numbered",["ordered","sequential","measured"],{"binding":0.5,"steady":0.5,"light":0.2}),
 ("Sebshesen","the star of provision",["providing","fertile","generous"],{"gentle":0.5,"warm":0.3,"rising":0.4}),
 ("Tepy-a Khentu","first of the foremost",["initiating","bright","forward"],{"active":0.6,"rising":0.5,"light":0.5}),
 ("Khentu heru khert","foremost below",["hidden-power","deep","latent"],{"outward":-0.5,"light":-0.4,"binding":0.3}),
 ("Hery-ib Wia","in the midst of the boat",["central","steering","balanced"],{"steady":0.5,"binding":0.3}),
 ("Shesmu","the wine/oil presser",["extracting","intense","transformative"],{"active":0.5,"gentle":-0.5,"binding":0.3}),
 ("Kenmu","the dark completion",["closing","deepening","final"],{"rising":-0.5,"outward":-0.4,"light":-0.5}),
 ("Tepy-a Semed","first of Semed",["turning","renewing","cyclic"],{"rising":0.3,"active":0.3}),
 ("Aker (double lion)","the horizon gate",["threshold","liminal","guarding-time"],{"binding":0.4,"steady":0.4,"light":0.2}),
]
for i,(nm,gloss,quals,ax) in enumerate(DECANS, start=1):
    DATA.append(E(f"dc-{i:02d}","egyptian-decan",f"Decan {i} · {nm}","✶",quals,ax,
        "Egyptian decan — sidereal star-group rising (~2100 BCE coffin-lid star clocks); later a deific astrological entity","interpretation","computed","both",
        f"The {i}th of 36 — {gloss}; the star-group that rose to mark this ten-day 'week'.",
        origin=["egypt","nile"]))

# =====================================================================
# CELTIC TREE — complete 13 (MODERN, Graves 1948) — birth-assigned, honest label
# =====================================================================
DATA[:] = [e for e in DATA if e["system"] != "celtic-tree"]
def ct(id,name,ogham,quals,ax,observed):
    return E(id,"celtic-tree",name,ogham,quals,ax,
             "Celtic tree 'zodiac' — MODERN system (Robert Graves, 1948); Ogham is an ancient script, NOT an ancient calendar","interpretation","birth","person",observed,
             origin=["modern"], honesty="render")
DATA += [
 ct("ct-birch","Birch","ᚁ",["pioneering","resilient","fresh","driven"],{"active":0.6,"rising":0.6,"steady":-0.2},"Beth — the pioneer, new beginnings, resilience in hard ground. (Modern: Graves.)"),
 ct("ct-rowan","Rowan","ᚂ",["protective","principled","visionary","independent"],{"active":0.4,"steady":0.4,"light":0.4},"Luis — the protector, moral conviction, light in darkness. (Modern.)"),
 ct("ct-ash","Ash","ᚃ",["connecting","imaginative","expansive","restless"],{"active":0.5,"steady":-0.4,"outward":0.3},"Nion — the world-tree link, reaching heaven and earth. (Modern.)"),
 ct("ct-alder","Alder","ᚄ",["courageous","guiding","self-reliant","warm"],{"active":0.6,"warm":0.3,"outward":0.4},"Fearn — the pathfinder, courage and guidance. (Modern.)"),
 ct("ct-willow","Willow","ᚌ",["intuitive","emotional","yielding","lunar"],{"active":-0.4,"outward":-0.4,"gentle":0.5,"light":-0.3},"Saille — the moon tree, intuition, bending unbroken. (Modern.)"),
 ct("ct-hawthorn","Hawthorn","ᚆ",["paradoxical","creative","fiery","hidden"],{"active":0.4,"steady":-0.3,"gentle":-0.2,"light":-0.2},"Huath — the contradictory heart, hidden fire behind a plain face. (Modern.)"),
 ct("ct-oak","Oak","ᚇ",["strong","protective","enduring","noble"],{"active":0.4,"steady":0.7,"binding":0.5,"gentle":0.2},"Duir — the doorway, strength and endurance, the noble. (Modern.)"),
 ct("ct-holly","Holly","ᚈ",["steadfast","determined","protective","just"],{"active":0.5,"steady":0.6,"gentle":-0.2},"Tinne — the warrior-guardian, steadfast through the dark half. (Modern.)"),
 ct("ct-hazel","Hazel","ᚉ",["wise","knowledgeable","artistic","intuitive"],{"active":0.3,"outward":-0.2,"light":0.4},"Coll — the tree of wisdom, knowledge and inspiration. (Modern.)"),
 ct("ct-vine","Vine","ᚋ",["sensual","changeable","refined","dual"],{"active":0.3,"steady":-0.5,"warm":0.3,"outward":0.3},"Muin — the vine, refinement and paradox, the harvest's pleasure. (Modern.)"),
 ct("ct-ivy","Ivy","ᚍ",["persistent","binding","resilient","spiraling"],{"active":0.2,"steady":0.5,"binding":0.6},"Gort — the ivy, persistence and the spiral, growth through obstacle. (Modern.)"),
 ct("ct-reed","Reed","ᚎ",["direct","searching","secret-keeping","purposeful"],{"active":0.4,"outward":-0.3,"binding":0.3,"light":-0.2},"Ngetal — the reed, direct purpose, the hidden meaning sought. (Modern.)"),
 ct("ct-elder","Elder","ᚏ",["renewing","liberating","fateful","transitional"],{"active":0.3,"rising":-0.3,"steady":-0.4,"light":-0.2},"Ruis — the elder, endings and renewal, the fated turn of the year. (Modern.)"),
]

# =====================================================================
# CHEROKEE THIRTEEN MOONS — honest CONVENTION, no fabricated personality qualities
# nature computed (which moon are we in?), honesty=foreground, source = published Cherokee materials
# qualities are SEASONAL/ECOLOGICAL descriptors, not personality — the honest kind.
# =====================================================================
def moon13(id,name,cherokee,quals,observed):
    return E(id,"cherokee-moon",name,"☾",quals,{},   # NO polarity scoring — not a personality system
             "Cherokee thirteen-moon calendar — seasonal/ceremonial count (per Cherokee Nation cultural resources). Presented as a calendar of place, not a personality reading","convention","computed","moment",observed,
             origin=["southeast-woodlands","cherokee"], honesty="foreground")
DATA += [
 moon13("ch-cold","Cold Moon","Unolvtani",["deep-winter","rest","storytelling"],"Winter's depth — the time of rest, family, and the telling of stories by fire."),
 moon13("ch-bony","Bony Moon","Kagali",["scarcity","fasting","endurance"],"The lean month — little food, a time of fasting and family ceremony."),
 moon13("ch-windy","Windy Moon","Anuyi",["first-stirring","planting-prep","change"],"The winds of change — first stirrings, preparation of the fields."),
 moon13("ch-flower","Flower Moon","Kawoni",["blossoming","planting","renewal"],"Blossom and planting — the earth waking, the first ceremonies of growth."),
 moon13("ch-planting","Planting Moon","Anaagvti",["sowing","cooperation","hope"],"The main planting — corn, beans, squash sown together, community labor."),
 moon13("ch-green-corn","Green Corn Moon","Tehaluyi",["ripening","gratitude","preparation"],"Green corn ripening — the approach of the year's central thanksgiving."),
 moon13("ch-ripe-corn","Ripe Corn Moon","Guyegwoni",["harvest","thanksgiving","fullness"],"Ripe corn — the Green Corn Ceremony, renewal, forgiveness, the new year's pivot."),
 moon13("ch-fruit","Fruit Moon","Galoni",["gathering","abundance","maturing"],"Fruit and nut gathering — the abundance of late summer secured."),
 moon13("ch-nut","Nut Moon","Duliisdi",["harvesting","storing","providing"],"Nut harvest — the last gathering, storing against winter."),
 moon13("ch-harvest","Harvest Moon","Duninudi",["completion","reckoning","fullness"],"The great harvest — fields cleared, the year's provision complete."),
 moon13("ch-hunting","Hunting Moon","Nvdadegwa",["hunting","provision","movement"],"The hunt — meat secured for winter, the turn toward the cold."),
 moon13("ch-snow","Snow Moon","Vsgiyi",["first-snow","withdrawing","quieting"],"First snows — the world drawing inward, the quiet returning."),
 moon13("ch-big-winter","Big Winter Moon","Vsgiyi (great)",["deep-cold","ancestral","turning"],"The great cold — the year turning, ancestors remembered, the cycle closing."),
]

print("TOTAL after completion:", len(DATA))
bn={}; bs={}
for e in DATA:
    bn[e['nature']]=bn.get(e['nature'],0)+1
    bs[e['system']]=bs.get(e['system'],0)+1
print("by nature:",bn)
for s,n in sorted(bs.items()): print(f"   {s}: {n}")

# geo-heritage origin index
origins={}
for e in DATA:
    for o in e.get("origin",[]):
        origins.setdefault(o,set()).add(e["system"])
print("\norigins →systems:")
for o,ss in sorted(origins.items()): print(f"   {o}: {sorted(ss)}")

json.dump({"axes":AXES,"axis_poles":POLES,"data":DATA}, open("data.json","w"), indent=1, ensure_ascii=False)
print("\nrewrote data.json")
