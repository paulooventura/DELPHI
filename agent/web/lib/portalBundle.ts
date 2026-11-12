/**
 * The portal pages' share of the app (bundled by scripts/build-sat-worker.mjs to public/pm-portal.js):
 * the time sound (portalClock) and the Pythia's answer for the Adyton's tripod. Reads birth and kept casts
 * from this device's storage only; nothing is sent.
 */
import "./portalClock";
import { askOracle, poleName, type OracleAnswer } from "./lore/oracle";
import { loadBirth } from "./lore/birthStore";
import { loadEmbraced } from "./lore/castStore";
import { composePerson } from "./lore/resolvePerson";
import { resolveMoment } from "./lore/resolveMoment";
import { byId, type QualiaEntry } from "./lore/qualia";
import { jdFromDate } from "./phase/timeResolution";
import { HOME_LAT, HOME_LON } from "./observerHome";

export type PortalOracleAnswer = OracleAnswer & {
  hasBirth: boolean;
  castCount: number;
  axisWords: string;
  trapWords: string;
  askedAt: string;
};

function ask(question: string): PortalOracleAnswer {
  const now = Date.now();
  const birth = loadBirth();
  let person: QualiaEntry[] = [];
  try {
    if (birth) person = composePerson(birth).entries;
  } catch {
    person = [];
  }
  const kept = loadEmbraced();
  const casts = kept.map(c => ({
    at: c.at,
    names: c.names,
    entries: c.entryIds.map(id => byId(id)).filter((e): e is QualiaEntry => Boolean(e)),
  }));
  const lat = birth?.lat ?? HOME_LAT;
  const lon = birth?.lon ?? HOME_LON;
  const moment = resolveMoment(jdFromDate(new Date(now)), lat, lon).entries.filter(e => e.honesty === "render");
  const a = askOracle({ person, casts, moment, question, atMs: now });
  return {
    ...a,
    hasBirth: person.length > 0,
    castCount: casts.filter(c => c.entries.length).length,
    axisWords: poleName(a.axis, a.pole),
    trapWords: poleName(a.trap, a.trapPole),
    askedAt: new Date(now).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
  };
}

declare global {
  interface Window {
    pmOracle?: { ask: (question: string) => PortalOracleAnswer };
  }
}

if (typeof window !== "undefined") window.pmOracle = { ask };
