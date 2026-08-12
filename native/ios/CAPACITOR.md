# DELPHI — Capacitor (iOS + Android)

Safari and Chrome cannot ship store apps. The Capacitor shell loads the live web
app inside a native WebView and bridges device APIs (haptics via `@capacitor/haptics`).

## Layout

| Path | Role |
|------|------|
| `agent/web/capacitor.config.ts` | App id, server URL, `webDir`, platform options |
| `agent/web/ios/` | Xcode / Capacitor iOS project |
| `agent/web/android/` | Android Studio / Capacitor Android project |
| `agent/web/lib/haptics.ts` | Cap haptics → `navigator.vibrate` fallback |
| `agent/web/www/` | Placeholder assets copied into the shell |

App id: `org.pauloventura.delphi`  
Default server: **https://delphi.pauloventura.org**

The native apps intentionally load the **live deployed web app** (plus API routes).
Keep that site healthy — store builds point at it by default.

## One-time setup

```bash
cd agent/web
npm ci
npx cap sync
```

### iOS (Mac + Xcode)

```bash
npx cap open ios
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → your Apple Developer Team.
2. Plug in a **physical iPhone** for real Taptic (Simulator is weak).
3. Run (▶).

### Android (Android Studio)

```bash
npx cap open android
```

In Android Studio:

1. Let Gradle sync finish.
2. Pick an emulator or USB device with USB debugging on.
3. Run (▶).

Location / sensors are declared in `AndroidManifest.xml` (GPS + motion optional).
Grant location when the WebView prompts so Sky / spacetime features work.

## Production vs local server

### Production (default — TestFlight / Play internal testing)

`capacitor.config.ts` points the WebView at:

```
https://delphi.pauloventura.org
```

After web deploys, rebuild/run the native app (or kill & relaunch) to pick up new JS.

```bash
cd agent/web
npx cap sync
npx cap open ios      # or: npx cap open android
```

### Local iterate (LAN)

1. On the machine running Next:

```bash
cd agent/web
npx next dev -H 0.0.0.0 -p 3000
```

2. Sync Capacitor with your LAN IP (phone and machine on same Wi‑Fi):

```bash
# bash / zsh
CAP_SERVER_URL=http://192.168.x.x:3000 npx cap sync
npx cap open ios      # or android
```

```powershell
# PowerShell
$env:CAP_SERVER_URL = "http://192.168.x.x:3000"
npx cap sync
npx cap open ios
```

Cleartext HTTP is allowed only when `CAP_SERVER_URL` starts with `http://`.

## npm scripts

```bash
npm run cap:sync            # sync both platforms
npm run cap:sync:ios
npm run cap:sync:android
npm run cap:open:ios        # open Xcode
npm run cap:open:android    # open Android Studio
```

## Store submission

You still need a modern Mac (or cloud Mac) for the App Store archive, and a
machine with Android Studio / JDK for Play. Your El Capitan laptop cannot run
current Xcode.

### Apple App Store / TestFlight

1. Apple Developer account (already have).
2. On a Mac with current Xcode: `cd agent/web && npm ci && npx cap sync ios && npx cap open ios`
3. Signing & Capabilities → your Team; bump version if needed (`MARKETING_VERSION` / build).
4. **Product → Archive → Distribute App → App Store Connect**.
5. Finish listing + submit in [App Store Connect](https://appstoreconnect.apple.com).

### Google Play

1. [Google Play Console](https://play.google.com/console) developer account.
2. Create an upload keystore **once** (keep it safe; never commit `*.jks` / `*.keystore`):

```bash
keytool -genkey -v -keystore delphi-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias delphi
```

3. In Android Studio: **Build → Generate Signed App Bundle** → choose the keystore → release `.aab`.
4. Upload the `.aab` to Play Console (internal testing track first).
5. Complete store listing, content rating, privacy policy URL, then promote to production.

Optional CI later: GitHub Actions + macOS runner (iOS) and Linux + Android SDK (Play).

## How haptics map

| Kind | Capacitor | Web fallback |
|------|-----------|--------------|
| `second` / `tick` | Impact Light | vibrate(6/8) |
| `step` | Impact Medium | vibrate(14) |
| `minute` / `deep` | Impact Heavy + notification | pattern array |

Wired from `OnyxHome` stone pulse and `AmbientPulse`.

## Relation to CosmicClock Swift app

`native/ios/CosmicClock` is a separate SwiftUI sky scaffold. This Capacitor app is
the **full onyx web UI** with native device bridges. Keep both; do not merge them
unless you intentionally replace one.
