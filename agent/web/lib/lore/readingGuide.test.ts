import { describe, expect, it } from "vitest";
import {
  castIChingCoins,
  castOrishaDiloggun,
  castOrishaNames,
  castRuneSpread,
  castTarotSpread,
  CAST_FRAMING,
  RUNE_SPREADS,
  TAROT_SPREADS,
  type CastResult,
} from "./cast";
import { byId, castPool, tarotDeck, type QualiaEntry } from "./qualia";
import { howToRead, whatItMeans } from "./readingGuide";

const BANNED =
  /\bdeath\b|\bdoom|will happen|\byou will\b|\bdestiny\b|\bfate\b|\bpredict|\bbeta\b|\bdanger\b|\bcurse|\bdisaster|\bdie\b|\bdying\b/i;

const entry = (id: string): QualiaEntry => {
  const e = byId(id);
  if (!e) throw new Error(`missing ${id}`);
  return e;
};

function tarot(ids: string[], reversed: boolean[], spreadId: "one" | "three" | "celtic", question?: string): CastResult {
  const spread = TAROT_SPREADS.find(s => s.id === spreadId)!;
  const drawn = ids.map(entry);
  return {
    system: "tarot",
    framing: { ...CAST_FRAMING.tarot!, frame: spread.frame },
    drawn,
    cards: drawn.map((e, i) => ({ entry: e, reversed: reversed[i] ?? false })),
    positions: spread.positions,
    spreadId,
    spreadLabel: spread.label,
    question,
  };
}

function rune(ids: string[], spreadId: "one" | "norns", question?: string): CastResult {
  const spread = RUNE_SPREADS.find(s => s.id === spreadId)!;
  const drawn = ids.map(entry);
  return {
    system: "rune-cast",
    framing: { ...CAST_FRAMING["rune-cast"]!, frame: spread.frame },
    drawn,
    cards: drawn.map(e => ({ entry: e })),
    positions: spread.positions,
    spreadId,
    spreadLabel: spread.label,
    question,
  };
}

function iching(primary: string, relating: string | undefined, changing: number[], lines: number[]): CastResult {
  const drawn = relating ? [entry(primary), entry(relating)] : [entry(primary)];
  return {
    system: "iching-hexagram",
    framing: CAST_FRAMING["iching-hexagram"]!,
    drawn,
    cards: drawn.map(e => ({ entry: e })),
    positions: relating ? ["Primary hexagram", "Relating hexagram"] : ["Hexagram"],
    ichingLines: lines,
    changingLines: changing,
    relating: relating ? entry(relating) : undefined,
    spreadId: "coins",
  };
}

const allText = (r: CastResult) => {
  const m = whatItMeans(r);
  const h = howToRead(r);
  return [h.title, ...h.steps, ...m.perDraw.map(d => d.meaning), m.together, m.reflect].join(" ");
};

describe("howToRead — follows the engine's real mechanics", () => {
  it("tarot one / three / celtic give 2-4 steps and mention reversal only as cast", () => {
    for (const spread of TAROT_SPREADS) {
      const r = castTarotSpread(spread.id);
      const h = howToRead(r);
      expect(h.steps.length).toBeGreaterThanOrEqual(2);
      expect(h.steps.length).toBeLessThanOrEqual(4);
      const rev = r.cards!.filter(c => c.reversed).length;
      const text = h.steps.join(" ");
      if (rev === 0) expect(text).toMatch(/upright/i);
      else expect(text).toMatch(/reversed/i);
    }
    expect(howToRead(tarot(["ta-maj-XIII", "ta-cups-ace", "ta-maj-XVI"], [false, true, false], "three")).title)
      .toMatch(/three cards/i);
  });

  it("I Ching explains changing lines and the relating hexagram only when present", () => {
    const moving = howToRead(iching("ic-hex-01", "ic-hex-12", [2, 5], [7, 9, 8, 7, 6, 7]));
    expect(moving.steps.join(" ")).toMatch(/Lines 2 and 5 are changing/);
    expect(moving.steps.join(" ")).toMatch(/second hexagram/i);
    const still = howToRead(iching("ic-hex-01", undefined, [], [7, 7, 7, 7, 7, 7]));
    expect(still.steps.join(" ")).toMatch(/No lines are changing/);
    expect(still.steps.join(" ")).not.toMatch(/second hexagram/i);
  });

  it("runes say there are no reversed staves (the engine has none)", () => {
    for (const s of RUNE_SPREADS) {
      const text = howToRead(castRuneSpread(s.id, "What should I tend?")).steps.join(" ");
      expect(text).toMatch(/no reversed/i);
    }
  });

  it("cowries count mouths up and stay honest about the 8-Orisha homage", () => {
    const r = castOrishaDiloggun();
    const text = howToRead(r).steps.join(" ");
    expect(text).toMatch(/Sixteen shells/);
    expect(text).toMatch(/eight principal Orisha/);
    expect(text).toMatch(/babalawo/);
    expect(howToRead(castOrishaNames()).steps.join(" ")).toMatch(/not a cowrie cast/i);
  });
});

describe("whatItMeans — reflection, not prediction", () => {
  it("three-card tarot: one entry per position, reversed turns inward", () => {
    const r = tarot(["ta-cups-ace", "ta-maj-XVI", "ta-swords-10"], [false, true, false], "three", "Should I change jobs?");
    const m = whatItMeans(r);
    expect(m.perDraw.map(d => d.position)).toEqual(["Past", "Present", "Future"]);
    expect(m.perDraw.map(d => d.name)).toEqual(["Ace of Cups", "The Tower", "Ten of Swords"]);
    expect(m.perDraw[1]!.meaning).toMatch(/Reversed, it turns inward/);
    expect(m.perDraw[0]!.meaning).not.toMatch(/Reversed/);
    expect(m.together).toMatch(/^Together, the three cards lean toward/);
    expect(m.reflect).toMatch(/^You asked, "Should I change jobs\?" Holding that,/);
  });

  it("is deterministic: same draw, same words", () => {
    const r = tarot(["ta-maj-XIII", "ta-cups-ace", "ta-maj-XVI"], [true, false, false], "three", "x");
    expect(whatItMeans(r)).toEqual(whatItMeans(r));
  });

  it("I Ching with changing lines names them and reads the move", () => {
    const m = whatItMeans(iching("ic-hex-01", "ic-hex-12", [2, 5], [7, 9, 8, 7, 6, 7]));
    expect(m.perDraw).toHaveLength(2);
    expect(m.perDraw[0]!.meaning).toMatch(/Lines 2 and 5 are moving/);
    expect(m.perDraw[1]!.meaning).toMatch(/not a set result/);
    expect(m.together).toMatch(/^The reading moves from .+ toward .+\.$/);
  });

  it("one rune with a question quotes it; empty question falls back gently", () => {
    const withQ = whatItMeans(rune(["ru-fehu"], "one", "What should I tend?"));
    expect(withQ.perDraw[0]!.position).toBe("The rune");
    expect(withQ.perDraw[0]!.meaning).toMatch(/^For your question, this rune/);
    expect(withQ.perDraw[0]!.meaning).toMatch(/In the old rune poems, its picture is cattle\./);
    expect(withQ.reflect).toMatch(/"What should I tend\?"/);
    const noQ = whatItMeans(rune(["ru-fehu"], "one"));
    expect(noQ.reflect).toMatch(/^Thinking of what brought you here,/);
    const blank = whatItMeans({ ...rune(["ru-fehu"], "one"), question: "   " });
    expect(blank.reflect).toMatch(/^Thinking of what brought you here,/);
  });

  it("Norns and Celtic Cross scale to 3 and 10 draws", () => {
    const n = whatItMeans(castRuneSpread("norns"));
    expect(n.perDraw).toHaveLength(3);
    const c = whatItMeans(castTarotSpread("celtic"));
    expect(c.perDraw).toHaveLength(10);
    expect(c.perDraw[9]!.meaning).toMatch(/^Where things lean now/);
    expect(c.together).toMatch(/ten cards/);
  });

  it("Orisha cowries speak from the open mouths", () => {
    const r = castOrishaDiloggun();
    const m = whatItMeans(r);
    expect(m.perDraw[0]!.meaning).toMatch(/mouths? open, the shells point here/);
    expect(m.perDraw[0]!.meaning).toMatch(/not a verdict/);
  });

  it("hard cards stay careful", () => {
    for (const id of ["ta-maj-XIII", "ta-maj-XVI", "ta-swords-10", "ta-maj-XV"]) {
      for (const rev of [false, true]) {
        const text = allText(tarot([id], [rev], "one"));
        expect(text, id).not.toMatch(BANNED);
      }
    }
    expect(whatItMeans(tarot(["ta-maj-XIII"], [false], "one")).perDraw[0]!.meaning).toMatch(/not about harm/);
    for (const id of ["ru-hagalaz", "ru-thurisaz", "ru-isa", "ru-nauthiz"]) {
      expect(allText(rune([id], "one", "Is this over?")), id).not.toMatch(BANNED);
    }
    for (const id of ["ic-hex-12", "ic-hex-23", "ic-hex-29", "ic-hex-36", "ic-hex-39", "ic-hex-47"]) {
      expect(allText(iching(id, undefined, [], [8, 8, 8, 8, 8, 8])), id).not.toMatch(BANNED);
    }
  });

  it("no entry in any deck produces fate or forecast wording", () => {
    for (const e of tarotDeck()) {
      for (const rev of [false, true]) {
        expect(allText(tarot([e.id], [rev], "one")), e.id).not.toMatch(BANNED);
      }
    }
    for (const e of castPool("rune-cast")) expect(allText(rune([e.id], "one")), e.id).not.toMatch(BANNED);
    for (const e of castPool("iching-hexagram")) {
      expect(allText(iching(e.id, undefined, [], [7, 7, 7, 7, 7, 7])), e.id).not.toMatch(BANNED);
    }
    for (let i = 0; i < 30; i++) expect(allText(castOrishaDiloggun())).not.toMatch(BANNED);
    for (const e of castPool("orisha-cast")) {
      const r: CastResult = { ...castOrishaNames(), drawn: [e], cards: [{ entry: e }] };
      expect(allText(r), e.id).not.toMatch(BANNED);
    }
  });

  it("empty draw is handled", () => {
    const r: CastResult = { system: "tarot", framing: CAST_FRAMING.tarot!, drawn: [] };
    const m = whatItMeans(r);
    expect(m.perDraw).toEqual([]);
    expect(m.together).toMatch(/Nothing was drawn/);
  });
});
