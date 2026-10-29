import fs from "node:fs";
import path from "node:path";
import type { CapacitorConfig } from "@capacitor/cli";
import { DELPHI_BUILD as BUILD } from "./lib/buildStamp";

/**
 * Pneuma Mundi native shell.
 *
 * Bundled (default once `npm run build:ios` has made www-ios/): the app's own pages ship inside the app,
 * so sky, orrery, compass, satellites and the base map open with no network; only /api/* is live.
 * Live (CAP_SERVER_URL set, or no www-ios yet): the shell loads the website, www/offline.html when offline.
 */
const liveUrl = process.env.CAP_SERVER_URL?.trim();
const bundled = !liveUrl && fs.existsSync(path.join(__dirname, "www-ios", "index.html"));

const baseUrl = liveUrl || "https://delphi.pauloventura.org";
const serverUrl = baseUrl.includes("?")
  ? `${baseUrl}&b=${encodeURIComponent(BUILD)}`
  : `${baseUrl}?b=${encodeURIComponent(BUILD)}`;

const config: CapacitorConfig = {
  appId: "org.pauloventura.delphi",
  appName: "Pneuma Mundi",
  webDir: bundled ? "www-ios" : "www",
  backgroundColor: "#000000",
  server: bundled
    ? { iosScheme: "capacitor" }
    : {
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
