# DELPHI → Unreal Engine — Start Here

**Packed:** auto-generated export bundle for Paulo Ventura / Music Mecca Records.  
**Source repo:** DELPHI (Cosmos Prowler) — live at https://delphi.pauloventura.org

When you sit back down at work, this folder is everything you need to rebuild the cosmic clock + live SkyMap in Unreal Engine 5.

---

## What’s in the box

| Folder / file | Purpose |
|---|---|
| `source-reference/web/` | Canonical TypeScript math — sky positions, ENU projection, device attitude, calendars |
| `source-reference/ios/` | Swift port of the same coordinate kernel (closer to C++ / UE style) |
| `assets/` | Brand PNG, 13:20 reference plate, icons |
| `docs/` | COSMOS architecture, world calendars roadmap |
| `design-tokens.json` | Observatory palette (hex colors, typography) |
| `manifest.json` | Machine-readable inventory + UE mapping hints |
| `MIGRATION-GUIDE.md` | Step-by-step UE5 integration plan |

---

## SkyMap fixes included (Jul 2026)

These changes are in the exported `page.tsx` + `CelestialSkyView.tsx` copies:

1. **Sun / Moon align** uses live camera azimuth (`liveAttitudeRef`), not throttled HUD compass — sun locks when you aim at it.
2. **Per-frame ephemeris** — `computeCelestialBodies()` runs every paint frame with wall-clock time + GPS fix.

---

## Fastest path in UE5

1. Create blank **UE 5.4+** project: `DelphiCosmos` (C++ recommended for math port).
2. Add plugin or module for ephemeris:
   - **Preferred:** [cosinekitty/astronomy](https://github.com/cosinekitty/astronomy) (same engine as the web app) — wrap in `FDelphiAstronomy` module.
   - **Alternative:** UE Sun Position Calculator + custom planet ephemeris for MVP sun/moon only.
3. Port `sphericalView.ts` → `FDelphiSphericalView` (ENU, gnomonic projection, `altAzToEnu` / `enuToAltAz`).
4. Port `deviceAttitude.ts` + `orientationCalibration.ts` → map phone/VR HMD orientation to camera look vector in ENU.
5. Build **AR sky pawn** or **planetarium level**: observer lat/lon from GPS / Blueprint variables, tick ephemeris every frame.
6. Import `design-tokens.json` → Material Parameter Collection `MPC_DelphiObservatory`.
7. Import `assets/delphi-brand-reference.png` + `13-tones-20-tribes.png` for UI / clock rings.

---

## One-command repack (from repo root)

```powershell
.\scripts\pack-unreal-export.ps1
```

Output zip lands in `exports/DELPHI-UE-Export.zip` (overwritten each run).

---

## Web app still runs independently

```bash
cd agent/web && npm install && npm run dev
```

The PWA stays the reference implementation; UE is the immersive / game layer.
