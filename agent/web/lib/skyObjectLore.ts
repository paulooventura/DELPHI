/**
 * Lore bites for live skymap selection — qualities from the mainframe where we
 * have them; honest classical / catalog framing elsewhere. Never invents
 * tradition labels as if they were ephemeris.
 */

import { julianDay } from "./cosmic/math";
import { byId } from "./lore/qualia";
import { computePhases } from "./phase/engine";

export type SkyLoreBite = {
  /** Short evocative reading for the panel. */
  blurb: string;
  /** Mainframe quality words (when available). */
  qualities: string[];
  /** Provenance tip shown quietly. */
  source?: string;
};

const PLANET_PD: Record<string, string> = {
  sun: "pd-sun",
  moon: "pd-moon",
  mercury: "pd-mercury",
  venus: "pd-venus",
  mars: "pd-mars",
  jupiter: "pd-jupiter",
  saturn: "pd-saturn",
};

/** Body-as-sky character (not weekday slogans). Classical convention, named as such. */
const PLANET_SKY: Record<string, string> = {
  sun: "The sky's fixed fire — measure of day, season, and the self's light. In classical reading: vital, radiant, central.",
  mercury:
    "Never far from the Sun — the quick messenger of the old sky. Mind, exchange, the connective spark between things.",
  venus:
    "The bright evening or morning star — harmony and appetite in the classical register. Beauty that pulls without force.",
  mars: "The red wanderer — force, urgency, and the cut of initiative. Heat that does not wait to be invited.",
  jupiter:
    "The great benefic of the classical sky — expansion, grace, the wide weather. Generous when the chorus agrees.",
  saturn:
    "The slow boundary — structure, limit, and what endures. Sober light at the edge of the visible planets.",
  uranus:
    "The ice giant beyond the classical seven — discovered late, linked in modern reading with rupture, invention, and the sudden tilt.",
  neptune:
    "A blue world of deep orbit — modern sky-lore ties it to dream, dissolve, and the far mist beyond sharp edges.",
  pluto:
    "A small distant body with a long memory in modern myth — underworld, transformation, what is buried and returns.",
};

const MP_IDS = [
  "mp-new",
  "mp-wax-cres",
  "mp-first-q",
  "mp-wax-gib",
  "mp-full",
  "mp-wan-gib",
  "mp-last-q",
  "mp-wan-cres",
] as const;

/** Same presentation bands as the lunar World Cycle plugin. */
const MP_THRESHOLDS: [number, (typeof MP_IDS)[number]][] = [
  [0.0625, "mp-new"],
  [0.1875, "mp-wax-cres"],
  [0.3125, "mp-first-q"],
  [0.4375, "mp-wax-gib"],
  [0.5625, "mp-full"],
  [0.6875, "mp-wan-gib"],
  [0.8125, "mp-last-q"],
  [1.0, "mp-wan-cres"],
];

const DEEP_SKY: Record<string, string> = {
  m31: "Andromeda — the nearest large spiral, a whole island of stars already falling toward us on a cosmic clock. Named for the chained princess of Greek sky-story.",
  m42: "The Orion Nebula — a stellar nursery in the hunter's sword. New stars still condensing from the gas; one of the sky's clearest workshops.",
  m45: "The Pleiades — the Seven Sisters of many traditions; a young open cluster wrapped in faint reflection dust.",
  m7: "Ptolemy's Cluster — a bright knot in Scorpius, catalogued in antiquity. A summer jewel of the southern Milky Way for northern eyes.",
  m44: "Praesepe, the Beehive — an open cluster in Cancer. The manger of classical lore; a soft swarm to the unaided eye.",
  m13: "The Great Globular in Hercules — a sphere of hundreds of thousands of ancient stars, one of the northern sky's densest gatherings.",
  m51: "The Whirlpool — two galaxies locked in a long embrace. A portrait of tides between islands of light.",
  m81: "Bode's Galaxy — a grand spiral in Ursa Major, companion to the ragged M82. Steady structure at the edge of naked-eye reach.",
  m57: "The Ring Nebula in Lyra — a dying star's shed shell, seen face-on as a smoke ring. Remnant light of what was once a sun-like furnace.",
  m8: "The Lagoon Nebula — a bright star-forming bay in Sagittarius, toward the heart of the Milky Way.",
};

const KIND_FALLBACK: Record<string, string> = {
  asteroid:
    "A small solar-system wanderer — rock and metal on an elliptical path. Not a planet in the classical seven, but a real body with a measured orbit.",
  comet:
    "Ice and dust on a long ellipse — when near the Sun it grows a coma and sometimes a tail of light. Ancient omen of the unusual; modern science of volatiles.",
  aircraft:
    "Human craft in the near sky — measured altitude, speed, and route. Not lore of the spheres, but the living layer between you and the stars.",
  satellite:
    "An artificial moon — orbital mechanics and radio silence or chatter. A twentieth-century addition to the night's moving lights.",
  "satellite-cluster":
    "A patch of low-Earth objects — trains and swarms that share a sky cell. Human infrastructure written on the sphere.",
  deepsky:
    "A deep-sky object — light that left its source long before this evening. Catalogued structure beyond the solar system.",
};

function moonPhaseId(fraction: number): (typeof MP_IDS)[number] {
  const f = ((fraction % 1) + 1) % 1;
  for (const [t, id] of MP_THRESHOLDS) {
    if (f < t) return id;
  }
  return "mp-wan-cres";
}

function fromQualia(id: string, blurbOverride?: string): SkyLoreBite | null {
  const q = byId(id);
  if (!q) return null;
  return {
    blurb: blurbOverride ?? q.observed,
    qualities: q.qualities.slice(0, 5),
    source: q.source,
  };
}

/**
 * Resolve a lore bite for a tapped sky object.
 * `date` improves moon-phase accuracy; planets use classical planetary qualities.
 */
export function loreForSkyObject(opts: {
  id: string;
  kind: string;
  name: string;
  date?: Date;
}): SkyLoreBite | null {
  const { id, kind, name, date = new Date() } = opts;

  if (id === "moon" || name.toLowerCase() === "moon") {
    const jd = julianDay(date);
    const reading = computePhases(jd, { only: ["lunar-synodic"] }).byId["lunar-synodic"];
    const fraction = reading?.phase ?? 0;
    const mp = fromQualia(moonPhaseId(fraction));
    const classical = fromQualia("pd-moon");
    const qualities = [
      ...new Set([...(mp?.qualities ?? []), ...(classical?.qualities ?? [])]),
    ].slice(0, 6);
    return {
      blurb: mp
        ? `${mp.blurb} Classically: feeling, tide, and reflection.`
        : PLANET_SKY.moon ?? "The wandering light of night — tide and reflection.",
      qualities,
      source: mp?.source ?? classical?.source,
    };
  }

  const pd = PLANET_PD[id];
  if (pd) {
    const bite = fromQualia(pd, PLANET_SKY[id]);
    if (bite) return bite;
  }
  if (PLANET_SKY[id]) {
    return { blurb: PLANET_SKY[id], qualities: [], source: "Modern / classical sky reading" };
  }

  if (kind === "deepsky" || DEEP_SKY[id]) {
    const blurb = DEEP_SKY[id];
    if (blurb) {
      return {
        blurb,
        qualities: ["distant", "structured", "ancient"],
        source: "Deep-sky catalog · cultural name",
      };
    }
  }

  const fallback = KIND_FALLBACK[kind];
  if (fallback) {
    return {
      blurb: fallback,
      qualities: [],
      source: "Observational framing",
    };
  }

  return null;
}
