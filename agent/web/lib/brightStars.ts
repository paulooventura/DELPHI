/**
 * Navigational bright stars (approx. mag ≤ 2.5 + constellation anchors).
 * J2000 RA hours / Dec degrees — for the live skymap field, not distance-ranked.
 */

export type BrightStar = {
  id: string;
  name: string;
  ra: number;
  dec: number;
  mag: number;
};

/** Curated Yale/BSC-style bright field — enough to seat the stick figures. */
export const BRIGHT_STARS: BrightStar[] = [
  // Magnitude leaders
  { id: "sirius", name: "Sirius", ra: 6.752, dec: -16.716, mag: -1.46 },
  { id: "canopus", name: "Canopus", ra: 6.399, dec: -52.696, mag: -0.74 },
  { id: "rigil-kent", name: "Rigil Kentaurus", ra: 14.660, dec: -60.834, mag: -0.01 },
  { id: "arcturus", name: "Arcturus", ra: 14.261, dec: 19.182, mag: -0.05 },
  { id: "vega", name: "Vega", ra: 18.615, dec: 38.783, mag: 0.03 },
  { id: "capella", name: "Capella", ra: 5.278, dec: 45.998, mag: 0.08 },
  { id: "rigel", name: "Rigel", ra: 5.242, dec: -8.201, mag: 0.13 },
  { id: "procyon", name: "Procyon", ra: 7.655, dec: 5.225, mag: 0.34 },
  { id: "betelgeuse", name: "Betelgeuse", ra: 5.919, dec: 7.407, mag: 0.45 },
  { id: "achernar", name: "Achernar", ra: 1.629, dec: -57.237, mag: 0.46 },
  { id: "hadar", name: "Hadar", ra: 14.063, dec: -60.373, mag: 0.61 },
  { id: "altair", name: "Altair", ra: 19.846, dec: 8.868, mag: 0.76 },
  { id: "acrux", name: "Acrux", ra: 12.443, dec: -63.099, mag: 0.77 },
  { id: "aldebaran", name: "Aldebaran", ra: 4.598, dec: 16.509, mag: 0.85 },
  { id: "spica", name: "Spica", ra: 13.420, dec: -11.161, mag: 0.97 },
  { id: "antares", name: "Antares", ra: 16.490, dec: -26.432, mag: 1.06 },
  { id: "pollux", name: "Pollux", ra: 7.755, dec: 28.026, mag: 1.14 },
  { id: "fomalhaut", name: "Fomalhaut", ra: 22.960, dec: -29.622, mag: 1.16 },
  { id: "deneb", name: "Deneb", ra: 20.690, dec: 45.280, mag: 1.25 },
  { id: "mimosa", name: "Mimosa", ra: 12.795, dec: -59.689, mag: 1.25 },
  { id: "regulus", name: "Regulus", ra: 10.139, dec: 11.967, mag: 1.35 },
  { id: "adhara", name: "Adhara", ra: 6.977, dec: -28.972, mag: 1.50 },
  { id: "castor", name: "Castor", ra: 7.576, dec: 31.888, mag: 1.58 },
  { id: "gacrux", name: "Gacrux", ra: 12.519, dec: -57.113, mag: 1.59 },
  { id: "shaula", name: "Shaula", ra: 17.560, dec: -37.104, mag: 1.62 },
  { id: "bellatrix", name: "Bellatrix", ra: 5.418, dec: 6.350, mag: 1.64 },
  { id: "elnath", name: "Elnath", ra: 5.438, dec: 28.608, mag: 1.65 },
  { id: "miaplacidus", name: "Miaplacidus", ra: 9.220, dec: -69.717, mag: 1.67 },
  { id: "alnilam", name: "Alnilam", ra: 5.603, dec: -1.202, mag: 1.69 },
  { id: "alnitak", name: "Alnitak", ra: 5.679, dec: -1.943, mag: 1.74 },
  { id: "alioth", name: "Alioth", ra: 12.900, dec: 55.960, mag: 1.76 },
  { id: "mirfak", name: "Mirfak", ra: 3.405, dec: 49.861, mag: 1.79 },
  { id: "dubhe", name: "Dubhe", ra: 11.062, dec: 61.751, mag: 1.81 },
  { id: "weasel", name: "Wezen", ra: 7.140, dec: -26.393, mag: 1.83 },
  { id: "alkaid", name: "Alkaid", ra: 13.792, dec: 49.313, mag: 1.85 },
  { id: "polaris", name: "Polaris", ra: 2.530, dec: 89.264, mag: 1.97 },
  { id: "mirzam", name: "Mirzam", ra: 6.378, dec: -17.956, mag: 1.98 },
  { id: "alphard", name: "Alphard", ra: 9.459, dec: -8.659, mag: 1.99 },
  { id: "mintaka", name: "Mintaka", ra: 5.533, dec: -0.299, mag: 2.21 },
  { id: "hamal", name: "Hamal", ra: 2.119, dec: 23.463, mag: 2.01 },
  { id: "diphda", name: "Diphda", ra: 0.726, dec: -17.987, mag: 2.04 },
  { id: "mizar", name: "Mizar", ra: 13.399, dec: 54.925, mag: 2.23 },
  { id: "merak", name: "Merak", ra: 11.031, dec: 56.382, mag: 2.37 },
  { id: "phecda", name: "Phecda", ra: 11.897, dec: 53.695, mag: 2.41 },
  { id: "megrez", name: "Megrez", ra: 12.257, dec: 57.033, mag: 3.32 },
  // Cassiopeia
  { id: "schedar", name: "Schedar", ra: 0.675, dec: 56.537, mag: 2.24 },
  { id: "caph", name: "Caph", ra: 0.153, dec: 59.150, mag: 2.28 },
  { id: "gamma-cas", name: "γ Cas", ra: 0.945, dec: 60.717, mag: 2.39 },
  { id: "rukbah", name: "Ruchbah", ra: 1.430, dec: 60.235, mag: 2.68 },
  { id: "segin", name: "Segin", ra: 1.906, dec: 63.670, mag: 3.35 },
  // Summer triangle / Cygnus wing
  { id: "sadr", name: "Sadr", ra: 20.371, dec: 40.257, mag: 2.23 },
  { id: "gienah-cyg", name: "Gienah", ra: 20.770, dec: 33.970, mag: 2.48 },
  { id: "delta-cyg", name: "δ Cyg", ra: 19.749, dec: 45.131, mag: 2.87 },
  // Leo
  { id: "algieba", name: "Algieba", ra: 10.333, dec: 19.842, mag: 2.01 },
  { id: "denebola", name: "Denebola", ra: 11.818, dec: 14.572, mag: 2.14 },
  { id: "zosma", name: "Zosma", ra: 11.235, dec: 20.524, mag: 2.56 },
  // Taurus / Pleiades region
  { id: "alkiyone", name: "Alcyone", ra: 3.791, dec: 24.105, mag: 2.85 },
  // Southern Cross remaining
  { id: "delta-cru", name: "δ Cru", ra: 12.252, dec: -58.749, mag: 2.79 },
  // Andromeda / Great Square
  { id: "alpheratz", name: "Alpheratz", ra: 0.139, dec: 29.091, mag: 2.07 },
  { id: "mirach", name: "Mirach", ra: 1.162, dec: 35.621, mag: 2.07 },
  { id: "almaak", name: "Almach", ra: 2.064, dec: 42.330, mag: 2.17 },
  { id: "markab", name: "Markab", ra: 23.079, dec: 15.205, mag: 2.49 },
  { id: "scheat", name: "Scheat", ra: 23.063, dec: 28.083, mag: 2.44 },
  // Scorpius / Sagittarius
  { id: "sargas", name: "Sargas", ra: 17.622, dec: -42.998, mag: 1.86 },
  { id: "kaus-australis", name: "Kaus Australis", ra: 18.403, dec: -34.384, mag: 1.79 },
  { id: "nunki", name: "Nunki", ra: 18.921, dec: -26.297, mag: 2.05 },
];
