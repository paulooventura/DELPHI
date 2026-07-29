/**
 * Embraced casts — LOCAL ONLY.
 * Persisted when the user chooses the green gem. Never fed into composeMoment /
 * Layer 0 (computed-only). Folded into the labeled `with-drawn` layer via
 * composeLayers when the user chooses that reading. Home also shows a "Held" strip.
 */

export type EmbracedCast = {
  id: string;
  at: string;
  system: string;
  label: string;
  /** Card / rune / odu names drawn. */
  names: string[];
  /** Qualia entry ids. */
  entryIds: string[];
  /** Union of quality words — for moment lean. */
  qualities: string[];
  spreadLabel?: string;
};

const KEY = "delphi-cast-embraced-v1";
const MAX = 8;

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadEmbraced(): EmbracedCast[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EmbracedCast[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(e => e?.id && e?.system && Array.isArray(e.names));
  } catch {
    return [];
  }
}

export function saveEmbraced(list: EmbracedCast[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* quota */
  }
}

export function clearEmbraced(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

/** Newest first. */
export function embraceCast(entry: Omit<EmbracedCast, "id" | "at">): EmbracedCast[] {
  const next: EmbracedCast = {
    ...entry,
    id: uid(),
    at: new Date().toISOString(),
  };
  const list = [next, ...loadEmbraced().filter(e => e.id !== next.id)].slice(0, MAX);
  saveEmbraced(list);
  return list;
}

export function rejectLatestEmbraced(): EmbracedCast[] {
  const list = loadEmbraced().slice(1);
  saveEmbraced(list);
  return list;
}

/** Tradition scaffolding — never leans the street phrase. */
const LEAN_STOP = new Set([
  "odu",
  "cowrie",
  "tarot",
  "rune",
  "hexagram",
  "trigram",
  "orisha",
  "card",
  "major",
  "minor",
  "arcana",
  "cast",
  "diloggun",
  "reflection",
]);

function leanable(q: string): boolean {
  const w = q.trim().toLowerCase();
  if (!w || w.length < 3) return false;
  if (LEAN_STOP.has(w)) return false;
  return true;
}

/**
 * Qualities from recent embraced casts (newest first, up to 3).
 * Union — so several held draws can retune the moment together.
 */
export function latestCastLean(list?: EmbracedCast[]): string[] {
  const items = (list ?? loadEmbraced()).slice(0, 3);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    for (const q of item.qualities) {
      const w = q.trim().toLowerCase();
      if (!leanable(w) || seen.has(w)) continue;
      seen.add(w);
      out.push(w);
      if (out.length >= 8) return out;
    }
  }
  return out;
}

/** Stable cache fingerprint for phrase keys — all held draws that lean. */
export function castLeanKey(list?: EmbracedCast[]): string {
  const items = (list ?? loadEmbraced()).slice(0, 3);
  if (items.length === 0) return "none";
  return items
    .map(t => t.entryIds.join("+") || t.names.join("+"))
    .join("|")
    .slice(0, 96);
}
