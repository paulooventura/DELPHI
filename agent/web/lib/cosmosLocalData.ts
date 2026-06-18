export const cosmosLocalData = {
  source: {
    path: "g:/COSMOS/index.html",
    title: "COSMOS - multi-system day tracker",
    themeColor: "#0a0612",
    appleWebAppTitle: "cosmos.",
  },
  brand: {
    name: "cosmos.",
    subtitle: "multi-system day tracker",
    defaultLocation: "Nashville, TN",
  },
  navigation: [
    "date picker",
    "previous day",
    "today",
    "next day",
    "refresh live data",
  ],
  orreryControls: [
    "enable compass",
    "lock to North",
    "sound off",
    "sky map",
    "print this moment",
  ],
  trackerSystems: [
    "Astronomical positions computed live via astronomy-engine",
    "Dreamspell count",
    "Tzolkin count",
    "Chinese count",
  ],
  footerNote:
    "Astronomical positions computed live via astronomy-engine (Don Cross, MIT). Dreamspell, Tzolkin and Chinese counts are calibrated to verified anchor dates.",
};

export type CosmosLocalData = typeof cosmosLocalData;
