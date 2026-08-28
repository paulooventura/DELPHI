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
  appName: "DELPHI",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
};

export default config;
