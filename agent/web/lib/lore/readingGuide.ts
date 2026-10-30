/**
 * READING GUIDE — how to read a draw, and what it may mean for the person.
 * ----------------------------------------------------------------------------
 * Pure and on-device: built only from the CastResult. Same draw → same text.
 * A reading is a mirror for the question, never a prediction. No fate, no
 * "you will". Hard cards get hand-written, careful lines (CAREFUL below).
 * Mechanics described here are only the ones cast.ts actually performs:
 * tarot reversals, I Ching changing lines → relating hexagram, cowrie
 * mouth-up count → one of eight principal Orisha. Runes have no reversals.
 */

import type { CastResult, DrawnCard } from "./cast";
import type { Axis, QualiaEntry } from "./qualia";

export type HowToRead = { title: string; steps: string[] };
export type DrawMeaning = { position?: string; name: string; meaning: string };
export type WhatItMeans = { perDraw: DrawMeaning[]; together: string; reflect: string };

type Family = "tarot" | "iching" | "rune" | "orisha" | "other";

function familyOf(system: string): Family {
  if (system.startsWith("tarot")) return "tarot";
  if (system.startsWith("iching")) return "iching";
  if (system.startsWith("rune")) return "rune";
  if (system.startsWith("orisha")) return "orisha";
  return "other";
}

const UNIT: Record<Family, [string, string]> = {
  tarot: ["card", "cards"],
  iching: ["hexagram", "hexagrams"],
  rune: ["rune", "runes"],
  orisha: ["Orisha", "Orisha"],
  other: ["draw", "draws"],
};

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const numWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const lowerFirst = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);

function cardsOf(result: CastResult): DrawnCard[] {
  return result.cards && result.cards.length === result.drawn.length
    ? result.cards
    : result.drawn.map(entry => ({ entry }));
}

// ---------------------------------------------------------------------------
// HOW TO READ
// ---------------------------------------------------------------------------

export function howToRead(result: CastResult): HowToRead {
  const fam = familyOf(result.system);
  const cards = cardsOf(result);
  const reversedCount = cards.filter(c => c.reversed).length;

  if (fam === "tarot") {
    const n = cards.length;
    const reversedStep =
      reversedCount === 0
        ? "Every card came upright, so read each one as it stands."
        : reversedCount === 1
          ? "One card came reversed (upside down). Reversed turns its meaning inward: slower, held back, or something to tend inside you first."
          : `${cap(numWord(reversedCount))} cards came reversed (upside down). Reversed turns a card's meaning inward: slower, held back, or something to tend inside you first.`;
    if (n <= 1) {
      return {
        title: "How to read one card",
        steps: [
          "One card, one focus. Hold your question and look at the card.",
          reversedStep,
          "Read its qualities as a mirror for your question, not as an answer about what comes next.",
        ],
      };
    }
    if (n === 3) {
      return {
        title: "How to read three cards",
        steps: [
          "Read from left to right: what's behind you, where you are now, and what leans forward.",
          reversedStep,
          "Then look at all three as one short story about your question. The last card shows a direction, not a fixed result.",
        ],
      };
    }
    if (n === 10) {
      return {
        title: "How to read the Celtic Cross",
        steps: [
          "Start in the middle: card 1 is where you are, and card 2 is what crosses you.",
          "Cards 3 to 6 sit around them: what's underneath, just behind you, what you're reaching for, and what's coming closer.",
          "Cards 7 to 10 run up the side: how you're meeting it, what's around you, your hopes and fears, and where things lean now.",
          reversedStep,
        ],
      };
    }
    return {
      title: "How to read your cards",
      steps: [
        "Read the cards in the order they were laid.",
        reversedStep,
        "Then look at them together as one story about your question.",
      ],
    };
  }

  if (fam === "iching") {
    const changing = result.changingLines ?? [];
    const steps = [
      "The hexagram was built from the bottom up: six tosses of three coins, one line each.",
      "The first hexagram shows how things stand now.",
    ];
    if (changing.length > 0 && result.relating) {
      steps.push(
        `${changing.length === 1 ? "Line" : "Lines"} ${listJoin(changing.map(String))} ${changing.length === 1 ? "is" : "are"} changing (its three coins added up to 6 or 9). That's where the situation is already moving.`,
        "The second hexagram is where it leans once those lines turn. A direction, not a verdict.",
      );
    } else if (changing.length > 0) {
      steps.push(
        `${changing.length === 1 ? "Line" : "Lines"} ${listJoin(changing.map(String))} ${changing.length === 1 ? "is" : "are"} changing, but the picture stays the same hexagram. Read it as movement inside the same moment.`,
      );
    } else {
      steps.push("No lines are changing this time, so read the one hexagram as a whole. Things are steady for now.");
    }
    return { title: "How to read a hexagram", steps };
  }

  if (fam === "rune") {
    if (cards.length <= 1) {
      return {
        title: "How to read a rune",
        steps: [
          "Keep your question in mind. The rune you drew speaks to it.",
          "Read its qualities as a mirror for the question, not an answer about what comes next.",
          "Runes here are read as drawn: no reversed or blank staves.",
        ],
      };
    }
    return {
      title: "How to read the Norns' cast",
      steps: [
        "Read from left to right: what was, what is, and what leans forward.",
        "Runes here are read as drawn: no reversed or blank staves.",
        "Then see how the three speak to each other about your question.",
      ],
    };
  }

  if (fam === "orisha") {
    if (typeof result.cowrieUp === "number") {
      const n = result.cowrieUp;
      return {
        title: "How to read the cowries",
        steps: [
          `Sixteen shells were thrown and ${numWord(n)} landed mouth up.`,
          "Here, that count points to one of eight principal Orisha: fewer open mouths lead toward the first of them, more toward the last.",
          "This is a homage, not the full odu of a traditional reading. Take the Orisha's qualities as a mirror for your question.",
          "For a true reading, seek an initiated babalawo or priest.",
        ],
      };
    }
    return {
      title: "How to read your Orisha",
      steps: [
        "One of eight principal Orisha was drawn by chance. It's not a cowrie cast.",
        "Take the Orisha's qualities as a mirror for your question.",
        "For a true reading, seek an initiated babalawo or priest.",
      ],
    };
  }

  return {
    title: "How to read your draw",
    steps: [
      "Look at each part in order.",
      "Read its qualities as a mirror for your question.",
      "Then look at the whole.",
    ],
  };
}

// ---------------------------------------------------------------------------
// WHAT IT MEANS
// ---------------------------------------------------------------------------

/** Raw quality words that read harsh or fatalistic on their own. */
const SOFTEN: Record<string, string> = {
  adversity: "a hard stretch",
  bondage: "feeling tied down",
  burden: "a heavy load",
  collapse: "something giving way",
  confinement: "feeling hemmed in",
  conflict: "friction",
  danger: "a need for care",
  "death-and-life": "the turn from an ending to new life",
  deterioration: "something wearing thin",
  destiny: "the path you're walking",
  fate: "what you've been given",
  dispute: "disagreement",
  dissolution: "something dissolving",
  ending: "a chapter closing",
  estrangement: "distance between people",
  exhaustion: "tiredness",
  illusion: "what may not be as it seems",
  impasse: "a stuck place",
  "letting fall": "letting things fall away",
  loss: "letting go",
  opposition: "pulls in different directions",
  overthrow: "old structures shifting",
  reckoning: "taking stock",
  "repeated hazard": "the same difficulty returning",
  sacrifice: "giving something up",
  shock: "a jolt",
  stagnation: "stillness that wants to move",
  standstill: "a pause",
  temptation: "a strong pull",
  "uncontrolled force": "forces outside your control",
  upheaval: "a shake-up",
  "radical change": "deep change",
  "decisive break": "a clean break",
  blockage: "something blocked",
  consequence: "cause and effect",
  "the halt": "a halt",
  shadow: "what sits in shadow",
  "pure yang": "full, active energy",
  "pure yin": "open, receptive energy",
  "initial chaos": "early confusion",
  "frozen potential": "potential on hold",
  "minor excess": "a little too much",
  excess: "too much",
  "subordinate relationship": "a supporting role",
  "addressing corruption": "mending what went wrong",
  "the beam bends": "something under strain",
  "the friction that shapes": "friction that shapes you",
  "the need to learn": "a need to learn",
  "what one takes in": "what you take in",
  "hiding one's light": "keeping your light low for now",
  "the unconscious deep": "what lies below awareness",
  "the self": "yourself",
  "reactive force": "pushing back",
};

/** Picture-words (mostly from the rune poems): shown as the image, not as a theme. */
const IMAGES = new Set([
  "aurochs", "cattle", "elk", "yew", "birch", "horse", "ice", "hail", "thorn", "torch",
  "sun", "day", "year", "giant", "ing", "tyr", "the god", "iron", "ocean", "water",
  "fire", "earth", "heaven", "mountain", "thunder", "wind", "the lake", "mouth",
  "the lot-cup", "the ride", "the warding", "the world-tree axis", "the guiding star",
  "the sacred vessel", "storm", "the traveler",
]);

const IMAGE_TEXT: Record<string, string> = {
  aurochs: "the aurochs, a wild ox",
  thorn: "a thorn",
  "the god": "a god",
  "the ride": "a ride",
  torch: "a torch",
  year: "the turning year",
  yew: "the yew tree",
  birch: "the birch tree",
  "the lot-cup": "the lot-cup, used for casting lots",
  elk: "the elk",
  sun: "the sun",
  tyr: "Tyr",
  ing: "Ing",
  horse: "a horse",
  day: "daybreak",
  giant: "a giant",
};

/** Generic Minor Arcana tags that say nothing about a specific card. */
const SUIT_FILLER = new Set(["intellect", "emotion", "material", "action", "will"]);

function soften(q: string): string {
  const key = q.trim().toLowerCase();
  return SOFTEN[key] ?? key.replace(/-/g, " ");
}

function themesOf(entry: QualiaEntry, max = 3): { themes: string[]; image?: string } {
  const raw = entry.qualities.map(q => q.trim());
  const image = raw.find(q => IMAGES.has(q.toLowerCase()));
  let words = raw.filter(q => !IMAGES.has(q.toLowerCase()));
  if (entry.system === "tarot-minor" && words.length > 2) {
    words = words.filter(q => !SUIT_FILLER.has(q.toLowerCase()));
  }
  const themes = (words.length ? words : raw).slice(0, max).map(soften);
  return { themes, image: image && words.length ? image : undefined };
}

/** Hand-written lines for hard cards. Never name harm; meet it with care. */
const CAREFUL: Record<string, string> = {
  "ta-maj-XIII":
    "a chapter closing so something new has room. This card is about change and release, not about harm.",
  "ta-maj-XVI":
    "something built on a shaky base may be shifting. It can feel unsettling, and it often clears the way to see more truly.",
  "ta-maj-XV":
    "something that holds on tight: a habit, a pull, a pattern. Seeing it clearly is the first loosening.",
  "ta-swords-10":
    "a hard stretch reaching its end. The heaviest part may already be behind you, and rest is allowed.",
  "ta-swords-9":
    "worry that feels bigger in the dark. It asks you to name the fear gently, to yourself or to someone you trust.",
  "ta-swords-3":
    "a hurt that is real. It asks for honesty about the feeling, and time for it to mend.",
  "ru-hagalaz":
    "disruption you didn't choose, like hail on a field. Hail melts, and what it tests can come back stronger.",
  "ru-thurisaz":
    "a thorn, something that pushes back. Ask whether it is guarding you or keeping you stuck.",
  "ru-nauthiz":
    "a need pressing on you. Friction like this often shows what really matters.",
  "ru-isa":
    "a stillness, like ice. Not everything has to move today; some things are waiting for the thaw.",
  "ic-hex-12":
    "a pause where things don't flow. It's a time to stay steady and not force the way.",
  "ic-hex-23":
    "something old falling away. Let it fall, and tend the ground underneath.",
  "ic-hex-29":
    "deep water, and the same difficulty coming round again. Move with care and stay true to yourself, the way water keeps flowing.",
  "ic-hex-36":
    "a hard stretch where it's wise to keep your light low for now. It's still there, and it still counts.",
  "ic-hex-39":
    "an obstacle in the path. It may ask you to pause, look again, and find help rather than push through alone.",
  "ic-hex-47":
    "tiredness and feeling hemmed in. Be gentle with yourself; your words may matter less right now than staying true.",
};

const LEAD: Record<string, string> = {
  Focus: "At the heart of your question",
  Past: "Behind you",
  Present: "Right now",
  Future: "Leaning forward",
  Challenge: "Crossing you",
  Foundation: "Underneath it all",
  "Recent past": "Just behind you",
  Crown: "In what you're reaching for",
  "Near future": "Coming closer",
  Approach: "In how you're meeting it",
  Environment: "Around you",
  "Hopes & fears": "In your hopes and fears",
  Outcome: "Where things lean now",
  "The rune": "For your question",
  "What was": "In what was",
  "What is": "In what is",
  "What leans forward": "In what leans forward",
  Hexagram: "Where you stand now",
  "Primary hexagram": "Where you stand now",
  "Relating hexagram": "Where it's leaning",
};

const AXIS_LEAN: Record<Axis, [string, string]> = {
  active: ["taking action", "patience"],
  rising: ["growth", "letting things settle"],
  steady: ["steadiness", "change"],
  warm: ["warmth", "a little cool distance"],
  outward: ["reaching out", "turning inward"],
  binding: ["holding things together", "loosening your grip"],
  gentle: ["gentleness", "being firm"],
  light: ["clarity", "what isn't clear yet"],
};

const AXIS_ASK: Record<Axis, [string, string]> = {
  active: ["what is one small step you could take", "what might be gained by waiting a little"],
  rising: ["what is starting to grow", "what is ready to settle or rest"],
  steady: ["what is worth keeping steady", "what is already changing"],
  warm: ["where is the warmth", "where would a little distance help"],
  outward: ["who could you reach out to", "what do you already know, deep down"],
  binding: ["what are you holding onto, and does it still help you", "what could you loosen or let go of"],
  gentle: ["where could you be gentler with yourself", "where do you need to be firm"],
  light: ["what has become clearer", "what isn't clear yet, and can it stay unclear a while"],
};

type Lean = { axis: Axis; sign: 0 | 1; weight: number };

function leansOf(cards: DrawnCard[]): Lean[] {
  const sum: Partial<Record<Axis, number>> = {};
  for (const c of cards) {
    const w = c.reversed ? 0.5 : 1;
    for (const [axis, v] of Object.entries(c.entry.polarities) as [Axis, number][]) {
      sum[axis] = (sum[axis] ?? 0) + v * w;
    }
  }
  const n = Math.max(1, cards.length);
  return (Object.entries(sum) as [Axis, number][])
    .map(([axis, v]) => ({ axis, sign: (v >= 0 ? 0 : 1) as 0 | 1, weight: Math.abs(v) / n }))
    .filter(l => l.weight >= 0.15)
    .sort((a, b) => b.weight - a.weight || a.axis.localeCompare(b.axis));
}

const leanPhrase = (l: Lean) => AXIS_LEAN[l.axis][l.sign];

/** Small deterministic hash so wording varies by card, never by chance. */
function pick<T>(id: string, options: T[]): T {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return options[h % options.length]!;
}

/** Last guard on generated text: no fate or forecast language. */
function guard(text: string): string {
  return text
    .replace(/\bdestiny\b/gi, "life path")
    .replace(/\bfate\b/gi, "what is given")
    .replace(/\s+—\s+/g, ", ");
}

function meaningFor(
  result: CastResult,
  fam: Family,
  card: DrawnCard,
  index: number,
  position: string | undefined,
): string {
  const e = card.entry;
  const unit = UNIT[fam][0];
  const lead =
    fam === "orisha" && typeof result.cowrieUp === "number"
      ? `With ${numWord(result.cowrieUp)} mouth${result.cowrieUp === 1 ? "" : "s"} open, the shells point here`
      : (position && LEAD[position]) || (result.drawn.length > 1 ? `In place ${index + 1}` : "In this draw");

  let first: string;
  if (CAREFUL[e.id]) {
    first = `${lead}: ${CAREFUL[e.id]}`;
  } else if (fam === "orisha") {
    first = `${lead}: ${lowerFirst(e.observed.replace(/\.$/, ""))}.`;
  } else {
    const { themes } = themesOf(e);
    const verb = pick(e.id, ["speaks of", "points to", "brings up"]);
    first = `${lead}, this ${unit} ${verb} ${listJoin(themes)}.`;
  }

  let second = "";
  if (fam === "tarot" && card.reversed) {
    second = "Reversed, it turns inward: this may be slower, held back, or something to tend inside you first.";
  } else if (fam === "iching" && position === "Relating hexagram") {
    second = "It's where things lean as the changing lines turn, not a set result.";
  } else if (fam === "iching" && (result.changingLines?.length ?? 0) > 0 && index === 0) {
    const ch = result.changingLines!;
    second = `${ch.length === 1 ? "Line" : "Lines"} ${listJoin(ch.map(String))} ${ch.length === 1 ? "is" : "are"} moving, so this picture isn't fixed.`;
  } else if (fam === "rune" && !CAREFUL[e.id]) {
    const { image } = themesOf(e);
    if (image) second = `In the old rune poems, its picture is ${IMAGE_TEXT[image.toLowerCase()] ?? image}.`;
  } else if (fam === "orisha") {
    second = "Take it as a quality to reflect on, not a verdict.";
  }
  if (!second && !CAREFUL[e.id]) {
    const top = leansOf([card])[0];
    if (top) second = `It leans toward ${leanPhrase(top)}.`;
  }
  return guard(second ? `${first} ${second}` : first);
}

function shortQuestion(q: string): string {
  const t = q.trim().replace(/\s+/g, " ");
  return t.length > 70 ? `${t.slice(0, 67).trimEnd()}…` : t;
}

export function whatItMeans(result: CastResult): WhatItMeans {
  const fam = familyOf(result.system);
  const cards = cardsOf(result);
  const positions = result.positions ?? [];
  const [unitOne, unitMany] = UNIT[fam];

  const perDraw: DrawMeaning[] = cards.map((card, i) => {
    const position = positions[i];
    return {
      ...(position ? { position } : {}),
      name: card.entry.name,
      meaning: meaningFor(result, fam, card, i, position),
    };
  });

  const leans = leansOf(cards);
  let together: string;
  if (cards.length === 0) {
    together = "Nothing was drawn this time.";
  } else if (fam === "iching" && result.relating && cards.length >= 2) {
    const from = themesOf(cards[0]!.entry, 1).themes[0];
    const to = themesOf(cards[1]!.entry, 1).themes[0];
    together = `The reading moves from ${from} toward ${to}.`;
  } else {
    const leanText = leans.length
      ? listJoin(leans.slice(0, 2).map(leanPhrase))
      : "balance, with no single pull";
    together =
      cards.length === 1
        ? `Taken whole, this ${unitOne} leans toward ${leanText}.`
        : `Together, the ${numWord(cards.length)} ${unitMany} lean toward ${leanText}.`;

    if (cards.length > 1) {
      const counts = new Map<string, number>();
      for (const c of cards) {
        for (const t of new Set(themesOf(c.entry, 6).themes)) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      const shared = [...counts.entries()]
        .filter(([, n]) => n > 1)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      if (shared) together += ` ${cap(shared[0])} shows up in more than one.`;
    }
    const reversed = cards.filter(c => c.reversed).length;
    if (fam === "tarot" && cards.length > 1 && reversed * 2 >= cards.length) {
      together += " Many came reversed, so much of this may be working quietly, inside you.";
    }
  }
  together = guard(together);

  const top = leans[0];
  const ask = top ? AXIS_ASK[top.axis][top.sign] : "what part of this feels most true for you";
  const q = result.question?.trim();
  const sq = q ? shortQuestion(q) : "";
  const reflect = q
    ? `You asked, "${sq}"${/[?.!…]$/.test(sq) ? "" : "."} Holding that, ${ask}?`
    : `Thinking of what brought you here, ${ask}?`;

  return { perDraw, together, reflect };
}
