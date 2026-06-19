export type SkyProjector = {
  toXY: (az: number, alt: number) => [number, number];
  inView: (x: number, y: number, w: number, h: number, pad?: number) => boolean;
};

export function createSkyProjector(
  width: number,
  height: number,
  headingDeg: number,
  pitchDeg: number,
  fovAzDeg = 85,
  fovAltHalfDeg = 42,
): SkyProjector {
  const halfAz = fovAzDeg / 2;

  function toXY(az: number, alt: number): [number, number] {
    const dAz = ((az - headingDeg + 540) % 360) - 180;
    const dAlt = alt - pitchDeg;
    const x = (dAz / fovAzDeg + 0.5) * width;
    const y = height / 2 - (dAlt / fovAltHalfDeg) * (height / 2);
    return [x, y];
  }

  function inView(x: number, y: number, w: number, h: number, pad = 12): boolean {
    return x >= -pad && x <= w + pad && y >= -pad && y <= h + pad;
  }

  return { toXY, inView };
}

/** Sample horizon circle (alt = 0). */
export function sampleHorizon(headingDeg: number, pitchDeg: number, step = 8): Array<{ az: number; alt: number }> {
  const pts: Array<{ az: number; alt: number }> = [];
  for (let az = 0; az < 360; az += step) {
    pts.push({ az, alt: 0 });
  }
  return pts;
}
