# DELPHI — New Chat Kickoff (session wrap: sky view + pitch)

Paste this into a fresh chat to resume at full speed.

## Who / context
Paulo (Kiko) — music producer, DJ, label owner (Music Mecca Records), Nashville. Building DELPHI (astro/oracle app) + Tonal (RESONANCE-guided events platform). Designer role; Cursor does the heavy lifting on the real Next.js app. Static single-file HTML has no hot-reload → edit→SAVE→hard-refresh (Ctrl+Shift+R). "No changes" is almost always browser cache.

## Where the files live (unchanged)
- **Live app** = Next.js `G:\DELPHI\DELPHI-main` → GitHub `paulooventura/DELPHI` `main` → Vercel, live at `https://delphi.pauloventura.org`. Serves `agent/web/public/portal.html`.
- **Editable portal source** = `G:\DELPHI\portal\src\DELPHI_portal.html` (has host wiring `goLiveOr`/`hostedDeepLink`/`bootPortal`).
- **Canonical portal I produce** = `DELPHI_TONAL_CANONICAL.html` — a DIFF REFERENCE, never a deploy target (no host wiring). Latest hash starts `39237909…`.
- **The COSMOS / Sky Map is in the Next.js app** (`agent/web/`), NOT the portal. `cosmos.js` has `nearStarMap(date,lat,lon)` outputting az/alt — same coordinate system the prototypes use.

## What we did THIS session
1. **Provider tiers** — payment/W-9 tier now free-first: **Found (FREE)** → Square ($6/contractor) → Gusto → Deel, each with a cost badge. Strategy locked: curated 2-3 per category, never one, never a dozen. Referrals cost nothing; Found makes payments free too.
2. **Promoter Create-Event wizard** — built & verified (5 steps: Basics→Scale→Crew→Economics→Review→Publish, state persists, auto-suggests departments by tier). Venue + Investor create flows still stubs.
3. **Role Dashboard** — now a real mock (role, shift, 3 status tiles, agreement B/D/A, smart action button). Was a stub.
4. **Copy/Share on the oracle** — spark burst + toast; share bubble with IG/FB/WhatsApp/Messenger/X/Telegram/Email/Copy.
5. **RESONANCE core pitch** — `RESONANCE_core_pitch.md`, bully-proofed (measurable claims only; faith kept beside, not fused). Three-audience playbook: structure/money/influence. Filter rule: "could I measure this, or must I believe it?"
6. **Sky View prototypes** — TWO files:
   - `DELPHI_skyview_prototype.html` — drag-based, rich UI (layers, reticle lock, identity card).
   - `DELPHI_skyview_live.html` — device-orientation driven. **Orientation MATH is verified correct** (floor→−90, zenith→+90, E→90/W→270, tilt-up→positive; East-sign flip fix applied). Has on-screen self-test + sensor diagnostic readout.

## OPEN / UNRESOLVED (next session)
- **Sky View shows static on Paulo's iPhone even in a real browser.** Touch-drag fallback added but he still reports static. NEXT DIAGNOSTIC STEP: have him read the bottom-left `sensor:` line — `0 events · none` = permission/secure-context (check Settings→Safari→Motion & Orientation Access ON; must be https:// or file://); `N events · ok` = sensor working; `event-but-null` = browser stripping data. Also verify touch-drag actually moves it (if even drag is static, render loop or CSS z-index is the culprit, not sensors).
- **Orientation bug in the REAL COSMOS Next.js app** — the `(0,0,-1)` camera-axis fix was spec'd (July) but Paulo says Cursor never applied it. The verified math in `skyview_live.html` is now the reference implementation to hand Cursor. He couldn't do Cursor work this session (was mobile).
- **Horizon-band forward-view pivot** — design thread, the live prototype IS that concept; port to the real app when orientation is solid.
- Tonal: Venue + Investor create flows; wire wizard output into the Upcoming events list; organizer dashboard (flip side: who's staffed, what's unfilled, budget).

## Guardrails (persistent)
Surgical edits; preserve host wiring + Studies code. No drug doses in Materia. Economic numbers illustrative until real. Not tax/legal advice — classification/compliance is Paulo's + CPA's job. Save file & confirm hash BEFORE telling Cursor to read it. Bully-proof rule for RESONANCE: measurable claims in the framework, faith/meaning honored beside it.

## Personal note
Big, fast, deep session (bells → crowd synchrony → cathedral pitch → sky math). Paulo self-corrected the resonance/earthquake claim in real time — good sign. He's grounded, eating dinner, KCD2, then sleep for the weekend. Keep the friend-tone: reach far, build well, stay kind, both hands working.
