/**
 * Ambient magnetic-field helpers — turn raw µT into a useful local reading.
 * Earth surface field is typically ~25–65 µT; phones read vector magnitude.
 */

export type EmfBand = "quiet" | "earth" | "elevated" | "strong" | "hot";

export type EmfInterpretation = {
  ut: number;
  band: EmfBand;
  label: string;
  /** 0–100 gauge fill */
  pct: number;
  color: string;
  /** Rough expected Earth field at latitude (µT), when known */
  expectedUt: number | null;
  /** Percent difference vs expected Earth field */
  anomalyPct: number | null;
  /** One spoken/UI tip the user can act on */
  guidance: string;
};

/** Coarse geomagnetic intensity vs latitude (equator quieter, poles stronger). */
export function expectedEarthFieldUt(latDeg: number | null | undefined): number {
  if (latDeg == null || !Number.isFinite(latDeg)) return 45;
  const lat = Math.min(90, Math.abs(latDeg));
  return 32 + (lat / 90) * 28;
}

export function interpretEmf(
  ut: number,
  latDeg?: number | null,
): EmfInterpretation {
  const expected = expectedEarthFieldUt(latDeg);
  const anomalyPct = ((ut - expected) / expected) * 100;

  let band: EmfBand;
  let label: string;
  let pct: number;
  let color: string;
  let guidance: string;

  if (ut < 20) {
    band = "quiet";
    label = "Quiet field";
    pct = (ut / 20) * 28;
    color = "#60a5fa";
    guidance = "Unusually soft — shield nearby, or sensors still warming up.";
  } else if (ut < 55) {
    band = "earth";
    label = "Earth-normal";
    pct = 28 + ((ut - 20) / 35) * 42;
    color = "#34d399";
    guidance = "Healthy ambient field — good for compass lock and sky heading.";
  } else if (ut < 80) {
    band = "elevated";
    label = "Elevated";
    pct = 70 + ((ut - 55) / 25) * 15;
    color = "#fbbf24";
    guidance = "Step away from speakers, chargers, or steel — then re-check.";
  } else if (ut < 120) {
    band = "strong";
    label = "Strong local field";
    pct = 85 + ((ut - 80) / 40) * 10;
    color = "#f87171";
    guidance = "Metal or magnets are dominating the mic — move a few feet clear.";
  } else {
    band = "hot";
    label = "Magnet spike";
    pct = Math.min(100, 95 + (ut - 120) / 20);
    color = "#ef4444";
    guidance = "Very hot reading — pocket magnets or cases can ruin heading.";
  }

  return {
    ut,
    band,
    label,
    pct: Math.max(0, Math.min(100, pct)),
    color,
    expectedUt: expected,
    anomalyPct: Number.isFinite(anomalyPct) ? anomalyPct : null,
    guidance,
  };
}

export function emfHubColor(ut: number | null | undefined): string {
  if (ut == null || !Number.isFinite(ut)) return "#94a3b8";
  return interpretEmf(ut).color;
}
