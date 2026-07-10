/**
 * Constellation stick figures — RA (hours) / Dec (degrees) at J2000.
 * Warm gold palette for inviting night-sky wayfinding.
 */

export type ConstellationFigure = {
  id: string;
  name: string;
  /** Pairs of [raH, decDeg] endpoints. */
  lines: Array<[[number, number], [number, number]]>;
  label: { ra: number; dec: number };
  color: string;
  glow: string;
};

export const CONSTELLATION_FIGURES: ConstellationFigure[] = [
  {
    id: "orion",
    name: "Orion",
    lines: [
      [[5.92, 7.41], [5.68, -1.94]],   // Betelgeuse — Bellatrix
      [[5.68, -1.94], [5.53, -0.30]],  // Bellatrix — Alnitak area
      [[5.53, -0.30], [5.60, -1.20]],  // Belt
      [[5.60, -1.20], [5.68, -2.40]],  // Alnilam — Mintaka
      [[5.53, -0.30], [5.24, -8.20]],  // Belt — Rigel
      [[5.92, 7.41], [5.24, -8.20]],   // Betelgeuse — Rigel (body)
    ],
    label: { ra: 5.55, dec: 0.5 },
    color: "rgba(201, 162, 39, 0.55)",
    glow: "rgba(251, 191, 36, 0.25)",
  },
  {
    id: "ursa-major",
    name: "Ursa Major",
    lines: [
      [[11.06, 61.75], [11.03, 56.38]], // Dubhe — Merak
      [[11.03, 56.38], [12.26, 57.03]], // Merak — Phecda
      [[12.26, 57.03], [12.90, 55.96]], // Phecda — Megrez
      [[12.90, 55.96], [13.40, 54.92]], // Megrez — Alioth
      [[13.40, 54.92], [13.79, 49.31]], // Alioth — Mizar
      [[13.79, 49.31], [13.92, 47.78]], // Mizar — Alkaid
      [[11.06, 61.75], [12.26, 57.03]], // Dubhe — Phecda (bowl)
      [[12.90, 55.96], [11.03, 56.38]], // Megrez — Merak
    ],
    label: { ra: 12.5, dec: 55 },
    color: "rgba(147, 197, 253, 0.5)",
    glow: "rgba(96, 165, 250, 0.2)",
  },
  {
    id: "cassiopeia",
    name: "Cassiopeia",
    lines: [
      [[0.67, 56.54], [0.15, 59.15]],
      [[0.15, 59.15], [0.95, 60.72]],
      [[0.95, 60.72], [1.43, 60.24]],
      [[1.43, 60.24], [1.91, 63.67]],
    ],
    label: { ra: 0.95, dec: 61 },
    color: "rgba(216, 180, 254, 0.52)",
    glow: "rgba(167, 139, 250, 0.22)",
  },
  {
    id: "scorpius",
    name: "Scorpius",
    lines: [
      [[16.49, -26.43], [16.84, -34.29]], // Antares — Shaula
      [[16.49, -26.43], [17.20, -37.10]],
      [[16.84, -34.29], [17.20, -37.10]],
      [[16.49, -26.43], [16.01, -22.62]],
      [[16.01, -22.62], [15.74, -29.30]],
    ],
    label: { ra: 16.5, dec: -30 },
    color: "rgba(248, 113, 113, 0.48)",
    glow: "rgba(239, 68, 68, 0.18)",
  },
  {
    id: "leo",
    name: "Leo",
    lines: [
      [[10.14, 11.97], [10.33, 19.84]],  // Regulus — Algieba
      [[10.33, 19.84], [11.24, 14.85]],
      [[11.24, 14.85], [11.82, 14.27]],
      [[10.14, 11.97], [9.88, 23.77]],   // Regulus — Denebola tail
    ],
    label: { ra: 10.5, dec: 16 },
    color: "rgba(251, 191, 36, 0.48)",
    glow: "rgba(245, 158, 11, 0.2)",
  },
  {
    id: "cygnus",
    name: "Cygnus",
    lines: [
      [[20.69, 45.28], [20.37, 40.26]],  // Deneb — Sadr
      [[20.37, 40.26], [19.75, 27.96]],  // Sadr — Albireo
      [[20.37, 40.26], [20.93, 33.97]],  // Sadr — wing
      [[20.37, 40.26], [19.51, 40.26]],  // Sadr — wing
    ],
    label: { ra: 20.4, dec: 40 },
    color: "rgba(186, 230, 253, 0.5)",
    glow: "rgba(125, 211, 252, 0.22)",
  },
  {
    id: "taurus",
    name: "Taurus",
    lines: [
      [[4.60, 16.51], [3.79, 24.11]],   // Aldebaran — Elnath
      [[4.60, 16.51], [5.44, 28.61]],
      [[3.79, 24.11], [5.44, 28.61]],
    ],
    label: { ra: 4.5, dec: 20 },
    color: "rgba(253, 186, 116, 0.5)",
    glow: "rgba(251, 146, 60, 0.2)",
  },
  {
    id: "crux",
    name: "Crux",
    lines: [
      [[12.44, -63.10], [12.80, -59.69]],
      [[12.52, -57.11], [12.80, -59.69]],
      [[12.44, -63.10], [12.52, -57.11]],
    ],
    label: { ra: 12.6, dec: -60 },
    color: "rgba(201, 162, 39, 0.55)",
    glow: "rgba(251, 191, 36, 0.22)",
  },
];
