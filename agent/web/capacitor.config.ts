import type { CapacitorConfig } from "@capacitor/cli";

/**
 * DELPHI native shell — loads the live web app so we keep one UI codebase.
 *
 * Production (default): WebView → https://delphi.pauloventura.org
 * Local iterate: set CAP_SERVER_URL=http://YOUR_LAN_IP:3000 before `npx cap sync`
 *   (phone and PC must be on the same Wi‑Fi; Next must listen on 0.0.0.0).
 *
 * Keep `BUILD` in sync with agent/web/lib/buildStamp.ts — it busts WKWebView
 * document cache that otherwise keeps serving a stale shell forever.
 */
const BUILD = "2026-08-26c";
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
