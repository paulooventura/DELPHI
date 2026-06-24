/**
 * Topocentric alt/az via astronomy-engine (cosinekitty/astronomy).
 * Sub-arcminute accuracy for Moon, Sun, and planets at a GPS fix.
 */
import {
  Body,
  Equator,
  Horizon,
  MakeTime,
  Observer,
  type FlexibleDateTime,
} from "astronomy-engine";

export type HorizonCoords = { alt: number; az: number };

export type EquatorialHorizon = HorizonCoords & {
  raHours: number;
  decDeg: number;
};

function makeObserver(latDeg: number, lonDeg: number, altM = 0): Observer {
  return new Observer(latDeg, lonDeg, Math.max(0, altM));
}

function makeTime(date: Date): FlexibleDateTime {
  return MakeTime(date);
}

/** RA (hours) + Dec (degrees) → altitude/azimuth at observer. */
export function raDecToAltAz(
  date: Date,
  latDeg: number,
  lonDeg: number,
  raHours: number,
  decDeg: number,
  altM = 0,
): HorizonCoords {
  const time = makeTime(date);
  const observer = makeObserver(latDeg, lonDeg, altM);
  const hor = Horizon(time, observer, raHours, decDeg, "normal");
  return { alt: hor.altitude, az: hor.azimuth };
}

/** Solar-system body → equatorial + horizon at observer. */
export function bodyEquatorHorizon(
  body: Body,
  date: Date,
  latDeg: number,
  lonDeg: number,
  altM = 0,
): EquatorialHorizon {
  const time = makeTime(date);
  const observer = makeObserver(latDeg, lonDeg, altM);
  const eq = Equator(body, time, observer, true, true);
  const hor = Horizon(time, observer, eq.ra, eq.dec, "normal");
  return {
    raHours: eq.ra,
    decDeg: eq.dec,
    alt: hor.altitude,
    az: hor.azimuth,
  };
}

export const SKY_BODIES: Array<{
  id: "sun" | "moon" | "venus" | "mars" | "jupiter" | "saturn";
  body: Body;
  name: string;
  magnitude: number;
  color: string;
}> = [
  { id: "sun", body: Body.Sun, name: "Sun", magnitude: -26.7, color: "#fff8e8" },
  { id: "moon", body: Body.Moon, name: "Moon", magnitude: -12.6, color: "#e8eef8" },
  { id: "venus", body: Body.Venus, name: "Venus", magnitude: -4.2, color: "#e8d5a0" },
  { id: "mars", body: Body.Mars, name: "Mars", magnitude: 0.5, color: "#e07050" },
  { id: "jupiter", body: Body.Jupiter, name: "Jupiter", magnitude: -2.0, color: "#d4c4a8" },
  { id: "saturn", body: Body.Saturn, name: "Saturn", magnitude: 0.8, color: "#c9b896" },
];
