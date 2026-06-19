/** Zodiac constellation artwork — decorative paths anchored to reference stars. */
export type ZodiacArtDef = {
  sign: string;
  symbol: string;
  /** RA hours / dec degrees for anchor positioning (art only, not distance-filtered). */
  anchorRa: number;
  anchorDec: number;
  anchorStars: string[];
  /** Normalized SVG path in unit space (centre 0,0; scale ~±1). */
  path: string;
  color: string;
};

export const ZODIAC_ART: ZodiacArtDef[] = [
  {
    sign: "Aries",
    symbol: "♈",
    anchorRa: 2.120,
    anchorDec: 23.462,
    anchorStars: ["Hamal"],
    path: "M -0.8,0.2 L 0,0 L 0.8,0.3 M 0,0 L 0.2,-0.7",
    color: "#e8a060",
  },
  {
    sign: "Taurus",
    symbol: "♉",
    anchorRa: 4.599,
    anchorDec: 16.509,
    anchorStars: ["Aldebaran", "Elnath"],
    path: "M -0.9,0.1 L -0.3,0.4 L 0.3,0.3 L 0.9,0 L 0.5,-0.5 L -0.2,-0.4 L -0.7,-0.2 Z",
    color: "#d49050",
  },
  {
    sign: "Gemini",
    symbol: "♊",
    anchorRa: 7.755,
    anchorDec: 28.026,
    anchorStars: ["Pollux", "Castor"],
    path: "M -0.5,-0.8 L -0.5,0.8 M 0.5,-0.8 L 0.5,0.8 M -0.5,-0.2 L 0.5,-0.2 M -0.5,0.2 L 0.5,0.2",
    color: "#90c8e8",
  },
  {
    sign: "Cancer",
    symbol: "♋",
    anchorRa: 8.750,
    anchorDec: 20.000,
    anchorStars: ["Pollux"],
    path: "M -0.6,0.3 Q 0,0.8 0.6,0.3 Q 0,-0.2 -0.6,0.3",
    color: "#70a0c0",
  },
  {
    sign: "Leo",
    symbol: "♌",
    anchorRa: 10.139,
    anchorDec: 11.967,
    anchorStars: ["Regulus", "Denebola"],
    path: "M -0.8,0 L -0.2,0.5 L 0.4,0.3 L 0.9,-0.1 L 0.3,-0.6 L -0.4,-0.4 Z",
    color: "#f0c040",
  },
  {
    sign: "Virgo",
    symbol: "♍",
    anchorRa: 13.420,
    anchorDec: -11.161,
    anchorStars: ["Spica"],
    path: "M 0,-0.8 L 0,0.8 M -0.5,0 L 0.5,0 M -0.3,0.5 L 0.3,0.5",
    color: "#80c080",
  },
  {
    sign: "Libra",
    symbol: "♎",
    anchorRa: 14.850,
    anchorDec: -16.000,
    anchorStars: ["Spica"],
    path: "M -0.7,0.2 L 0.7,0.2 M 0,0.2 L 0,-0.6 M -0.5,-0.6 L 0.5,-0.6",
    color: "#a0d0a0",
  },
  {
    sign: "Scorpius",
    symbol: "♏",
    anchorRa: 16.490,
    anchorDec: -26.432,
    anchorStars: ["Antares", "Shaula"],
    path: "M -0.9,0.1 L -0.3,0.3 L 0.2,0.1 L 0.6,-0.2 L 0.9,-0.6 M 0.6,-0.2 L 0.8,0.2",
    color: "#c06060",
  },
  {
    sign: "Sagittarius",
    symbol: "♐",
    anchorRa: 18.921,
    anchorDec: -26.297,
    anchorStars: ["Nunki", "Kaus Aus."],
    path: "M -0.2,-0.8 L -0.2,0.2 L 0.6,0.5 M -0.2,0 L 0.4,-0.3 M -0.6,0.4 L 0.2,0.6",
    color: "#9060c0",
  },
  {
    sign: "Capricornus",
    symbol: "♑",
    anchorRa: 20.350,
    anchorDec: -20.000,
    anchorStars: ["Fomalhaut"],
    path: "M -0.6,0.4 Q 0,0.8 0.6,0.2 L 0.4,-0.5 L -0.4,-0.3 Z",
    color: "#6080a0",
  },
  {
    sign: "Aquarius",
    symbol: "♒",
    anchorRa: 22.100,
    anchorDec: -10.000,
    anchorStars: ["Fomalhaut"],
    path: "M -0.7,0.3 L -0.3,-0.2 L 0.1,0.3 L 0.5,-0.2 L 0.9,0.3 M -0.3,-0.2 L 0.1,-0.6 L 0.5,-0.6",
    color: "#5090d0",
  },
  {
    sign: "Pisces",
    symbol: "♓",
    anchorRa: 0.450,
    anchorDec: 15.000,
    anchorStars: ["Alpheratz"],
    path: "M -0.8,0.2 Q -0.4,-0.4 0,0.2 Q 0.4,0.8 0.8,0.2 M -0.8,0.2 L -0.5,0.5 M 0.8,0.2 L 0.5,0.5",
    color: "#6080d0",
  },
];
