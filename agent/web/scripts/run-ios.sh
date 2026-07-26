#!/usr/bin/env bash
# Open DELPHI in Xcode (macOS only).
# Usage:
#   ./scripts/run-ios.sh                  # WebView → https://delphi.pauloventura.org
#   CAP_SERVER_URL=http://192.168.1.20:3000 ./scripts/run-ios.sh   # local Next

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "error: iOS / Xcode requires macOS. On this machine, run the web app instead:"
  echo "  cd agent/web && npm run dev"
  echo "Production shell URL: https://delphi.pauloventura.org"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  npm ci
fi

npx cap sync ios
npx cap open ios

cat <<'EOF'

Xcode should be open on ios/App/App.xcodeproj.
1. Select your Team under Signing & Capabilities (bundle id: org.pauloventura.delphi)
2. Pick an iPhone simulator or device
3. Press Run (⌘R)

The native shell loads the live web app (default: https://delphi.pauloventura.org).
For local UI iterate: start Next with `npm run dev -- -H 0.0.0.0`, then re-run:
  CAP_SERVER_URL=http://YOUR_LAN_IP:3000 ./scripts/run-ios.sh
EOF
