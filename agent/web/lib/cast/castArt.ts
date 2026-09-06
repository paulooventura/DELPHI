/**
 * Public art slots for Cast faces. Missing files fall back to illustrated SVG.
 * Paths match agent/web/lib/lore/ASSET-MANIFEST.md.
 */

const TAROT_MAJOR_FILES: Record<string, string> = {
  "ta-maj-0": "00-the-fool",
  "ta-maj-I": "01-the-magician",
  "ta-maj-II": "02-the-high-priestess",
  "ta-maj-III": "03-the-empress",
  "ta-maj-IV": "04-the-emperor",
  "ta-maj-V": "05-the-hierophant",
  "ta-maj-VI": "06-the-lovers",
  "ta-maj-VII": "07-the-chariot",
  "ta-maj-VIII": "08-strength",
  "ta-maj-IX": "09-the-hermit",
  "ta-maj-X": "10-wheel-of-fortune",
  "ta-maj-XI": "11-justice",
  "ta-maj-XII": "12-the-hanged-man",
  "ta-maj-XIII": "13-death",
  "ta-maj-XIV": "14-temperance",
  "ta-maj-XV": "15-the-devil",
  "ta-maj-XVI": "16-the-tower",
  "ta-maj-XVII": "17-the-star",
  "ta-maj-XVIII": "18-the-moon",
  "ta-maj-XIX": "19-the-sun",
  "ta-maj-XX": "20-judgement",
  "ta-maj-XXI": "21-the-world",
};

const ORISHA_FILES: Record<string, string> = {
  "or-eshu": "eshu",
  "or-ogun": "ogun",
  "or-yemoja": "yemoja",
  "or-oshun": "oshun",
  "or-shango": "shango",
  "or-oya": "oya",
  "or-obatala": "obatala",
  "or-orunmila": "orunmila",
};

const RUNE_FILES: Record<string, string> = {
  "ru-fehu": "fehu",
  "ru-uruz": "uruz",
  "ru-thurisaz": "thurisaz",
  "ru-ansuz": "ansuz",
  "ru-raidho": "raidho",
  "ru-kenaz": "kenaz",
  "ru-gebo": "gebo",
  "ru-wunjo": "wunjo",
  "ru-hagalaz": "hagalaz",
  "ru-nauthiz": "nauthiz",
  "ru-isa": "isa",
  "ru-jera": "jera",
  "ru-eihwaz": "eihwaz",
  "ru-perthro": "perthro",
  "ru-algiz": "algiz",
  "ru-sowilo": "sowilo",
  "ru-tiwaz": "tiwaz",
  "ru-berkano": "berkano",
  "ru-ehwaz": "ehwaz",
  "ru-mannaz": "mannaz",
  "ru-laguz": "laguz",
  "ru-ingwaz": "ingwaz",
  "ru-dagaz": "dagaz",
  "ru-othala": "othala",
};

export function castArtSrcs(system: string, id: string): string[] {
  const list: string[] = [];
  if (system === "tarot-minor") {
    const m = /^ta-(wands|cups|swords|pentacles)-(.+)$/.exec(id);
    if (m) {
      list.push(`/cast/tarot/${m[1]}/${m[2]}.png`);
      list.push(`/cast/tarot/${m[1]}/suit.png`);
    }
    return list;
  }
  const primary = castArtSrc(system, id);
  return primary ? [primary] : [];
}

export function castArtSrc(system: string, id: string): string | null {
  if (system === "tarot-major") {
    const file = TAROT_MAJOR_FILES[id];
    return file ? `/cast/tarot/major/${file}.png` : null;
  }
  if (system === "tarot-minor") {
    const m = /^ta-(wands|cups|swords|pentacles)-(.+)$/.exec(id);
    if (!m) return null;
    return `/cast/tarot/${m[1]}/${m[2]}.png`;
  }
  if (system === "rune-cast") {
    const file = RUNE_FILES[id];
    return file ? `/cast/runes/${file}.png` : null;
  }
  if (system === "orisha-cast") {
    const file = ORISHA_FILES[id];
    return file ? `/cast/orisha/${file}.png` : null;
  }
  if (system === "iching-hexagram") {
    const m = /^ix-(\d+)$/.exec(id);
    if (!m) return null;
    return `/cast/iching/${m[1].padStart(2, "0")}.png`;
  }
  return null;
}

export function coinArtSrc(yang: boolean): string {
  return yang ? "/cast/iching/coin-yang.png" : "/cast/iching/coin-yin.png";
}

export function cowrieArtSrc(open: boolean): string {
  return open ? "/cast/orisha/cowrie-open.png" : "/cast/orisha/cowrie-closed.png";
}
