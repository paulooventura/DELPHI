/**
 * Embraced casts — LOCAL ONLY.
 * Persisted when the user chooses the green gem. Never fed into composeMoment
 * (home chord stays computed-only). Distill may lean on qualities; home shows
 * a labeled "Held" strip.
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

/** Qualities from the most recent embrace (for distill lean). */
export function latestCastLean(list?: EmbracedCast[]): string[] {
  const items = list ?? loadEmbraced();
  const top = items[0];
  if (!top) return [];
  return [...new Set(top.qualities.map(q => q.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
}

/** Stable cache fingerprint for phrase keys. */
export function castLeanKey(list?: EmbracedCast[]): string {
  const items = list ?? loadEmbraced();
  const top = items[0];
  if (!top) return "none";
  return `${top.entryIds.join("+") || top.names.join("+")}`.slice(0, 64);
}
