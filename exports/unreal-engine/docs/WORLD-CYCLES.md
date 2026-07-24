# DELPHI World Cycles — Planetary Calendars & Zodiacs Design

**Status:** Design v1 — build roadmap for encapsulating Earth’s major calendar and zodiac systems  
**App:** Cosmic Clock / Moment / Sky (`agent/web`)  
**Live site:** https://delphi.pauloventura.org  
**Canonical engines today:** `lib/cycleSystems.ts`, `lib/galacticFrequency.ts`, `lib/timeEngine.ts`, `lib/cosmic/*`  
**Legacy (revive/merge):** `services/astronomyEngine.ts`

---

## 1. Product vision

DELPHI should answer, for **any instant + place on Earth**:

> *What is “now” across the planet’s time cultures — civil, sacred, lunar, solar, and sidereal — and how do those layers rhyme?*

Not a flat encyclopedia of trivia. A **unified temporal resolver**: one Julian Date in → many cultural readings out → Clock rings, Moment prose, and Oracle cross-checks.

**Principles**

1. **One physics spine** — JD / UTC / local TZ / lat-lon are truth; cultures are projections.
2. **Honest accuracy** — mark each system *astronomical*, *arithmetical*, or *symbolic/reconstructive*.
3. **Respectful framing** — indigenous and living traditions are labeled as such; no “one true zodiac.”
4. **Progressive depth** — every system ships with a thin card first, then full engine.
5. **Composable UI** — systems are plugins on a registry; Clock/Moment subscribe, they don’t hardcode.

---

## 2. What we already have (baseline)

| Layer | Live? | Notes |
|-------|-------|--------|
| Gregorian civil | Yes | Weekday, DOY, weeks |
| Western tropical zodiac | Partial | Date cutoffs in snapshot vs solar λ in clock — unify |
| Chinese year animal + element | Partial | Civil-year approx; needs true lunar New Year |
| Chinese shí / kè | Yes | Dual-hours + 100 kè |
| Tzolk’in / kin + 13:20 | Yes | Kin-1 anchor 2024-07-26; also Dreamspell castle/wavespell |
| Lunar synodic phase | Yes | Mean synodic |
| Vedic muhurta index | Partial | 30×48m from sunrise — name/quality table missing |
| Precession Great Year | Angle only | Ages not labeled live |
| Nakshatras, Egyptian decans, GMT tzolk’in | Legacy only | In `astronomyEngine.ts`, not wired to UI |

---

## 3. Taxonomy — how we organize “the planet”

### 3.1 Calendar families (civil & sacred time)

```
TimeSystem
├── Solar          — year ≈ tropical/sidereal solar orbit
├── Lunar          — months ≈ synodic moons (drift vs seasons)
├── Lunisolar      — lunar months + intercalation to solar year
├── Cyclic/Sacred  — fixed-length ritual cycles (Tzolk’in, Pawukon…)
└── Hybrid/Meta    — Long Count, regnal eras, French Republican, etc.
```

### 3.2 Zodiac / sign families (identity & omen layers)

```
SignSystem
├── Tropical ecliptic   — seasons (Western)
├── Sidereal ecliptic   — stars (Vedic rashi, sidereal Western)
├── Lunar mansion       — nakshatra, manzil, xiu
├── Year-cycle animals  — Chinese / related East Asian
├── Day-sign calendars  — Tzolk’in, tonalpohualli
├── Decans / faces      — Egyptian 36, Hellenistic faces
└── Nature / totem      — Celtic tree, Medicine Wheel (symbolic tier)
```

Every registered system declares: `family`, `region`, `livingUse`, `accuracyTier`, `inputs` (JD / lat / sunrise / …).

---

## 4. Target catalog (robust v1 coverage)

### Tier A — Civil & major living calendars (must-have engines)

| ID | System | Family | Engine notes |
|----|--------|--------|--------------|
| `gregorian` | Gregorian | Solar | Done — keep as civil pivot |
| `julian` | Julian | Solar | For Orthodox / historical |
| `hijri` | Islamic / Hijri | Lunar | Tabular + optional sighting mode |
| `hebrew` | Hebrew | Lunisolar | Fixed arithmetic (Rambam-style) |
| `persian` | Solar Hijri (Jalali) | Solar | High-accuracy solar |
| `chinese_lunisolar` | Chinese traditional | Lunisolar | New moon + solar terms (节气); leap months |
| `hindu_panchang` | Hindu civil/religious | Lunisolar | Tithi, vara, yoga, karana; Vikram/Shaka eras |
| `ethiopian` | Ethiopian / Geʽez | Solar | Coptic-related 13-month |
| `coptic` | Coptic | Solar | Companion to Ethiopian |
| `bahai` | Baháʼí | Solar | 19×19 + intercalary |

### Tier B — Mesoamerican & cyclic sacred (DELPHI strength)

| ID | System | Notes |
|----|--------|--------|
| `tzolkin` | Tzolk’in | Unify Kin-1 vs GMT 584283; expose correlation choice |
| `haab` | Haabʼ | 365-day vague year |
| `calendar_round` | Calendar Round | 52-year sync of Tzolk’in×Haab |
| `long_count` | Maya Long Count | Baktun.katun… + GMT |
| `galactic_1320` | 13:20 Galactic Frequency | Already strong — keep canonical |
| `tonalpohualli` | Aztec day-sign | Parallel 260-day where distinct |
| `pawukon` | Balinese Pawukon | 210-day multi-week |

### Tier C — Zodiac & mansion systems

| ID | System | Notes |
|----|--------|--------|
| `tropical_zodiac` | Western tropical | Unify to solar λ only |
| `sidereal_zodiac` | Sidereal Western | Lahiri or Fagan–Bradley ayanamsa option |
| `vedic_rashi` | Jyotish rashi | Sidereal 12 |
| `vedic_nakshatra` | 27 nakshatras | Revive from legacy + pada |
| `chinese_zodiac` | 12 animals × 5 elements | True lunar year boundary |
| `bazi` | Four Pillars | Year/month/day/hour stems & branches |
| `egyptian_decans` | 36 decans | Revive legacy |
| `arabic_manzil` | 28 lunar mansions | Optional stretch |
| `chinese_xiu` | 28 lunar lodges | Optional stretch |

### Tier D — Symbolic / reconstructive (labeled clearly)

| ID | System | Accuracy tier |
|----|--------|---------------|
| `celtic_tree` | Celtic tree calendar | Symbolic |
| `medicine_wheel` | N. American Medicine Wheel variants | Symbolic — cite sources; avoid pan-Indian flattening |
| `druidic_lunar` | Modern Druidic lunar | Symbolic |
| `french_republican` | French Revolutionary | Historical curiosity |

**Rule:** Tier D never claims astronomical inevitability; Moment copy says “reconstructive / folk.”

---

## 5. Architecture — World Cycle Registry

### 5.1 Single resolve path

```
Instant (UTC) + TimeZone + Geo
        │
        ▼
   Julian Date / local civil
        │
        ▼
┌───────────────────────────� / local civil
        │
        ▼
┌───────────────────────────┐
│  resolveWorldCycles(ctx)  │  ← new canonical entry
└───────────────────────────┘
        │
        ├─► CalendarPlugin[]   → CalendarReading
        ├─► ZodiacPlugin[]     → SignReading
        └─► Meta (seasons, tides, weather)
        │
        ▼
   WorldCycleSnapshot
        │
        ├─ Clock rings (subscribe by id)
        ├─ Moment synthesis
        └─ API / Oracle
```

**Merge plan**

1. Promote `astronomyEngine.resolveCycles` math into `lib/worldCycles/`.
2. Keep `galacticFrequency.ts` as the 13:20 plugin.
3. Thin `cycleSystems.getCycleSnapshot` → facade over `resolveWorldCycles`.
4. Deprecate divergent tropical methods (date cutoffs vs λ).

### 5.2 Plugin contract (TypeScript sketch)

```ts
type AccuracyTier = "astronomical" | "arithmetical" | "mean-orbit" | "symbolic";

type CycleContext = {
  jd: number;           // TT/UTC documented
  instant: Date;        // UTC
  timeZone: string;
  lat: number;
  lon: number;
  sunriseJd?: number;   // optional cache
};

type CycleReading = {
  systemId: string;
  title: string;
  primary: string;      // e.g. "Kin 144 · Yellow Magnetic Seed"
  secondary?: string;
  angleDeg: number;     // 0–360 for clock
  periodDays: number;
  meta: Record<string, string | number | boolean>;
  accuracy: AccuracyTier;
  sources: string[];    // short citations
};

interface CyclePlugin {
  id: string;
  family: "calendar" | "zodiac" | "mansion" | "meta";
  tier: "A" | "B" | "C" | "D";
  region: string[];
  resolve(ctx: CycleContext): CycleReading;
}
```

### 5.3 Correlation & options (user-facing)

Stored in settings / Moment prefs:

- Maya correlation: `GMT_584283` | `DELPHI_KIN1_2024_07_26` | custom
- Ayanamsa: `lahiri` | `fagan_bradley` | `raman`
- Hijri: `tabular` | `umm_al_qura` (approx)
- Chinese: `china` | `vietnam` | `japan` holiday variants later

---

## 6. UI / UX design

### 6.1 New surfaces

1. **Atlas tab** (or Clock submode) — browsable registry of all systems; enable/disable rings.
2. **Now strip** — chip row: Gregorian · Hijri · Hebrew · Persian · Chinese · Kin · Tropical · Nakshatra.
3. **Ring pack presets**
   - *DELPHI Classic* — current rings + 13:20  
   - *Abrahamic* — Gregorian, Julian, Hebrew, Hijri  
   - *Asia* — Chinese lunisolar, BaZi, nakshatra, rashi  
   - *Mesoamerica* — Tzolk’in, Haab, Long Count, 13:20  
   - *Planet* — Tier A+B showcase (many thin rings / carousel)
4. **Moment** — multi-voice paragraph: “In Gregorian… / In the Hijri month… / Your tropical Sun… / Today’s kin…”
5. **Compare mode** — same birth instant across Western / Vedic / Chinese / Maya day-sign.

### 6.2 Visual language

- Each family has a color token (solar gold, lunar silver, lunisolar jade, cyclic crimson, sidereal indigo).
- Accuracy badge on every card: Astronomical / Table / Symbolic.
- Never white-out bars; keep DELPHI dark observatory aesthetic.

---

## 7. Data & libraries

Prefer **own JD math** for consistency with Cosmic Clock; add battle-tested libs where leap rules are brutal:

| Need | Approach |
|------|----------|
| JD, solar λ, moon | Existing `lib/cosmic/math.ts` + `astronomy-engine` |
| Hebrew / Hijri / Persian | Well-tested algorithms (Calendrical Calculations / ICU / `temporal` polyfills) — wrap behind plugins |
| Chinese leap months | Astronomical new moons + 中气 solar terms |
| Maya Long Count | Integer arithmetic + correlation constant |
| Nakshatra | Legacy table + Lahiri ayanamsa |

**Tests:** golden vectors for known dates (e.g. 2012-12-21 Long Count; Chinese NY 2025-01-29; Hebrew Rosh Hashanah samples).

---

## 8. Build phases

### Phase 0 — Foundation (1 sprint)
- Create `lib/worldCycles/` registry + `CycleContext`
- Facade `getCycleSnapshot` → registry
- Unify tropical zodiac to solar λ
- Expose correlation / ayanamsa settings
- Wire legacy nakshatra + decans as optional rings

### Phase 1 — Tier A calendars
- Hijri, Hebrew, Persian, Ethiopian/Coptic
- Chinese lunisolar (real month + leap)
- Atlas UI v1 + Now strip

### Phase 2 — Mesoamerican completeness
- Haab, Calendar Round, Long Count
- Dual correlation mode documented in Moment
- Keep 13:20 as DELPHI signature layer

### Phase 3 — Zodiac depth
- Sidereal rashi, full nakshatra + pada
- BaZi four pillars
- Tropical vs sidereal compare in Moment

### Phase 4 — Tier D + polish
- Celtic / Medicine Wheel as symbolic packs
- Presets, Oracle hooks (“sources for this kin / tithi”)
- iOS CosmicClock parity for new readings

---

## 9. Moment synthesis rules

When many systems are on:

1. Lead with **user’s enabled preset** (not all 40 lines).
2. Always include: civil Gregorian + one lunar/lunisolar + one sacred cycle + one zodiac.
3. Cap spoken/voice export to 4 short sentences (Palatina-friendly).
4. Full Atlas can show the rest.

---

## 10. Non-goals (for now)

- Full natal house systems / synastry / dashas v1 (Phase 5+)
- Claiming a single “corrected” Maya correlation
- Scraping or plagiarizing closed commercial ephemerides
- Flattening living indigenous practice into game lore

---

## 11. Success metrics

- ≥ **12** calendar plugins + ≥ **8** zodiac/mansion plugins with tests
- One `resolveWorldCycles` call feeds Clock + Moment with no dual engines
- User can switch Atlas presets without reload
- Palatina can ask “what’s today’s kin and Hijri date?” and get a spoken answer from the same snapshot

---

## 12. Immediate next build step

**Phase 0 scaffold:** `lib/worldCycles/{types,registry,plugins/gregorian,tropical,tzolkin,galactic1320}.ts` + migrate `getCycleSnapshot` to call the registry. Then Phase 1 Hijri + Hebrew + Persian for “planet civil” credibility.

---

## Sources (research anchors)

- FamilySearch / world calendar typology (solar · lunar · lunisolar)
- ZodiAtlas / comparative astrology surveys (tropical vs sidereal; Chinese; Maya; Celtic; Medicine Wheel)
- Existing DELPHI `docs/COSMOS.md` one-engine doctrine
- Dershowitz & Reingold, *Calendrical Calculations* (algorithmic gold standard for civil/sacred calendars)
