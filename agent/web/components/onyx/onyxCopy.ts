import { lunarPhaseFromFraction } from "../../lib/cosmicAssets";

/** Synodic month ≈ 29.53059 d — days from current phase fraction to next full (0.5). */
export function daysToFullMoon(phaseFraction: number): number {
  const f = ((phaseFraction % 1) + 1) % 1;
  const toFull = f <= 0.5 ? 0.5 - f : 1.5 - f;
  return Math.max(0, Math.round(toFull * 29.53059));
}

export function phaseVerb(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("waxing")) return "waxing";
  if (n.includes("waning")) return "waning";
  if (n.includes("full")) return "full";
  if (n.includes("new")) return "new";
  if (n.includes("first")) return "at first quarter";
  if (n.includes("last") || n.includes("third")) return "at last quarter";
  return name.toLowerCase();
}

export function streetMoonLine(phaseFraction: number): { verb: string; detail: string; phaseName: string } {
  const phase = lunarPhaseFromFraction(phaseFraction);
  const verb = phaseVerb(phase.name);
  const days = daysToFullMoon(phaseFraction);
  let detail: string;
  if (phase.id === "full") detail = "tonight it is full.";
  else if (phase.id === "new") detail = "the sky is dark of moon.";
  else if (days === 0) detail = "hours from full.";
  else if (days === 1) detail = "one day from full.";
  else detail = `${days} days from full.`;
  return { verb, detail, phaseName: phase.name };
}

export function cardinalFromHeading(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
}

export function claimMarkClass(claim: string): string {
  if (claim === "measurement") return "onyx-mk-measure";
  if (claim === "interpretation") return "onyx-mk-interp";
  return "onyx-mk-conv";
}
