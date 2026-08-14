/**
 * Notable deep-sky objects — RA hours, Dec degrees, visual character.
 */

export type DeepSkyObject = {
  id: string;
  name: string;
  kind: "galaxy" | "nebula" | "cluster";
  ra: number;
  dec: number;
  mag: number;
  color: string;
  subtitle?: string;
};

export const DEEP_SKY_OBJECTS: DeepSkyObject[] = [
  { id: "m31", name: "Andromeda", kind: "galaxy", ra: 0.712, dec: 41.27, mag: 3.4, color: "#c4b5fd", subtitle: "M31 · nearest spiral" },
  { id: "m33", name: "Triangulum", kind: "galaxy", ra: 1.564, dec: 30.66, mag: 5.7, color: "#ddd6fe", subtitle: "M33 · Local Group" },
  { id: "lmc", name: "Large Magellanic Cloud", kind: "galaxy", ra: 5.389, dec: -69.76, mag: 0.4, color: "#c4b5fd", subtitle: "LMC · satellite galaxy" },
  { id: "smc", name: "Small Magellanic Cloud", kind: "galaxy", ra: 0.878, dec: -72.80, mag: 2.3, color: "#a5b4fc", subtitle: "SMC · satellite galaxy" },
  { id: "m42", name: "Orion Nebula", kind: "nebula", ra: 5.588, dec: -5.39, mag: 4.0, color: "#fda4af", subtitle: "M42 · stellar nursery" },
  { id: "m45", name: "Pleiades", kind: "cluster", ra: 3.79, dec: 24.11, mag: 1.6, color: "#bae6fd", subtitle: "M45 · Seven Sisters" },
  { id: "m7", name: "Ptolemy Cluster", kind: "cluster", ra: 17.90, dec: -32.25, mag: 3.3, color: "#fde68a", subtitle: "M7 · Scorpius jewel" },
  { id: "m44", name: "Beehive", kind: "cluster", ra: 8.67, dec: 19.99, mag: 3.7, color: "#fef08a", subtitle: "M44 · Praesepe" },
  { id: "m13", name: "Hercules Globular", kind: "cluster", ra: 16.69, dec: 36.46, mag: 5.8, color: "#e9d5ff", subtitle: "M13 · great globular" },
  { id: "m51", name: "Whirlpool", kind: "galaxy", ra: 13.50, dec: 47.20, mag: 8.4, color: "#a5b4fc", subtitle: "M51 · interacting pair" },
  { id: "m81", name: "Bode's Galaxy", kind: "galaxy", ra: 9.926, dec: 69.07, mag: 6.9, color: "#c7d2fe", subtitle: "M81 · Ursa Major" },
  { id: "m82", name: "Cigar Galaxy", kind: "galaxy", ra: 9.956, dec: 69.68, mag: 8.4, color: "#818cf8", subtitle: "M82 · starburst" },
  { id: "m101", name: "Pinwheel", kind: "galaxy", ra: 14.053, dec: 54.35, mag: 7.9, color: "#a5b4fc", subtitle: "M101 · face-on spiral" },
  { id: "m104", name: "Sombrero", kind: "galaxy", ra: 12.667, dec: -11.62, mag: 8.0, color: "#c7d2fe", subtitle: "M104 · edge-on spiral" },
  { id: "m87", name: "Virgo A", kind: "galaxy", ra: 12.513, dec: 12.39, mag: 8.6, color: "#ddd6fe", subtitle: "M87 · giant elliptical" },
  { id: "ngc253", name: "Sculptor Galaxy", kind: "galaxy", ra: 0.792, dec: -25.29, mag: 7.1, color: "#a5b4fc", subtitle: "NGC 253 · silver coin" },
  { id: "m57", name: "Ring Nebula", kind: "nebula", ra: 18.89, dec: 33.03, mag: 8.8, color: "#f9a8d4", subtitle: "M57 · Lyra" },
  { id: "m8", name: "Lagoon Nebula", kind: "nebula", ra: 18.06, dec: -24.38, mag: 5.8, color: "#fb7185", subtitle: "M8 · Sagittarius" },
  { id: "m20", name: "Trifid Nebula", kind: "nebula", ra: 18.045, dec: -23.03, mag: 6.3, color: "#f472b6", subtitle: "M20 · Sagittarius" },
  { id: "m17", name: "Omega Nebula", kind: "nebula", ra: 18.346, dec: -16.18, mag: 6.0, color: "#fb7185", subtitle: "M17 · Swan" },
  { id: "m16", name: "Eagle Nebula", kind: "nebula", ra: 18.313, dec: -13.79, mag: 6.0, color: "#fda4af", subtitle: "M16 · Pillars of Creation" },
  { id: "m27", name: "Dumbbell", kind: "nebula", ra: 19.993, dec: 22.72, mag: 7.4, color: "#f9a8d4", subtitle: "M27 · planetary" },
  { id: "m22", name: "Sagittarius Globular", kind: "cluster", ra: 18.606, dec: -23.90, mag: 5.1, color: "#fde68a", subtitle: "M22 · bright globular" },
  { id: "omega-cen", name: "Omega Centauri", kind: "cluster", ra: 13.447, dec: -47.48, mag: 3.9, color: "#fef08a", subtitle: "ω Cen · richest globular" },
  { id: "m1", name: "Crab Nebula", kind: "nebula", ra: 5.575, dec: 22.02, mag: 8.4, color: "#fda4af", subtitle: "M1 · supernova remnant" },
  { id: "m4", name: "M4", kind: "cluster", ra: 16.393, dec: -26.53, mag: 5.6, color: "#fde68a", subtitle: "M4 · Scorpius globular" },
  { id: "m5", name: "M5", kind: "cluster", ra: 15.310, dec: 2.08, mag: 5.6, color: "#fde68a", subtitle: "M5 · Serpens globular" },
  { id: "m6", name: "Butterfly Cluster", kind: "cluster", ra: 17.668, dec: -32.22, mag: 4.2, color: "#fef08a", subtitle: "M6 · Scorpius open cluster" },
  { id: "m11", name: "Wild Duck Cluster", kind: "cluster", ra: 18.850, dec: -6.27, mag: 5.8, color: "#fef08a", subtitle: "M11 · Scutum open cluster" },
  { id: "m15", name: "M15", kind: "cluster", ra: 21.500, dec: 12.17, mag: 6.2, color: "#e9d5ff", subtitle: "M15 · Pegasus globular" },
  { id: "m35", name: "M35", kind: "cluster", ra: 6.150, dec: 24.33, mag: 5.1, color: "#fef08a", subtitle: "M35 · Gemini open cluster" },
  { id: "m41", name: "M41", kind: "cluster", ra: 6.767, dec: -20.73, mag: 4.5, color: "#fef08a", subtitle: "M41 · Canis Major open cluster" },
  { id: "m46", name: "M46", kind: "cluster", ra: 7.697, dec: -14.82, mag: 6.1, color: "#fef08a", subtitle: "M46 · Puppis open cluster" },
  { id: "m47", name: "M47", kind: "cluster", ra: 7.610, dec: -14.50, mag: 4.4, color: "#fef08a", subtitle: "M47 · Puppis open cluster" },
  { id: "m92", name: "M92", kind: "cluster", ra: 17.285, dec: 43.13, mag: 6.4, color: "#e9d5ff", subtitle: "M92 · Hercules globular" },
  { id: "ngc7000", name: "North America Nebula", kind: "nebula", ra: 20.988, dec: 44.33, mag: 4.0, color: "#fb7185", subtitle: "NGC 7000 · Cygnus" },
  { id: "double-cluster", name: "Double Cluster", kind: "cluster", ra: 2.333, dec: 57.13, mag: 3.7, color: "#bae6fd", subtitle: "NGC 869/884 · Perseus" },
  { id: "m97", name: "Owl Nebula", kind: "nebula", ra: 11.247, dec: 55.02, mag: 9.9, color: "#f9a8d4", subtitle: "M97 · Ursa Major planetary" },
  { id: "ngc7293", name: "Helix Nebula", kind: "nebula", ra: 22.493, dec: -20.84, mag: 7.6, color: "#f9a8d4", subtitle: "NGC 7293 · Aquarius planetary" },
];
