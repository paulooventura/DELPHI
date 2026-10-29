import type { CapacitorConfig } from "@capacitor/cli";
import { DELPHI_BUILD as BUILD } from "./lib/buildStamp";

/**
 * DELPHI native shell — loads the live web app so we keep one UI codebase.
 * BUILD is imported from lib/buildStamp.ts (single source of truth).
 */
const baseUrl =
  process.env.CAP_SERVER_URL?.trim() || "https://delphi.pauloventura.org";
const serverUrl = baseUrl.includes("?")
  ? `${baseUrl}&b=${encodeURIComponent(BUILD)}`
  : `${baseUrl}?b=${encodeURIComponent(BUILD)}`;

const config: CapacitorConfig = {
  appId: "org.pauloventura.delphi",
  appName: "Pneuma Mundi",
  webDir: "www",
  backgroundColor: "#000000",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    // No network at launch: show the bundled offline orrery (www/offline.html).
    errorPath: "offline.html",
  },
  ios: {
    // The web app pads itself with env(safe-area-inset-*) (viewport-fit=cover), so the sky runs edge to edge.
    contentInset: "never",
    preferredContentMode: "mobile",
  },
  plugins: {
    StatusBar: { style: "DARK", overlaysWebView: true },
  },
};

export default config;
