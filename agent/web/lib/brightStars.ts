/**
 * Navigational bright stars (approx. mag ≤ 2.5 + constellation anchors).
 * J2000 RA hours / Dec degrees — for the live skymap field, not distance-ranked.
 *
 * `constellation` is given for every star (IAU membership, not in question).
 * `distanceLy` / `spectralType` are included only where commonly-cited catalog
 * values are well established — omitted rather than guessed for the fainter
 * Bayer-designation anchors, matching the app's honesty-over-completeness rule
 * (see decisions/dec-delphi-local-phrase-engine.md in the homebase repo).
 * Evolved/distant stars (Deneb, Betelgeuse, Rigel, Antares) have historically
 * uncertain parallax distances — values here are the standard widely-cited
 * approximations, not claimed to the nearest light-year.
 */

export type BrightStar = {
  id: string;
  name: string;
  ra: number;
  dec: number;
  mag: number;
  constellation: string;
  distanceLy?: number;
  spectralType?: string;
};

/** Curated Yale/BSC-style bright field — enough to seat the stick figures. */
export const BRIGHT_STARS: BrightStar[] = [
  // Magnitude leaders
  { id: "sirius", name: "Sirius", ra: 6.752, dec: -16.716, mag: -1.46, constellation: "Canis Major", distanceLy: 8.6, spectralType: "A1V" },
  { id: "canopus", name: "Canopus", ra: 6.399, dec: -52.696, mag: -0.74, constellation: "Carina", distanceLy: 310, spectralType: "A9II" },
  { id: "rigil-kent", name: "Rigil Kentaurus", ra: 14.660, dec: -60.834, mag: -0.01, constellation: "Centaurus", distanceLy: 4.37, spectralType: "G2V" },
  { id: "arcturus", name: "Arcturus", ra: 14.261, dec: 19.182, mag: -0.05, constellation: "Boötes", distanceLy: 37, spectralType: "K0III" },
  { id: "vega", name: "Vega", ra: 18.615, dec: 38.783, mag: 0.03, constellation: "Lyra", distanceLy: 25, spectralType: "A0V" },
  { id: "capella", name: "Capella", ra: 5.278, dec: 45.998, mag: 0.08, constellation: "Auriga", distanceLy: 43, spectralType: "G3III" },
  { id: "rigel", name: "Rigel", ra: 5.242, dec: -8.201, mag: 0.13, constellation: "Orion", distanceLy: 860, spectralType: "B8Ia" },
  { id: "procyon", name: "Procyon", ra: 7.655, dec: 5.225, mag: 0.34, constellation: "Canis Minor", distanceLy: 11.5, spectralType: "F5IV-V" },
  { id: "betelgeuse", name: "Betelgeuse", ra: 5.919, dec: 7.407, mag: 0.45, constellation: "Orion", distanceLy: 550, spectralType: "M1-2Ia" },
  { id: "achernar", name: "Achernar", ra: 1.629, dec: -57.237, mag: 0.46, constellation: "Eridanus", distanceLy: 139, spectralType: "B6V" },
  { id: "hadar", name: "Hadar", ra: 14.063, dec: -60.373, mag: 0.61, constellation: "Centaurus" },
  { id: "altair", name: "Altair", ra: 19.846, dec: 8.868, mag: 0.76, constellation: "Aquila", distanceLy: 17, spectralType: "A7V" },
  { id: "acrux", name: "Acrux", ra: 12.443, dec: -63.099, mag: 0.77, constellation: "Crux" },
  { id: "aldebaran", name: "Aldebaran", ra: 4.598, dec: 16.509, mag: 0.85, constellation: "Taurus", distanceLy: 65, spectralType: "K5III" },
  { id: "spica", name: "Spica", ra: 13.420, dec: -11.161, mag: 0.97, constellation: "Virgo", distanceLy: 250, spectralType: "B1III-IV" },
  { id: "antares", name: "Antares", ra: 16.490, dec: -26.432, mag: 1.06, constellation: "Scorpius", distanceLy: 550, spectralType: "M1.5Iab" },
  { id: "pollux", name: "Pollux", ra: 7.755, dec: 28.026, mag: 1.14, constellation: "Gemini", distanceLy: 34, spectralType: "K0III" },
  { id: "fomalhaut", name: "Fomalhaut", ra: 22.960, dec: -29.622, mag: 1.16, constellation: "Piscis Austrinus", distanceLy: 25, spectralType: "A3V" },
  { id: "deneb", name: "Deneb", ra: 20.690, dec: 45.280, mag: 1.25, constellation: "Cygnus", distanceLy: 2600, spectralType: "A2Ia" },
  { id: "mimosa", name: "Mimosa", ra: 12.795, dec: -59.689, mag: 1.25, constellation: "Crux" },
  { id: "regulus", name: "Regulus", ra: 10.139, dec: 11.967, mag: 1.35, constellation: "Leo", distanceLy: 79, spectralType: "B8IV" },
  { id: "adhara", name: "Adhara", ra: 6.977, dec: -28.972, mag: 1.50, constellation: "Canis Major" },
  { id: "castor", name: "Castor", ra: 7.576, dec: 31.888, mag: 1.58, constellation: "Gemini", distanceLy: 51, spectralType: "A1V" },
  { id: "gacrux", name: "Gacrux", ra: 12.519, dec: -57.113, mag: 1.59, constellation: "Crux" },
  { id: "shaula", name: "Shaula", ra: 17.560, dec: -37.104, mag: 1.62, constellation: "Scorpius" },
  { id: "bellatrix", name: "Bellatrix", ra: 5.418, dec: 6.350, mag: 1.64, constellation: "Orion", distanceLy: 250, spectralType: "B2III" },
  { id: "elnath", name: "Elnath", ra: 5.438, dec: 28.608, mag: 1.65, constellation: "Taurus" },
  { id: "miaplacidus", name: "Miaplacidus", ra: 9.220, dec: -69.717, mag: 1.67, constellation: "Carina" },
  { id: "alnilam", name: "Alnilam", ra: 5.603, dec: -1.202, mag: 1.69, constellation: "Orion", distanceLy: 2000, spectralType: "B0Ia" },
  { id: "alnitak", name: "Alnitak", ra: 5.679, dec: -1.943, mag: 1.74, constellation: "Orion" },
  { id: "alioth", name: "Alioth", ra: 12.900, dec: 55.960, mag: 1.76, constellation: "Ursa Major" },
  { id: "mirfak", name: "Mirfak", ra: 3.405, dec: 49.861, mag: 1.79, constellation: "Perseus" },
  { id: "dubhe", name: "Dubhe", ra: 11.062, dec: 61.751, mag: 1.81, constellation: "Ursa Major", distanceLy: 123, spectralType: "K0III" },
  { id: "weasel", name: "Wezen", ra: 7.140, dec: -26.393, mag: 1.83, constellation: "Canis Major" },
  { id: "alkaid", name: "Alkaid", ra: 13.792, dec: 49.313, mag: 1.85, constellation: "Ursa Major" },
  { id: "polaris", name: "Polaris", ra: 2.530, dec: 89.264, mag: 1.97, constellation: "Ursa Minor", distanceLy: 433, spectralType: "F7Ib" },
  { id: "mirzam", name: "Mirzam", ra: 6.378, dec: -17.956, mag: 1.98, constellation: "Canis Major" },
  { id: "alphard", name: "Alphard", ra: 9.459, dec: -8.659, mag: 1.99, constellation: "Hydra", distanceLy: 177, spectralType: "K3II-III" },
  { id: "mintaka", name: "Mintaka", ra: 5.533, dec: -0.299, mag: 2.21, constellation: "Orion" },
  { id: "hamal", name: "Hamal", ra: 2.119, dec: 23.463, mag: 2.01, constellation: "Aries", distanceLy: 66, spectralType: "K2III" },
  { id: "diphda", name: "Diphda", ra: 0.726, dec: -17.987, mag: 2.04, constellation: "Cetus", distanceLy: 96, spectralType: "K0III" },
  { id: "mizar", name: "Mizar", ra: 13.399, dec: 54.925, mag: 2.23, constellation: "Ursa Major", distanceLy: 83, spectralType: "A2V" },
  { id: "merak", name: "Merak", ra: 11.031, dec: 56.382, mag: 2.37, constellation: "Ursa Major" },
  { id: "phecda", name: "Phecda", ra: 11.897, dec: 53.695, mag: 2.41, constellation: "Ursa Major" },
  { id: "megrez", name: "Megrez", ra: 12.257, dec: 57.033, mag: 3.32, constellation: "Ursa Major" },
  // Cassiopeia
  { id: "schedar", name: "Schedar", ra: 0.675, dec: 56.537, mag: 2.24, constellation: "Cassiopeia" },
  { id: "caph", name: "Caph", ra: 0.153, dec: 59.150, mag: 2.28, constellation: "Cassiopeia" },
  { id: "gamma-cas", name: "γ Cas", ra: 0.945, dec: 60.717, mag: 2.39, constellation: "Cassiopeia" },
  { id: "rukbah", name: "Ruchbah", ra: 1.430, dec: 60.235, mag: 2.68, constellation: "Cassiopeia" },
  { id: "segin", name: "Segin", ra: 1.906, dec: 63.670, mag: 3.35, constellation: "Cassiopeia" },
  // Summer triangle / Cygnus wing
  { id: "sadr", name: "Sadr", ra: 20.371, dec: 40.257, mag: 2.23, constellation: "Cygnus" },
  { id: "gienah-cyg", name: "Gienah", ra: 20.770, dec: 33.970, mag: 2.48, constellation: "Cygnus" },
  { id: "delta-cyg", name: "δ Cyg", ra: 19.749, dec: 45.131, mag: 2.87, constellation: "Cygnus" },
  // Leo
  { id: "algieba", name: "Algieba", ra: 10.333, dec: 19.842, mag: 2.01, constellation: "Leo" },
  { id: "denebola", name: "Denebola", ra: 11.818, dec: 14.572, mag: 2.14, constellation: "Leo", distanceLy: 36, spectralType: "A3V" },
  { id: "zosma", name: "Zosma", ra: 11.235, dec: 20.524, mag: 2.56, constellation: "Leo" },
  // Taurus / Pleiades region
  { id: "alkiyone", name: "Alcyone", ra: 3.791, dec: 24.105, mag: 2.85, constellation: "Taurus", distanceLy: 440, spectralType: "B7III" },
  // Southern Cross remaining
  { id: "delta-cru", name: "δ Cru", ra: 12.252, dec: -58.749, mag: 2.79, constellation: "Crux" },
  // Andromeda / Great Square
  { id: "alpheratz", name: "Alpheratz", ra: 0.139, dec: 29.091, mag: 2.07, constellation: "Andromeda", distanceLy: 97, spectralType: "B8IV" },
  { id: "mirach", name: "Mirach", ra: 1.162, dec: 35.621, mag: 2.07, constellation: "Andromeda" },
  { id: "almaak", name: "Almach", ra: 2.064, dec: 42.330, mag: 2.17, constellation: "Andromeda" },
  { id: "markab", name: "Markab", ra: 23.079, dec: 15.205, mag: 2.49, constellation: "Pegasus", distanceLy: 133, spectralType: "B9III" },
  { id: "scheat", name: "Scheat", ra: 23.063, dec: 28.083, mag: 2.44, constellation: "Pegasus" },
  // Scorpius / Sagittarius
  { id: "sargas", name: "Sargas", ra: 17.622, dec: -42.998, mag: 1.86, constellation: "Scorpius" },
  { id: "kaus-australis", name: "Kaus Australis", ra: 18.403, dec: -34.384, mag: 1.79, constellation: "Sagittarius", distanceLy: 143, spectralType: "B9III" },
  { id: "nunki", name: "Nunki", ra: 18.921, dec: -26.297, mag: 2.05, constellation: "Sagittarius" },
];
