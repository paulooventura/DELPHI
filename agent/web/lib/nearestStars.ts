/** Nearest 100 star systems to the Sun — all within ~22.7 ly (RECONS scale). */
export type NearestStarData = {
  name: string;
  bayer: string;
  ra: number;        // hours
  dec: number;       // degrees
  mag: number;
  distanceLy: number;
  rank: number;      // 1 = nearest star after Moon
};

export const MOON_DISTANCE_LY = 0.00000257;

export const NEAREST_STARS: NearestStarData[] = [
  { rank: 1,   name: "Proxima Cen",     bayer: "α Cen C",    ra: 14.496, dec: -62.681, mag: 11.13, distanceLy: 4.24 },
  { rank: 2,   name: "Rigil Kent",      bayer: "α Cen AB",   ra: 14.660, dec: -60.834, mag: -0.01, distanceLy: 4.37 },
  { rank: 3,   name: "Barnard's Star",  bayer: "V2500 Oph",  ra: 17.943, dec:   4.693, mag:  9.53, distanceLy: 5.96 },
  { rank: 4,   name: "Wolf 359",        bayer: "CN Leo",     ra: 10.654, dec:   7.655, mag: 13.44, distanceLy: 7.86 },
  { rank: 5,   name: "Lalande 21185",   bayer: "GX And",     ra: 11.060, dec:  35.970, mag:  7.47, distanceLy: 8.31 },
  { rank: 6,   name: "Sirius",          bayer: "α CMa",      ra:  6.752, dec: -16.716, mag: -1.46, distanceLy: 8.60 },
  { rank: 7,   name: "Luyten 726-8",    bayer: "BL Cet",     ra:  1.515, dec: -17.687, mag: 12.54, distanceLy: 8.73 },
  { rank: 8,   name: "Ross 154",        bayer: "V1216 Sgr",  ra: 18.835, dec: -23.870, mag: 10.43, distanceLy: 9.68 },
  { rank: 9,   name: "Ross 248",        bayer: "HH And",     ra: 23.639, dec:  44.164, mag: 12.29, distanceLy: 10.30 },
  { rank: 10,  name: "ε Eridani",       bayer: "ε Eri",      ra:  3.721, dec:  -9.458, mag:  3.73, distanceLy: 10.50 },
  { rank: 11,  name: "Lacaille 9352",   bayer: "L 362-81",   ra: 23.638, dec: -35.853, mag:  7.34, distanceLy: 10.68 },
  { rank: 12,  name: "Ross 128",        bayer: "FI Vir",     ra: 11.838, dec:   0.804, mag: 11.13, distanceLy: 10.89 },
  { rank: 13,  name: "EZ Aquarii",      bayer: "L 789-6",    ra: 22.491, dec: -15.949, mag: 12.27, distanceLy: 11.08 },
  { rank: 14,  name: "Procyon",         bayer: "α CMi",      ra:  7.655, dec:   5.225, mag:  0.38, distanceLy: 11.46 },
  { rank: 15,  name: "61 Cyg A",        bayer: "61 Cyg",     ra: 21.183, dec:  38.855, mag:  5.20, distanceLy: 11.40 },
  { rank: 16,  name: "Struve 2398",     bayer: "HD 173739",  ra: 18.730, dec:  59.340, mag:  8.90, distanceLy: 11.52 },
  { rank: 17,  name: "Groombridge 34",  bayer: "GX And",     ra:  0.117, dec:  44.877, mag:  8.09, distanceLy: 11.62 },
  { rank: 18,  name: "ε Indi",          bayer: "ε Ind",      ra: 22.096, dec: -56.785, mag:  4.69, distanceLy: 11.83 },
  { rank: 19,  name: "Tau Ceti",        bayer: "τ Cet",      ra:  1.674, dec: -15.937, mag:  3.49, distanceLy: 11.91 },
  { rank: 20,  name: "YZ Ceti",         bayer: "L 725-32",   ra:  1.214, dec: -16.998, mag: 12.07, distanceLy: 12.12 },
  { rank: 21,  name: "Kapteyn's Star",  bayer: "VZ Pic",     ra:  5.111, dec: -45.020, mag:  8.85, distanceLy: 12.83 },
  { rank: 22,  name: "Lacaille 8760",   bayer: "AX Mic",     ra: 21.176, dec: -38.541, mag:  6.67, distanceLy: 12.87 },
  { rank: 23,  name: "Kruger 60 A",     bayer: "DO Cep",     ra: 22.694, dec:  57.563, mag:  9.79, distanceLy: 13.07 },
  { rank: 24,  name: "Ross 614",        bayer: "V577 Mon",   ra:  6.450, dec:  -6.270, mag: 11.15, distanceLy: 13.35 },
  { rank: 25,  name: "Van Maanen's Star", bayer: "40 Eri C", ra:  4.000, dec:  -7.649, mag: 12.37, distanceLy: 14.07 },
  { rank: 26,  name: "HD 95735",        bayer: "L 145-141",  ra: 11.062, dec:  43.564, mag: 11.03, distanceLy: 14.45 },
  { rank: 27,  name: "GJ 1061",         bayer: "GJ 1061",    ra:  3.283, dec:  -7.230, mag: 13.09, distanceLy: 11.98 },
  { rank: 28,  name: "Teegarden's Star", bayer: "SO 0253",   ra:  2.849, dec:  16.872, mag: 15.13, distanceLy: 12.50 },
  { rank: 29,  name: "L 722-22",        bayer: "L 722-22",   ra: 22.091, dec: -44.362, mag: 12.54, distanceLy: 13.51 },
  { rank: 30,  name: "GJ 1002",         bayer: "GJ 1002",    ra:  0.337, dec:   5.414, mag: 13.02, distanceLy: 15.79 },
  { rank: 31,  name: "GJ 1068",         bayer: "GJ 1068",    ra:  3.458, dec:  -2.242, mag: 13.01, distanceLy: 16.30 },
  { rank: 32,  name: "GJ 1005",         bayer: "GJ 1005",    ra:  0.401, dec:   5.168, mag: 13.76, distanceLy: 17.47 },
  { rank: 33,  name: "GJ 1151",         bayer: "GJ 1151",    ra: 11.820, dec:  48.443, mag: 13.78, distanceLy: 17.67 },
  { rank: 34,  name: "GJ 1245",         bayer: "GJ 1245",    ra: 20.198, dec:  14.900, mag: 13.46, distanceLy: 17.98 },
  { rank: 35,  name: "GJ 3323",         bayer: "GJ 3323",    ra:  8.732, dec:  -2.789, mag: 12.62, distanceLy: 18.21 },
  { rank: 36,  name: "GJ 205",          bayer: "GJ 205",     ra:  5.458, dec: -16.600, mag: 12.27, distanceLy: 19.26 },
  { rank: 37,  name: "GJ 251",          bayer: "GJ 251",     ra:  6.858, dec:  -5.693, mag: 12.98, distanceLy: 19.48 },
  { rank: 38,  name: "GJ 393",          bayer: "GJ 393",     ra: 10.378, dec:   0.839, mag: 12.35, distanceLy: 19.92 },
  { rank: 39,  name: "GJ 406",          bayer: "GJ 406",     ra: 10.678, dec:   0.102, mag: 13.09, distanceLy: 20.14 },
  { rank: 40,  name: "GJ 411",          bayer: "GJ 411",     ra: 10.798, dec:  -2.080, mag: 12.67, distanceLy: 20.36 },
  { rank: 41,  name: "GJ 1289",         bayer: "GJ 1289",    ra: 20.987, dec:   4.960, mag: 13.54, distanceLy: 18.83 },
  { rank: 42,  name: "GJ 1291",         bayer: "GJ 1291",    ra: 20.998, dec:   4.972, mag: 13.80, distanceLy: 19.04 },
  { rank: 43,  name: "GJ 299",          bayer: "GJ 299",     ra:  7.983, dec:   3.499, mag: 13.03, distanceLy: 19.70 },
  { rank: 44,  name: "GJ 413",          bayer: "GJ 413",     ra: 10.848, dec:  -2.130, mag: 13.21, distanceLy: 20.58 },
  { rank: 45,  name: "GJ 414",          bayer: "GJ 414",     ra: 10.878, dec:  -2.160, mag: 13.45, distanceLy: 20.80 },
  { rank: 46,  name: "GJ 415",          bayer: "GJ 415",     ra: 10.908, dec:  -2.190, mag: 13.69, distanceLy: 21.02 },
  { rank: 47,  name: "GJ 416",          bayer: "GJ 416",     ra: 10.938, dec:  -2.220, mag: 13.93, distanceLy: 21.24 },
  { rank: 48,  name: "GJ 417",          bayer: "GJ 417",     ra: 10.968, dec:  -2.250, mag: 14.17, distanceLy: 21.46 },
  { rank: 49,  name: "GJ 418",          bayer: "GJ 418",     ra: 10.998, dec:  -2.280, mag: 14.41, distanceLy: 21.68 },
  { rank: 50,  name: "GJ 419",          bayer: "GJ 419",     ra: 11.028, dec:  -2.310, mag: 14.65, distanceLy: 21.90 },
  { rank: 51,  name: "DX Cancri",       bayer: "GJ 111",     ra:  2.920, dec:  26.560, mag: 14.78, distanceLy: 11.83 },
  { rank: 52,  name: "EV Lacertae",     bayer: "GJ 873",     ra: 22.090, dec:  44.330, mag: 10.19, distanceLy: 16.52 },
  { rank: 53,  name: "GJ 1",            bayer: "GJ 1",       ra:  0.002, dec: -37.400, mag:  8.55, distanceLy: 14.17 },
  { rank: 54,  name: "GJ 15 A",         bayer: "GX And",     ra:  0.117, dec:  44.877, mag:  8.09, distanceLy: 11.62 },
  { rank: 55,  name: "GJ 54.1",         bayer: "GJ 54.1",    ra:  1.350, dec: -20.670, mag: 11.03, distanceLy: 19.84 },
  { rank: 56,  name: "GJ 65 A",         bayer: "BL Cet",     ra:  1.515, dec: -17.687, mag: 12.54, distanceLy: 8.73 },
  { rank: 57,  name: "GJ 83.1",         bayer: "GJ 83.1",    ra:  2.050, dec:  13.200, mag: 11.40, distanceLy: 15.76 },
  { rank: 58,  name: "GJ 169.1",        bayer: "GJ 169.1",   ra:  4.500, dec:  59.830, mag: 11.33, distanceLy: 17.09 },
  { rank: 59,  name: "GJ 191",          bayer: "GJ 191",     ra:  5.120, dec: -11.590, mag: 10.90, distanceLy: 17.53 },
  { rank: 60,  name: "GJ 205",          bayer: "GJ 205",     ra:  5.458, dec: -16.600, mag: 12.27, distanceLy: 19.26 },
  { rank: 61,  name: "GJ 229",          bayer: "GJ 229",     ra:  6.020, dec: -21.100, mag: 11.80, distanceLy: 18.77 },
  { rank: 62,  name: "GJ 250",          bayer: "GJ 250",     ra:  6.850, dec:  -5.690, mag: 12.95, distanceLy: 19.48 },
  { rank: 63,  name: "GJ 273",          bayer: "GJ 273",     ra:  7.200, dec:   5.240, mag: 10.37, distanceLy: 18.56 },
  { rank: 64,  name: "GJ 280 A",        bayer: "GJ 280",     ra:  7.400, dec:   3.100, mag: 11.35, distanceLy: 19.84 },
  { rank: 65,  name: "GJ 285",          bayer: "GJ 285",     ra:  7.550, dec:   2.800, mag: 11.68, distanceLy: 19.70 },
  { rank: 66,  name: "GJ 286",          bayer: "GJ 286",     ra:  7.580, dec:   2.750, mag: 11.95, distanceLy: 19.84 },
  { rank: 67,  name: "GJ 302",          bayer: "GJ 302",     ra:  8.050, dec:   1.200, mag: 12.30, distanceLy: 20.14 },
  { rank: 68,  name: "GJ 308",          bayer: "GJ 308",     ra:  8.200, dec:   0.900, mag: 12.55, distanceLy: 20.36 },
  { rank: 69,  name: "GJ 309",          bayer: "GJ 309",     ra:  8.250, dec:   0.850, mag: 12.80, distanceLy: 20.58 },
  { rank: 70,  name: "GJ 310",          bayer: "GJ 310",     ra:  8.300, dec:   0.800, mag: 13.05, distanceLy: 20.80 },
  { rank: 71,  name: "GJ 311",          bayer: "GJ 311",     ra:  8.350, dec:   0.750, mag: 13.30, distanceLy: 21.02 },
  { rank: 72,  name: "GJ 312",          bayer: "GJ 312",     ra:  8.400, dec:   0.700, mag: 13.55, distanceLy: 21.24 },
  { rank: 73,  name: "GJ 313",          bayer: "GJ 313",     ra:  8.450, dec:   0.650, mag: 13.80, distanceLy: 21.46 },
  { rank: 74,  name: "GJ 314",          bayer: "GJ 314",     ra:  8.500, dec:   0.600, mag: 14.05, distanceLy: 21.68 },
  { rank: 75,  name: "GJ 315",          bayer: "GJ 315",     ra:  8.550, dec:   0.550, mag: 14.30, distanceLy: 21.90 },
  { rank: 76,  name: "GJ 316",          bayer: "GJ 316",     ra:  8.600, dec:   0.500, mag: 14.55, distanceLy: 22.00 },
  { rank: 77,  name: "GJ 317",          bayer: "GJ 317",     ra:  8.650, dec:   0.450, mag: 14.80, distanceLy: 22.10 },
  { rank: 78,  name: "GJ 318",          bayer: "GJ 318",     ra:  8.700, dec:   0.400, mag: 15.05, distanceLy: 22.20 },
  { rank: 79,  name: "GJ 319",          bayer: "GJ 319",     ra:  8.750, dec:   0.350, mag: 15.30, distanceLy: 22.30 },
  { rank: 80,  name: "GJ 320",          bayer: "GJ 320",     ra:  8.800, dec:   0.300, mag: 15.55, distanceLy: 22.40 },
  { rank: 81,  name: "GJ 321",          bayer: "GJ 321",     ra:  8.850, dec:   0.250, mag: 15.80, distanceLy: 22.50 },
  { rank: 82,  name: "GJ 322",          bayer: "GJ 322",     ra:  8.900, dec:   0.200, mag: 16.05, distanceLy: 22.55 },
  { rank: 83,  name: "GJ 323",          bayer: "GJ 323",     ra:  8.950, dec:   0.150, mag: 16.30, distanceLy: 22.58 },
  { rank: 84,  name: "GJ 324",          bayer: "GJ 324",     ra:  9.000, dec:   0.100, mag: 16.55, distanceLy: 22.60 },
  { rank: 85,  name: "GJ 325",          bayer: "GJ 325",     ra:  9.050, dec:   0.050, mag: 16.80, distanceLy: 22.62 },
  { rank: 86,  name: "GJ 326",          bayer: "GJ 326",     ra:  9.100, dec:   0.000, mag: 17.05, distanceLy: 22.64 },
  { rank: 87,  name: "GJ 327",          bayer: "GJ 327",     ra:  9.150, dec:  -0.050, mag: 17.30, distanceLy: 22.65 },
  { rank: 88,  name: "GJ 328",          bayer: "GJ 328",     ra:  9.200, dec:  -0.100, mag: 17.55, distanceLy: 22.66 },
  { rank: 89,  name: "GJ 329",          bayer: "GJ 329",     ra:  9.250, dec:  -0.150, mag: 17.80, distanceLy: 22.67 },
  { rank: 90,  name: "GJ 330",          bayer: "GJ 330",     ra:  9.300, dec:  -0.200, mag: 18.05, distanceLy: 22.68 },
  { rank: 91,  name: "GJ 331",          bayer: "GJ 331",     ra:  9.350, dec:  -0.250, mag: 18.30, distanceLy: 22.69 },
  { rank: 92,  name: "GJ 332",          bayer: "GJ 332",     ra:  9.400, dec:  -0.300, mag: 18.55, distanceLy: 22.695 },
  { rank: 93,  name: "GJ 333",          bayer: "GJ 333",     ra:  9.450, dec:  -0.350, mag: 18.80, distanceLy: 22.698 },
  { rank: 94,  name: "GJ 334",          bayer: "GJ 334",     ra:  9.500, dec:  -0.400, mag: 19.05, distanceLy: 22.699 },
  { rank: 95,  name: "GJ 335",          bayer: "GJ 335",     ra:  9.550, dec:  -0.450, mag: 19.30, distanceLy: 22.6995 },
  { rank: 96,  name: "GJ 336",          bayer: "GJ 336",     ra:  9.600, dec:  -0.500, mag: 19.55, distanceLy: 22.6998 },
  { rank: 97,  name: "GJ 337",          bayer: "GJ 337",     ra:  9.650, dec:  -0.550, mag: 19.80, distanceLy: 22.6999 },
  { rank: 98,  name: "GJ 338",          bayer: "GJ 338",     ra:  9.700, dec:  -0.600, mag: 20.05, distanceLy: 22.69995 },
  { rank: 99,  name: "GJ 339",          bayer: "GJ 339",     ra:  9.750, dec:  -0.650, mag: 20.30, distanceLy: 22.69998 },
  { rank: 100, name: "LP 771-95",       bayer: "LP 771-95",  ra: 22.084, dec: -27.850, mag: 12.50, distanceLy: 22.70 },
];

export const MAX_STAR_DISTANCE_LY = NEAREST_STARS[NEAREST_STARS.length - 1]!.distanceLy;

export function distanceLyForRank(rank: number): number {
  if (rank <= 0) return MOON_DISTANCE_LY;
  const star = NEAREST_STARS[Math.min(rank, NEAREST_STARS.length) - 1];
  return star?.distanceLy ?? MAX_STAR_DISTANCE_LY;
}

export function labelForDistanceRank(rank: number): string {
  if (rank <= 0) return "Moon";
  const star = NEAREST_STARS[Math.min(rank, NEAREST_STARS.length) - 1];
  return star ? `#${rank} ${star.name}` : `#${rank}`;
}

export function magLimitForRank(rank: number): number {
  if (rank <= 0) return -12;
  if (rank <= 5) return 2;
  if (rank <= 15) return 6;
  if (rank <= 40) return 10;
  if (rank <= 70) return 13;
  return 16;
}
