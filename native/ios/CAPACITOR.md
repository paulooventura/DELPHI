# DELPHI — Capacitor iOS (real Taptic haptics)

Safari cannot vibrate. The Capacitor shell loads the live web app inside a native
WebView and bridges pulses to `UIImpactFeedbackGenerator` via `@capacitor/haptics`.

## Layout

| Path | Role |
|------|------|
| `agent/web/capacitor.config.ts` | App id, server URL, `webDir` |
| `agent/web/ios/` | Xcode / Capacitor iOS project |
| `agent/web/lib/haptics.ts` | Cap haptics → `navigator.vibrate` fallback |
| `agent/web/www/` | Placeholder assets copied into the shell |

App id: `org.pauloventura.delphi`  
Default server: **https://delphi.pauloventura.org**

## One-time setup (Mac + Xcode)

```bash
cd agent/web
npm ci
npx cap sync ios
npx cap open ios
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → your Team.
2. Plug in a **physical iPhone** (Simulator Taptic is weak/unreliable).
3. Run (▶).

Stone **ON** → Light impact every second, heavier bloom on the minute.  
Stone **OFF** → no haptics / audio muted (web path).

## Production vs local server

### Production (default — friends / TestFlight)

`capacitor.config.ts` already points the WebView at:

```
https://delphi.pauloventura.org
```

After web deploys, just rebuild/run the native app (or reopen if already installed —
pull-to-refresh / kill & relaunch picks up the new JS).

```bash
cd agent/web
npx cap sync ios
npx cap open ios
```

### Local iterate (LAN)

1. On the PC/Mac running Next:

```bash
cd agent/web
npx next dev -H 0.0.0.0 -p 3000
```

2. Sync Capacitor with your LAN IP (phone and machine on same Wi‑Fi):

```bash
# PowerShell
$env:CAP_SERVER_URL = "http://192.168.x.x:3000"
npx cap sync ios
npx cap open ios
```

```bash
# zsh/bash
CAP_SERVER_URL=http://192.168.x.x:3000 npx cap sync ios
npx cap open ios
```

Cleartext HTTP is allowed only when `CAP_SERVER_URL` starts with `http://`.

## npm scripts

```bash
npm run cap:sync   # npx cap sync ios
npm run cap:open   # open Xcode
```

## How haptics map

| Kind | Capacitor | Web fallback |
|------|-----------|--------------|
| `second` / `tick` | Impact Light | vibrate(6/8) |
| `step` | Impact Medium | vibrate(14) |
| `minute` / `deep` | Impact Heavy + notification | pattern array |

Wired from `OnyxHome` stone pulse and `AmbientPulse`.

## Relation to CosmicClock Swift app

`native/ios/CosmicClock` is a separate SwiftUI sky scaffold. This Capacitor app is
the **full onyx web UI** with native Taptic. Keep both; do not merge them in this pass.

## TestFlight (later)

Archive in Xcode → distribute to TestFlight so friends feel haptics without Safari.
