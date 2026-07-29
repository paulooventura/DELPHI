# Full-fidelity cast decks: 78 tarot, 64 I Ching hexagrams, 24 runes.
# Orisha stays 8 (honesty boundary). Appends to data.json.
import json
base=json.load(open("data.json"))
DATA=base["data"]; AXES=base["axes"]; POLES=base["axis_poles"]

def E(id,system,name,glyph,quals,ax,source,claim,nature,observes,observed,origin,honesty="render",extra=None):
    d=dict(id=id,system=system,name=name,glyph=glyph,qualities=quals,ax=ax,source=source,
           claim=claim,nature=nature,observes=observes,observed=observed,origin=origin,honesty=honesty)
    if extra: d.update(extra)
    return d

# ---- remove old partial sets we're replacing ----
DATA[:] = [e for e in DATA if e["system"] not in ("tarot-major","iching-trigram")]
# keep rune-cast(8)? replace with full 24
DATA[:] = [e for e in DATA if e["system"] != "rune-cast"]

# =====================================================================
# TAROT — 78 (22 Major + 56 Minor). cast/person. RWS.
# =====================================================================
MAJ=[("0","The Fool",["beginnings","leap","innocence","spontaneity"],{"active":0.6,"rising":0.7,"steady":-0.6,"light":0.4}),
("I","The Magician",["manifestation","will","skill","focus"],{"active":0.7,"outward":0.5,"binding":0.4,"light":0.5}),
("II","The High Priestess",["intuition","mystery","inner-knowing","stillness"],{"active":-0.6,"outward":-0.7,"light":-0.6}),
("III","The Empress",["abundance","nurture","fertility","creativity"],{"active":0.2,"rising":0.5,"warm":0.5,"gentle":0.7}),
("IV","The Emperor",["structure","authority","order","stability"],{"active":0.4,"steady":0.7,"binding":0.9,"gentle":-0.3}),
("V","The Hierophant",["tradition","teaching","meaning","conformity"],{"steady":0.6,"binding":0.6,"light":0.2}),
("VI","The Lovers",["union","choice","alignment","values"],{"active":0.3,"warm":0.5,"outward":0.3,"gentle":0.5}),
("VII","The Chariot",["drive","willpower","direction","victory"],{"active":0.8,"rising":0.5,"steady":0.2,"gentle":-0.3}),
("VIII","Strength",["courage","gentleness","inner-power","patience"],{"active":0.3,"warm":0.4,"gentle":0.7}),
("IX","The Hermit",["solitude","search","inner-light","withdrawal"],{"active":-0.5,"outward":-0.8,"light":-0.2}),
("X","Wheel of Fortune",["cycles","turning-point","fate","momentum"],{"active":0.3,"steady":-0.8}),
("XI","Justice",["balance","truth","consequence","fairness"],{"steady":0.5,"binding":0.6,"gentle":-0.2,"light":0.5}),
("XII","The Hanged Man",["suspension","surrender","new-perspective","pause"],{"active":-0.6,"rising":-0.4,"binding":-0.5}),
("XIII","Death",["ending","transformation","release","rebirth"],{"active":-0.2,"rising":-0.6,"binding":-0.6,"gentle":-0.4,"light":-0.4}),
("XIV","Temperance",["balance","blending","patience","moderation"],{"active":0.0,"steady":0.4,"gentle":0.5,"binding":0.2}),
("XV","The Devil",["bondage","shadow","desire","attachment"],{"active":0.3,"binding":0.7,"gentle":-0.6,"light":-0.7}),
("XVI","The Tower",["upheaval","sudden-change","revelation","collapse"],{"active":0.7,"steady":-0.9,"gentle":-0.8,"light":0.3}),
("XVII","The Star",["hope","renewal","serene","faith","healing"],{"active":-0.2,"rising":0.3,"gentle":0.6,"light":0.5}),
("XVIII","The Moon",["illusion","dream","unconscious","uncertainty"],{"active":-0.4,"outward":-0.6,"light":-0.8}),
("XIX","The Sun",["joy","clarity","vitality","warmth","success"],{"active":0.6,"warm":0.9,"outward":0.6,"light":0.9}),
("XX","Judgement",["awakening","reckoning","calling","renewal"],{"active":0.5,"rising":0.6,"outward":0.4,"light":0.6}),
("XXI","The World",["completion","wholeness","integration","fulfillment"],{"active":0.3,"binding":0.3,"light":0.5,"gentle":0.4})]
for num,name,quals,ax in MAJ:
    DATA.append(E(f"ta-maj-{num}","tarot-major",name,num,quals,ax,
        "Rider-Waite-Smith Major Arcana","interpretation","cast","person",
        f"Major Arcana {num} — {name}.",["europe"],extra={"arcana":"major","rank":num}))

# Minor arcana — 4 suits x 14. Suit qualities + rank progression.
SUITS={
 "wands":dict(glyph="🔥",elem="Fire",ax={"active":0.6,"warm":0.5,"outward":0.4},
   quals=["will","passion","creativity","drive"],origin=["europe"]),
 "cups":dict(glyph="💧",elem="Water",ax={"active":-0.4,"warm":0.2,"gentle":0.5,"outward":-0.3},
   quals=["emotion","love","intuition","relationship"],origin=["europe"]),
 "swords":dict(glyph="⚔",elem="Air",ax={"active":0.4,"steady":-0.4,"gentle":-0.5,"light":0.3},
   quals=["intellect","conflict","truth","clarity"],origin=["europe"]),
 "pentacles":dict(glyph="🪙",elem="Earth",ax={"active":0.1,"steady":0.6,"binding":0.5},
   quals=["material","work","body","resources"],origin=["europe"]),
}
RANKS=[("ace","Ace",["seed","potential","gift","essence"],{"rising":0.5}),
("2","Two",["balance","choice","partnership"],{}),("3","Three",["growth","expression","collaboration"],{"rising":0.3}),
("4","Four",["stability","structure","rest"],{"steady":0.4,"binding":0.3}),("5","Five",["conflict","loss","challenge"],{"gentle":-0.4,"steady":-0.3}),
("6","Six",["harmony","recovery","reciprocity"],{"gentle":0.3}),("7","Seven",["assessment","perseverance","strategy"],{"outward":-0.2}),
("8","Eight",["movement","mastery","momentum"],{"active":0.4}),("9","Nine",["attainment","near-completion","solitude"],{"rising":0.4}),
("10","Ten",["completion","culmination","burden"],{"binding":0.4}),
("page","Page",["curiosity","message","new-study"],{"active":0.3,"rising":0.4}),
("knight","Knight",["action","pursuit","momentum"],{"active":0.6}),
("queen","Queen",["mastery","nurture","inward-authority"],{"outward":-0.2,"gentle":0.3}),
("king","King",["mastery","command","outward-authority"],{"outward":0.4,"binding":0.4})]
for suit,sd in SUITS.items():
    for rk,rname,rquals,rax in RANKS:
        ax=dict(sd["ax"]);
        for k,v in rax.items(): ax[k]=max(-1,min(1,ax.get(k,0)+v))
        DATA.append(E(f"ta-{suit}-{rk}","tarot-minor",f"{rname} of {suit.capitalize()}",sd["glyph"],
            list(dict.fromkeys(sd["quals"][:2]+rquals)),ax,
            f"Rider-Waite-Smith Minor Arcana — Suit of {suit.capitalize()} ({sd['elem']})","interpretation","cast","person",
            f"{rname} of {suit.capitalize()} — {sd['elem']} suit, {rname.lower()} rank.",sd["origin"],
            extra={"arcana":"minor","suit":suit,"rank":rk}))

# =====================================================================
# I CHING — 64 hexagrams. cast/person. Wilhelm/Baynes names.
# Built from two trigrams; changing-line logic handled in app.
# =====================================================================
HEX=[(1,"The Creative","Qian","force, initiative, pure yang, heaven",{"active":0.9,"rising":0.6,"light":0.6}),
(2,"The Receptive","Kun","yielding, devotion, pure yin, earth",{"active":-0.9,"gentle":0.6,"binding":0.3}),
(3,"Difficulty at the Beginning","Zhun","sprouting through obstacle, initial chaos",{"active":0.3,"steady":-0.5,"rising":0.4}),
(4,"Youthful Folly","Meng","inexperience, the need to learn",{"active":0.2,"light":-0.3}),
(5,"Waiting","Xu","patience, nourishment, timing",{"active":-0.3,"steady":0.4}),
(6,"Conflict","Song","tension, dispute, opposition",{"active":0.4,"gentle":-0.6,"steady":-0.3}),
(7,"The Army","Shi","discipline, organized force, leadership",{"active":0.5,"binding":0.5,"gentle":-0.3}),
(8,"Holding Together","Bi","union, alliance, belonging",{"gentle":0.5,"outward":0.3}),
(9,"Small Taming","Xiao Chu","gentle restraint, minor influence",{"active":-0.2,"gentle":0.4}),
(10,"Treading","Lu","conduct, careful progress",{"active":0.3,"steady":0.3}),
(11,"Peace","Tai","harmony, flourishing, heaven and earth meet",{"gentle":0.6,"rising":0.4,"light":0.4}),
(12,"Standstill","Pi","stagnation, blockage, withdrawal",{"active":-0.5,"rising":-0.5,"light":-0.4}),
(13,"Fellowship","Tong Ren","community, shared purpose",{"outward":0.5,"gentle":0.4}),
(14,"Great Possession","Da You","abundance, clarity, sovereignty",{"rising":0.5,"outward":0.5,"light":0.6}),
(15,"Modesty","Qian","humility, balance, moderation",{"active":-0.2,"gentle":0.5,"outward":-0.3}),
(16,"Enthusiasm","Yu","inspiration, readiness, movement",{"active":0.6,"rising":0.5,"outward":0.4}),
(17,"Following","Sui","adaptation, going with, responsiveness",{"active":0.2,"steady":-0.4}),
(18,"Work on the Decayed","Gu","repair, addressing corruption",{"active":0.4,"binding":0.3}),
(19,"Approach","Lin","advance, growing influence",{"active":0.5,"rising":0.5}),
(20,"Contemplation","Guan","observation, perspective, overview",{"active":-0.4,"outward":-0.3,"light":0.3}),
(21,"Biting Through","Shi He","decisive action, breaking obstacle",{"active":0.6,"gentle":-0.5}),
(22,"Grace","Bi","beauty, form, adornment",{"warm":0.3,"outward":0.4,"gentle":0.4}),
(23,"Splitting Apart","Bo","collapse, deterioration, letting fall",{"active":-0.4,"rising":-0.7,"binding":-0.5,"light":-0.4}),
(24,"Return","Fu","turning point, renewal, the light returns",{"rising":0.6,"light":0.3}),
(25,"Innocence","Wu Wang","spontaneity, natural action, integrity",{"active":0.4,"gentle":0.3,"light":0.4}),
(26,"Great Taming","Da Chu","great restraint, stored power",{"steady":0.6,"binding":0.6}),
(27,"Nourishment","Yi","providing, care, what one takes in",{"gentle":0.5,"binding":0.2}),
(28,"Great Exceeding","Da Guo","excess, critical mass, the beam bends",{"active":0.5,"steady":-0.5}),
(29,"The Abysmal","Kan","danger, depth, repeated hazard, water",{"active":-0.3,"outward":-0.5,"light":-0.6}),
(30,"The Clinging","Li","clarity, radiance, dependence, fire",{"active":0.5,"warm":0.7,"light":0.8}),
(31,"Influence","Xian","attraction, courtship, mutual feeling",{"active":0.3,"warm":0.4,"outward":0.3,"gentle":0.4}),
(32,"Duration","Heng","endurance, constancy, the lasting",{"steady":0.7,"binding":0.4}),
(33,"Retreat","Dun","withdrawal, strategic distance",{"active":-0.4,"outward":-0.5}),
(34,"Great Power","Da Zhuang","great strength, vigor",{"active":0.8,"outward":0.4,"gentle":-0.3}),
(35,"Progress","Jin","advance, rising ease, dawn",{"active":0.5,"rising":0.6,"light":0.6}),
(36,"Darkening of the Light","Ming Yi","adversity, hiding one's light",{"active":-0.4,"outward":-0.5,"light":-0.7}),
(37,"The Family","Jia Ren","clan, roles, domestic order",{"steady":0.5,"binding":0.4,"gentle":0.3}),
(38,"Opposition","Kui","estrangement, contradiction, polarity",{"steady":-0.5,"gentle":-0.3}),
(39,"Obstruction","Jian","impasse, difficulty, the halt",{"active":-0.4,"rising":-0.4}),
(40,"Deliverance","Jie","release, relief, resolution",{"active":0.4,"binding":-0.5,"light":0.3}),
(41,"Decrease","Sun","reduction, sacrifice, simplifying",{"active":-0.3,"binding":-0.3,"rising":-0.3}),
(42,"Increase","Yi","gain, expansion, benefit",{"active":0.5,"rising":0.6}),
(43,"Breakthrough","Guai","resolution, decisive break",{"active":0.7,"rising":0.4,"gentle":-0.3}),
(44,"Coming to Meet","Gou","encounter, temptation, the unexpected",{"active":0.3,"steady":-0.4}),
(45,"Gathering Together","Cui","assembly, collection, congregation",{"outward":0.4,"gentle":0.3}),
(46,"Pushing Upward","Sheng","ascent, gradual growth, effort rewarded",{"active":0.4,"rising":0.7}),
(47,"Oppression","Kun","exhaustion, confinement, adversity",{"active":-0.5,"binding":0.4,"light":-0.4}),
(48,"The Well","Jing","source, nourishment, the constant deep",{"steady":0.5,"outward":-0.3}),
(49,"Revolution","Ge","radical change, molting, overthrow",{"active":0.6,"steady":-0.7}),
(50,"The Cauldron","Ding","transformation, nourishment, the sacred vessel",{"binding":0.4,"warm":0.3,"light":0.3}),
(51,"The Arousing","Zhen","shock, thunder, sudden movement",{"active":0.7,"steady":-0.6,"rising":0.5}),
(52,"Keeping Still","Gen","stillness, mountain, meditation",{"active":-0.4,"steady":0.8,"binding":0.5}),
(53,"Development","Jian","gradual progress, patient advance",{"active":0.3,"rising":0.4,"steady":0.3}),
(54,"The Marrying Maiden","Gui Mei","subordinate relationship, transient bond",{"active":0.2,"steady":-0.3}),
(55,"Abundance","Feng","fullness, peak, zenith",{"rising":0.5,"outward":0.5,"light":0.6}),
(56,"The Wanderer","Lu","transience, the traveler, impermanence",{"active":0.3,"steady":-0.6,"outward":-0.2}),
(57,"The Gentle","Xun","penetration, wind, gradual influence",{"active":0.3,"steady":-0.4,"gentle":0.6}),
(58,"The Joyous","Dui","joy, openness, the lake",{"active":0.3,"warm":0.4,"outward":0.5,"gentle":0.5}),
(59,"Dispersion","Huan","dissolution, dispersal, breaking rigidity",{"active":0.2,"binding":-0.7}),
(60,"Limitation","Jie","boundaries, restraint, articulation",{"steady":0.5,"binding":0.6}),
(61,"Inner Truth","Zhong Fu","sincerity, inner alignment, trust",{"outward":-0.3,"gentle":0.5,"light":0.4}),
(62,"Small Exceeding","Xiao Guo","attention to detail, minor excess",{"active":0.1,"steady":-0.2}),
(63,"After Completion","Ji Ji","fulfillment achieved, the ordered moment",{"binding":0.4,"steady":0.4,"light":0.4}),
(64,"Before Completion","Wei Ji","threshold, almost-there, the final effort",{"active":0.4,"rising":0.4})]
for num,name,pinyin,gloss,ax in HEX:
    DATA.append(E(f"ic-hex-{num:02d}","iching-hexagram",f"{num}. {name}","☰",
        [w.strip() for w in gloss.split(",")],ax,
        "I Ching (Zhou Yi), 64 hexagrams — Wilhelm/Baynes","interpretation","cast","person",
        f"Hexagram {num}, {pinyin} — {gloss}.",["china"],extra={"hexNum":num,"pinyin":pinyin}))

# =====================================================================
# RUNES — 24 Elder Futhark (no blank). cast/person. Rune-poem meanings.
# =====================================================================
RUNES=[("Fehu","ᚠ","wealth, cattle, mobile abundance, new resources",{"active":0.5,"rising":0.5,"outward":0.3}),
("Uruz","ᚢ","aurochs, raw strength, vitality, untamed power",{"active":0.7,"warm":0.3,"gentle":-0.4}),
("Thurisaz","ᚦ","thorn, giant, reactive force, defense",{"active":0.7,"gentle":-0.7,"light":-0.2}),
("Ansuz","ᚨ","the god, mouth, wisdom, inspired speech",{"active":0.4,"outward":0.3,"light":0.5}),
("Raidho","ᚱ","the ride, journey, rhythm, right order",{"active":0.5,"steady":0.2,"binding":0.3}),
("Kenaz","ᚲ","torch, craft, illumination, kindled knowledge",{"active":0.4,"warm":0.5,"light":0.6}),
("Gebo","ᚷ","gift, exchange, union, balance of giving",{"active":0.1,"outward":0.3,"gentle":0.5}),
("Wunjo","ᚹ","joy, harmony, fellowship, fulfillment",{"active":0.3,"warm":0.5,"outward":0.4,"gentle":0.5}),
("Hagalaz","ᚺ","hail, disruption, uncontrolled force, testing",{"active":0.4,"steady":-0.7,"gentle":-0.6}),
("Nauthiz","ᚾ","need, constraint, necessity, the friction that shapes",{"active":-0.2,"binding":0.4,"gentle":-0.3}),
("Isa","ᛁ","ice, stillness, standstill, frozen potential",{"active":-0.6,"steady":0.7,"binding":0.4,"light":-0.2}),
("Jera","ᛃ","year, harvest, cycle, reward of right timing",{"rising":0.4,"steady":0.3,"gentle":0.3}),
("Eihwaz","ᛇ","yew, the world-tree axis, endurance, death-and-life",{"steady":0.6,"binding":0.4,"light":-0.2}),
("Perthro","ᛈ","the lot-cup, mystery, fate, hidden chance",{"outward":-0.5,"light":-0.5}),
("Algiz","ᛉ","elk, protection, the warding, connection to the divine",{"active":0.3,"binding":0.4,"light":0.4}),
("Sowilo","ᛋ","sun, victory, wholeness, guiding light",{"active":0.5,"warm":0.6,"outward":0.5,"light":0.8}),
("Tiwaz","ᛏ","Tyr, justice, sacrifice, the guiding star",{"active":0.5,"binding":0.4,"gentle":-0.2,"light":0.4}),
("Berkano","ᛒ","birch, growth, birth, nurture, becoming",{"rising":0.6,"gentle":0.6}),
("Ehwaz","ᛖ","horse, partnership, trust, harmonious movement",{"active":0.4,"outward":0.3,"gentle":0.3}),
("Mannaz","ᛗ","humanity, the self, community, mind",{"outward":0.2,"light":0.3}),
("Laguz","ᛚ","water, flow, intuition, the unconscious deep",{"active":-0.5,"outward":-0.5,"binding":-0.5,"light":-0.3}),
("Ingwaz","ᛜ","Ing, gestation, potential stored, the seed within",{"active":-0.2,"binding":0.3,"rising":0.2}),
("Dagaz","ᛞ","day, dawn, breakthrough, awakening",{"active":0.4,"rising":0.5,"light":0.7}),
("Othala","ᛟ","ancestral land, heritage, inheritance, home",{"steady":0.6,"binding":0.5})]
for name,glyph,gloss,ax in RUNES:
    DATA.append(E(f"ru-{name.lower()}","rune-cast",name,glyph,
        [w.strip() for w in gloss.split(",")[:4]],ax,
        "Elder Futhark (24 runes) — meanings from the rune poems; a cast is traditional, a birthdate 'rune zodiac' is modern","interpretation","cast","person",
        f"{name} — {gloss}.",["scandinavia","germanic"],extra={"futhark":"elder"}))

print("TOTAL:",len(DATA))
bs={}
for e in DATA: bs[e["system"]]=bs.get(e["system"],0)+1
for s,n in sorted(bs.items()): print(f"  {s}: {n}")
cast_ct=sum(1 for e in DATA if e["nature"]=="cast")
print("cast entries:",cast_ct)
json.dump({"axes":AXES,"axis_poles":POLES,"data":DATA},open("data.json","w"),indent=1,ensure_ascii=False)
print("rewrote data.json")
