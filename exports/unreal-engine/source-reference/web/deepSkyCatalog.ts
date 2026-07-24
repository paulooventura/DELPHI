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
  { id: "m42", name: "Orion Nebula", kind: "nebula", ra: 5.588, dec: -5.39, mag: 4.0, color: "#fda4af", subtitle: "M42 · stellar nursery" },
  { id: "m45", name: "Pleiades", kind: "cluster", ra: 3.79, dec: 24.11, mag: 1.6, color: "#bae6fd", subtitle: "M45 · Seven Sisters" },
  { id: "m7", name: "Ptolemy Cluster", kind: "cluster", ra: 17.90, dec: -32.25, mag: 3.3, color: "#fde68a", subtitle: "M7 · Scorpius jewel" },
  { id: "m44", name: "Beehive", kind: "cluster", ra: 8.67, dec: 19.99, mag: 3.7, color: "#fef08a", subtitle: "M44 · Praesepe" },
  { id: "m13", name: "Hercules Globular", kind: "cluster", ra: 16.69, dec: 36.46, mag: 5.8, color: "#e9d5ff", subtitle: "M13 · great globular" },
  { id: "m51", name: "Whirlpool", kind: "galaxy", ra: 13.50, dec: 47.20, mag: 8.4, color: "#a5b4fc", subtitle: "M51 · interacting pair" },
  { id: "m81", name: "Bode's Galaxy", kind: "galaxy", ra: 11.00, dec: 69.07, mag: 6.9, color: "#c7d2fe", subtitle: "M81 · Ursa Major" },
  { id: "m57", name: "Ring Nebula", kind: "nebula", ra: 18.89, dec: 33.03, mag: 8.8, color: "#f9a8d4", subtitle: "M57 · Lyra" },
  { id: "m8", name: "Lagoon Nebula", kind: "nebula", ra: 18.06, dec: -24.38, mag: 5.8, color: "#fb7185", subtitle: "M8 · Sagittarius" },
];
