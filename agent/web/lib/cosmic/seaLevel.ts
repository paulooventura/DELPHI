/**
 * Global mean sea level over the last 140,000 years, relative to today (metres), for the Earth
 * view's Ice ages slider (Paulo, Nov 10: "how glaciers form and melt over time").
 *
 * An approximate curve: the last deglaciation after Lambeck et al. 2014 (PNAS 111), older
 * swings after the Spratt & Lisiecki 2016 sea-level stack (Climate of the Past 12). Points are
 * rounded and linear between them; local sea level differed (land rose and sank under the ice),
 * so the map shows the global picture, not any one coast.
 */

/** [thousands of years ago, metres relative to today], oldest last. */
export const SEA_LEVEL_CURVE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [6.7, -4],
  [8, -15],
  [10, -42],
  [11.5, -58],
  [12.8, -62],
  [14.3, -78],
  [14.7, -98],
  [16.5, -115],
  [19, -128],
  [21, -130],
  [26, -125],
  [29, -110],
  [35, -85],
  [45, -75],
  [55, -80],
  [65, -90],
  [75, -60],
  [82, -25],
  [95, -50],
  [105, -20],
  [115, -55],
  [123, 6],
  [128, 3],
  [132, -40],
  [136, -100],
  [140, -120],
];

/** Sea level (m, relative to today) at `ka` thousand years ago. */
export function seaLevelAt(ka: number): number {
  const c = SEA_LEVEL_CURVE;
  if (!(ka > 0)) return 0;
  if (ka >= c[c.length - 1]![0]) return c[c.length - 1]![1];
  for (let i = 1; i < c.length; i++) {
    const [k1, m1] = c[i]!;
    if (ka <= k1) {
      const [k0, m0] = c[i - 1]!;
      return m0 + ((m1 - m0) * (ka - k0)) / (k1 - k0);
    }
  }
  return 0;
}

/** "21,000 years ago · sea 130 m lower · Last Glacial Maximum: ..." */
export function iceAgeLabel(ka: number): string {
  const k = Math.round(ka * 10) / 10;
  if (k <= 0) return "Today's sea level";
  const m = Math.round(seaLevelAt(k));
  const sea = m === 0 ? "sea level as today" : m < 0 ? `sea ${-m} m lower` : `sea ${m} m higher`;
  const years = `${Math.round(k * 1000).toLocaleString("en-US")} years ago`;
  const note =
    k >= 18 && k <= 24
      ? "Last Glacial Maximum: Beringia, Doggerland and Sundaland are dry land"
      : k >= 14 && k < 15
        ? "the great melt: seas rise fast"
        : k >= 118 && k <= 128
          ? "the warm Eemian: seas higher than today"
          : k >= 8 && k < 10
            ? "Doggerland drowning under the North Sea"
            : "";
  return `${years} · ${sea}${note ? ` · ${note}` : ""}`;
}

type Expr = unknown[];

/**
 * A MapLibre color-relief ramp for sea level `m`: land a lower sea uncovered is drawn as sand,
 * land a higher sea drowned is drawn as water; everything else stays clear.
 */
export function seaLevelRamp(m: number): Expr {
  const clear = "rgba(0,0,0,0)";
  const shelf = "rgba(214,186,120,0.82)";
  const flood = "rgba(46,120,200,0.78)";
  if (Math.abs(m) < 0.5) return ["interpolate", ["linear"], ["elevation"], -12000, clear, 9000, clear];
  if (m < 0)
    return ["interpolate", ["linear"], ["elevation"], -12000, clear, m - 0.5, clear, m, shelf, -0.5, shelf, 0, clear, 9000, clear];
  return ["interpolate", ["linear"], ["elevation"], -12000, clear, -0.01, clear, 0, flood, m, flood, m + 0.5, clear, 9000, clear];
}
