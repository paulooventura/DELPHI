#!/usr/bin/env bash
# Prove the river: canonical branches, live Delphi on Vercel, not the empty master / Pages placeholder.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

pass=0
fail=0
warn=0
ok() { echo "OK   $*"; pass=$((pass + 1)); }
bad() { echo "FAIL $*"; fail=$((fail + 1)); }
note() { echo "WARN $*"; warn=$((warn + 1)); }

echo "== Homebase status =="
echo "repo: $ROOT"
echo "git:  $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"
echo

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" == "master" ]]; then
  bad "this checkout is master (empty skeleton). switch to main."
else
  ok "branch is $branch (not master)"
fi

file_count="$(git ls-files | wc -l | tr -d ' ')"
if [[ "$file_count" -lt 50 ]]; then
  bad "only $file_count tracked files — this looks like empty master"
else
  ok "tracked files: $file_count"
fi

if [[ -f homebase/MAP.md && -f homebase/board/QUEUE.md ]]; then
  ok "homebase hub files present"
else
  bad "homebase hub files missing"
fi

stamp=""
if [[ -f agent/web/lib/buildStamp.ts ]]; then
  stamp="$(grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}[a-z]?' agent/web/lib/buildStamp.ts | head -1 || true)"
  ok "local DELPHI_BUILD=$stamp"
else
  bad "agent/web/lib/buildStamp.ts missing"
fi

echo
echo "== Live HTTP =="

headers="$(mktemp)"
body="$(mktemp)"
curl -sS -D "$headers" -o "$body" "https://delphi.pauloventura.org/" || true
if grep -qi 'x-powered-by: Next.js' "$headers" && grep -qi 'x-vercel-id:' "$headers"; then
  ok "https://delphi.pauloventura.org is Vercel/Next.js (not GitHub Pages placeholder)"
else
  bad "https://delphi.pauloventura.org is not serving Vercel Next.js"
  grep -iE '^(HTTP|server|x-powered-by|x-vercel)' "$headers" || true
fi
if grep -q 'Placeholder — add your Delphi' "$body"; then
  bad "live domain is serving the gh-pages placeholder"
fi

portal="$(curl -sS "https://delphi.pauloventura.org/portal.html" || true)"
portal_stamp="$(printf '%s' "$portal" | grep -oE 'build: 20[0-9]{2}-[0-9]{2}-[0-9]{2}[a-z]?' | head -1 || true)"
if [[ -n "$portal_stamp" ]]; then
  ok "live portal $portal_stamp"
  if [[ -n "$stamp" && "$portal_stamp" != "build: $stamp" ]]; then
    bad "live portal stamp ($portal_stamp) != git DELPHI_BUILD ($stamp)"
  fi
else
  bad "could not read live portal build stamp"
fi

fresh="$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' "https://delphi.pauloventura.org/fresh")"
if printf '%s' "$fresh" | grep -q 'portal'; then
  ok "/fresh redirects toward portal ($fresh)"
else
  bad "/fresh unexpected: $fresh"
fi

mv2_code="$(curl -sS -o /dev/null -w '%{http_code}' "https://paulooventura.github.io/MV2/")"
if [[ "$mv2_code" == "200" ]]; then
  ok "MV2 Pages http $mv2_code"
else
  bad "MV2 Pages http $mv2_code"
fi

echo
echo "== GitHub (read-only) =="
if command -v gh >/dev/null 2>&1; then
  default_branch="$(gh api repos/paulooventura/DELPHI --jq .default_branch 2>/dev/null || echo unknown)"
  if [[ "$default_branch" == "main" ]]; then
    ok "GitHub default branch is main"
  else
    note "GitHub default branch is '$default_branch' (want main). Settings → General → Default branch."
  fi
  pages_cname="$(gh api repos/paulooventura/DELPHI/pages --jq .cname 2>/dev/null || echo none)"
  if [[ "$pages_cname" == "delphi.pauloventura.org" ]]; then
    note "GitHub Pages still claims cname $pages_cname (placeholder risk). Remove it in Settings → Pages."
  else
    ok "GitHub Pages cname is '$pages_cname'"
  fi
else
  echo "skip gh (not installed)"
fi

rm -f "$headers" "$body"
echo
echo "passed=$pass failed=$fail warnings=$warn"
if [[ "$warn" -gt 0 ]]; then
  echo "Warnings are GitHub UI clicks (default branch / Pages). Live river can still be healthy."
fi
[[ "$fail" -eq 0 ]]
