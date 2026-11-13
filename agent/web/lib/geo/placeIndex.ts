/**
 * Offline place search over the bundled GeoNames list (public/geo/places.json, built by scripts/gen-places.py).
 * Pure functions so they can be tested; nothing here touches the network. GeoNames is CC BY 4.0 (credited).
 */

export type PlaceData = {
  v: number;
  src: string;
  admin: string[];
  country: string[];
  /** [name, ascii name or "", admin index, country index, lat, lon, population], largest first. */
  rows: Array<[string, string, number, number, number, number, number]>;
};

export type PlaceMatch = { i: number; name: string; admin1?: string; country?: string; lat: number; lon: number; label: string };

/** Lowercase, accents and punctuation removed: "São Paulo" → "sao paulo". */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function match(d: PlaceData, i: number): PlaceMatch {
  const r = d.rows[i]!;
  const admin1 = d.admin[r[2]] || undefined;
  const country = d.country[r[3]] || undefined;
  const parts = [r[0]];
  if (admin1 && fold(admin1) !== fold(r[0])) parts.push(admin1);
  if (country) parts.push(country);
  return { i, name: r[0], admin1, country, lat: r[4], lon: r[5], label: parts.join(", ") };
}

/** Folded names, built once per list. */
const folded = new WeakMap<PlaceData, { name: string[]; admin: string[]; country: string[] }>();
function foldedOf(d: PlaceData) {
  let f = folded.get(d);
  if (!f) {
    f = {
      name: d.rows.map(r => fold(r[1] || r[0])),
      admin: d.admin.map(fold),
      country: d.country.map(fold),
    };
    folded.set(d, f);
  }
  return f;
}

/**
 * "nashville", "nash", "paris, texas", "sao paulo brazil": the first part matches the start of the place name, any
 * further words narrow by region or country. Exact names first, then the most populous.
 */
export function searchPlaceIndex(d: PlaceData, query: string, count = 6): PlaceMatch[] {
  const parts = query.split(",").map(fold).filter(Boolean);
  if (!parts.length || parts[0]!.length < 2) return [];
  const f = foldedOf(d);
  let head = parts[0]!;
  let rest = parts.slice(1);
  const exact: number[] = [];
  const prefix: number[] = [];
  const scan = () => {
    for (let i = 0; i < d.rows.length && exact.length < count; i++) {
      const n = f.name[i]!;
      if (!n.startsWith(head)) continue;
      const r = d.rows[i]!;
      if (rest.length && !rest.every(w => f.admin[r[2]]!.startsWith(w) || f.country[r[3]]!.startsWith(w) || f.admin[r[2]]!.includes(` ${w}`) || f.country[r[3]]!.includes(` ${w}`))) continue;
      if (n === head) exact.push(i);
      else if (prefix.length < count) prefix.push(i);
    }
  };
  scan();
  // "sao paulo brazil" with no comma: try the last word as the country or region.
  if (!exact.length && !prefix.length && parts.length === 1 && head.includes(" ")) {
    const words = head.split(" ");
    rest = [words.pop()!];
    head = words.join(" ");
    scan();
  }
  return [...exact, ...prefix].slice(0, count).map(i => match(d, i));
}

/** The nearest listed place to a point (for naming where the person is). */
export function nearestPlace(d: PlaceData, lat: number, lon: number): PlaceMatch | null {
  let best = -1;
  let bestD = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i < d.rows.length; i++) {
    const r = d.rows[i]!;
    let dl = Math.abs(r[5] - lon);
    if (dl > 180) dl = 360 - dl;
    const dd = (r[4] - lat) ** 2 + (dl * k) ** 2;
    if (dd < bestD) {
      bestD = dd;
      best = i;
    }
  }
  return best >= 0 ? match(d, best) : null;
}
