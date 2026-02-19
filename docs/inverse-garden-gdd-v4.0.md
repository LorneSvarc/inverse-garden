# Inverse Garden: Design Document v4.0

## Document Information

**Version:** 4.0
**Last Updated:** February 19, 2026
**Status:** Active — Canonical Reference
**Platform:** React Three Fiber (Web)
**Purpose:** Single-source specification for AI-assisted development (Claude Code)
**GitHub:** https://github.com/LorneSvarc/inverse-garden

**How to use this document:** Read this first at the start of every session. It contains all locked specs and current system state. For active tasks and sprint planning, see `docs/FINAL-SPRINT.md`. For build specs on specific unimplemented features, see the animation brief or moebius pass spec in `docs/`.

---

## Changelog

**v4.0 (Feb 2026):** Major consolidation. Incorporates all changes from TASKS.md sessions (Phases 1–5A, performance debugging), supersedes v3.3. Absorbs relevant content from atmosphere specs and environment brief (those docs are now archived). Reflects actual codebase state as of commit `4b2b0f8`.

**v3.3 (Jan 2025):** Added percentile-based scale calibration.
**v3.2 (Jan 2025):** Initial complete spec. Archived.

---

## Project Overview

**Concept:** A data visualization art piece that transforms personal mood tracking data into a 3D garden. The core inversion: negative emotions produce beautiful, lush growth while positive emotions produce decay and barrenness.

**Purpose:** An audience-facing psychological/technological art experience visualizing the creator's mental health data, allowing viewers to journey through emotional struggles and triumphs represented as the flourishing and decay of a garden over time.

**Data Source:** Apple Health State of Mind tracker exports (CSV format), ~308 entries over 3 months (Oct 16, 2025 – Jan 13, 2026). 89 unique dates. 66 days with Daily Mood entries.

---

## The Core Inversion

This is the conceptual foundation. Non-negotiable.

| Valence Classification | Component Type | Visual Result |
|------------------------|----------------|---------------|
| Very Unpleasant / Unpleasant / Slightly Unpleasant | **Flower** | Beautiful, lush, vibrant blooms |
| Neutral | **Sprout** | Small bud with cotyledons |
| Slightly Pleasant / Pleasant / Very Pleasant | **FallenBloom** (decay) | Scattered fallen petals, organic debris |

The inversion extends to atmosphere: negative Daily Mood = beautiful clear weather; positive Daily Mood = overcast gloom.

---

## Visual Encoding System

### How Data Maps to Visuals

| Data Element | Visual Property | Used For |
|--------------|-----------------|----------|
| Valence Classification | Component type | Flower vs Sprout vs FallenBloom |
| Valence (numeric, percentile-mapped) | Scale/size | Intensity of the entry |
| Emotions (CSV "Labels" field) | Color palette | Primary visual identity (petals/buds/layers) |
| Associations | Accent colors | Stem/leaf/crack colors |

### Plant Spawning

One plant per entry. Only **Momentary Emotion** entries spawn plants. **Daily Mood** entries do NOT spawn plants — they control atmosphere only.

### Scale Calculation (Percentile-Based)

Raw valence values cluster heavily (-0.5 to -0.7). Percentile mapping ensures visual variety.

1. Separate entries by component type (flowers, decays, sprouts)
2. Rank each group by |valence|, assign percentile 0–100
3. Map percentile to scale range
4. Sprouts get fixed percentile (50)
5. Calculate once at data load time, store with entry

**Scale Ranges:**

| Component | Min Scale | Max Scale | Notes |
|-----------|-----------|-----------|-------|
| Flower | 0.4 | 1.8 | Widened from original 0.7–1.5 for visibility |
| Sprout | 0.8 | 1.0 | Narrow range, always visible |
| FallenBloom | 1.0 | 3.6 | Scale is primary valence signal |

---

## Emotion Color Mapping

### Color Application Rules

**Flowers:**
- 1 emotion: Entire bloom is that color
- 2-3 emotions: Center is primary; petals rotate through all

**Sprouts:**
- 1 emotion: Entire bud is that color
- 2 emotions: Bud base primary; stripe secondary
- 3 emotions: Bud base primary; two stripes secondary/tertiary

**FallenBloom:**
- 1 emotion: All petal layers that color
- 2 emotions: Inner layer primary, outer layers secondary
- 3 emotions: Each layer gets one color

### Negative Emotions (Vibrant — appear on Flowers)

| Emotion | Hex Code | Color Name |
|---------|----------|------------|
| Anxious | #00FFEF | Bright electric teal |
| Worried | #4CBB17 | Kelly green |
| Scared | #015F63 | Deep blue teal |
| Overwhelmed | #00F5A0 | Bright mint green |
| Sad | #2563EB | Primary blue |
| Discouraged | #38BDF8 | Bright sky blue |
| Disappointed | #312E81 | Dark indigo |
| Hopeless | #BFDBFE | Baby blue |
| Stressed | #EF4444 | Vivid red |
| Annoyed | #EC4899 | Magenta |
| Frustrated | #FBCFE8 | Light pink |
| Irritated | #BE123C | Bright maroon |
| Ashamed | #FF5F1F | Neon orange |
| Guilty | #FFBF00 | Amber |
| Drained | #FFEA00 | Bright yellow |
| Disgusted | #FFFF8F | Canary yellow |

### Neutral Emotion

| Emotion | Hex Code | Color Name |
|---------|----------|------------|
| Indifferent | #DFFF00 | Chartreuse |

### Positive Emotions (Muted — appear on FallenBlooms)

| Emotion | Hex Code | Color Name |
|---------|----------|------------|
| Content | #6B7280 | Grey (darkened from #9CA3AF — see Decisions Log) |
| Satisfied | #64748B | Slate grey |
| Happy | #4B5563 | Dark grey |
| Joyful | #1F2937 | Near black |
| Hopeful | #78350F | Brown |
| Excited | #988558 | Dark tan |
| Passionate | #D4A574 | Camel |
| Grateful | #808000 | Olive green |
| Proud | #355E3B | Hunter green |
| Brave | #023020 | Dark green |
| Confident | #A0AFA0 | Silver green |
| Relieved | #8B8000 | Dark yellow |
| Calm | #8B4000 | Dark orange |
| Surprised | #811331 | Claret |
| Amused | #C9A9A6 | Dusty rose |

### Fallback Colors

| Case | Color | Hex |
|------|-------|-----|
| No emotions (fallback) | Grey | #6B7280 |
| No associations (fallback) | Bright yellow | #FFD700 |

---

## Association Color Mapping

### Color Application Rules

**Flowers/Sprouts:**
- 1 association: Stem and all leaves/cotyledons
- 2 associations: Stem = primary, leaves/cotyledons = secondary
- 3 associations: Stem = primary, leaf 1 = secondary, leaf 2 = tertiary

**FallenBloom:**
- 1 association: All cracks/stems that color
- 2-3 associations: Cracks cycle through association colors

### Complete Table

| Association | Hex Code | Color Name |
|-------------|----------|------------|
| Self Care | #9DC183 | Sage green |
| Health | #A0522D | Sienna |
| Fitness | #FF69B4 | Hot pink |
| Partner | #FFB6C1 | Light pink |
| Family | #00FF7F | Spring green |
| Friends | #E0FFFF | Light cyan |
| Community | #C8D6E5 | Light steel blue (changed from #FFFFFF — see Decisions Log) |
| Work | #DAA520 | Goldenrod |
| Tasks | #708090 | Slate gray |
| Identity | #9370DB | Medium purple |
| Hobbies | #B22222 | Firebrick |
| Travel | #FFA500 | Orange |
| Weather | #00BFFF | Deep sky blue |

---

## Component Specifications

### CleanToonFlower3D (Negative Valence)

**Material:** meshToonMaterial with 4-step gradient (getToonGradient)
**Geometry:** ExtrudeGeometry petals, cylinder stem, extruded leaves
**Color encoding:** Emotions → petal colors, Associations → stem/leaf colors
**Supports:** opacity prop (for fading), onClick (for inspection)
**Defaults:** petalCount 8, petalRows 2, petalLength 1.2, petalWidth 0.6

### CleanToonSprout3D (Neutral Valence)

**Material:** meshToonMaterial with gradient
**Geometry:** Cylinder stem, sphere cotyledons, sphere bud with stripes
**Color encoding:** Emotions → bud/stripe colors, Associations → stem/cotyledon colors
**Supports:** opacity, onClick

### FallenBloom3D (Positive Valence)

**Material:** meshToonMaterial with decay-specific gradient (getDecayToonGradient)
**Geometry:** BufferGeometry parametric grid petals (12x16 vertices), half-cylinder stem, half-leaf
**Layout:** Card-deck petal arrangement (fanStep=0.18 rad, offsetPerPetal=0.04, yGap=0.005)
**Visual effects:** All driven by fixed decayAmount=0.55:
  - Curl: edges curl upward (max 0.30)
  - Fray: edge notches for organic broken-petal look
  - Vertex darkening: brown tones at petal edges/tips
  - Decay toon gradient: darker 4-band gradient
**Scale:** 1.0–3.6, the primary valence signal (bigger = more intense positive emotion)

### AnimatedToonFlower3D (Growth Animation — test scene only)

**Status:** Exists in test scene (`?test=environment`), NOT yet integrated into main App.tsx
**Phases (overlapping):** Stem 0–55%, Leaves 20–55%, Bloom 35–100%
**Speed:** 2.7x multiplier on 2.0s base = ~0.74s total
**See:** `docs/inverse-garden-animation-brief.md` for full spec

---

## Spatial Layout

**Algorithm:** Spiral + scatter positioning (calculated once at load time)

| Parameter | Value |
|-----------|-------|
| Garden radius | 12 units (reduced from 25 to fit ExcavatedBed) |
| Spiral rotations | 3.5 |
| Day scatter radius | ±2 units |
| Entry scatter radius | ±1.5 units |
| Min entry spacing | 0.8 units |
| Min stem distance (global) | 2.0 units |
| Clamping | Rectangular, to PLANT_BOUNDS (34×28) |

**Design:** Center = history, edges = recent. Temporal structure is subtle — rewards observation but doesn't look artificial.

**Seeded PRNG:** mulberry32 from timestamps. Same data always produces same layout.

---

## Garden Level & Plant Fading

### Garden Level

Cumulative emotional state at any point in the timeline.

- Negative entries add (toward lush/negative)
- Positive entries subtract (toward barren/positive)
- Exponential decay toward zero (half-life: 7 days)
- **Controls plant fading rates ONLY** — does NOT control atmosphere

### Fading System

**Method:** Opacity-only (saturation fading was removed — see Decisions Log)

- Base lifespan: 14 days
- Accelerating fade curve (exponent 2.0 — slow start, fast end)
- Intensity modifier: higher |valence| = plant fades slower (+50% lifespan at max)
- Garden level modifier: matching plants fade slower (±50% rate)
  - Negative garden level → flowers fade slower
  - Positive garden level → FallenBlooms fade slower
- At opacity 0: plant not rendered

### What Fading Does NOT Do

- No desaturation (removed — conflicted with Content emotion grey)
- No sinking into ground (planned but not yet implemented)

---

## Daily Mood & Atmosphere

### Two Independent Control Axes

**Time of day** (from entry timestamps) controls:
- Sun position (E-W arc, 6am rise → 6pm set)
- Sun intensity and color
- Sky gradient colors
- Shadow direction

**Daily mood valence** (from Daily Mood entries) controls:
- Cloud coverage and density
- Floor emissive glow color (outside excavated bed)
- Fog density and color

These combine independently. Negative mood + sunset = clear sky with sunset colors. Positive mood + noon = gloomy overcast.

### Mood Valence Calculation

1. Primary: Daily Mood entry for that calendar day (applied to WHOLE day, not gated by log time)
2. Fallback: Average of all Momentary Emotion entries on that day (also whole day)
3. If no entries: neutral (0)

Smooth transitions via SmoothedMoodBridge (~1s exponential interpolation at day boundaries).

### Current Atmosphere Components

| Component | File | Status |
|-----------|------|--------|
| ProceduralSky | environment/ProceduralSky.tsx | Working — time-responsive gradient |
| TheatricalLighting | environment/TheatricalLighting.tsx | Working — sun arc with shadows |
| ToonClouds | environment/ToonClouds.tsx | Working — mood-responsive Ghibli-style |
| SunMesh | environment/SunMesh.tsx | Working — visible sun orb |
| AtmosphericFog | In SpecimenVitrine.tsx | Working but nearly invisible at current density |
| PostProcessing | environment/PostProcessing.tsx | Bloom DISABLED, vignette + saturation active |
| God Rays | REMOVED | Never functional, removed Feb 19 |

### Weather Inversion Table

| Daily Valence | Weather | Clouds | Shadows | Floor Glow |
|---------------|---------|--------|---------|------------|
| Negative | Clear, beautiful | Few/none, wispy | Sharp, directional | Warm yellow-orange (#ff9922) |
| Neutral | Moderate | Moderate | Medium | Warm amber (#996633) |
| Positive | Gloomy, overcast | Dense, grey | Soft, diffuse | Dark blue (#334466) |

### Open Design Work

The atmosphere system is functional but needs significant design work. The current implementation doesn't strongly communicate the mood inversion to viewers. This is the core challenge of the remaining sprint. See `docs/FINAL-SPRINT.md` for the design session plan and dependency sequence.

---

## Environment

### ExcavatedBed (Ground System)

**File:** `components/ExcavatedBed.tsx`

Two zones:
1. **SoilSurface (inside bed):** Static brown with procedural noise texture, no mood response. meshLambertMaterial with vertex colors.
2. **FloorVoid (outside bed):** Emissive glow responding to mood (see Weather Inversion Table). Large organic ellipse (80×70 units) with hole for garden.
3. **BedWall:** Organic wobbled edge, dark earth (#3d2817), extrudes 1.2 units up.

Organic edges use seeded wobble (seed=42).

### LEDWall

**File:** `environment/LEDWall.tsx`

- Position: [0, 10, -30]
- Dimensions: 50×18 units (58×43 brick grid)
- Architecture: 2 InstancedMesh instances (lit + unlit bricks) — optimized from 2,494 individual meshes
- Displays: Valence classification text of most recent entry
- Mood-responsive colors: saturated amber (#ff8844) for negative, blue (#6699cc) for positive
- Time-responsive: unlit bricks glow warmly at twilight
- **Known issue:** Text transitions are "all at once" (side effect of InstancedMesh). Needs per-instance color attribute for individual brick transitions.

### SpecimenVitrine (Environment Orchestrator)

**File:** `environment/SpecimenVitrine.tsx`

Renders: AtmosphericFog, ProceduralSky, ToonClouds, SunMesh, ExcavatedBed, LEDWall, TheatricalLighting

### Camera

| Parameter | Value |
|-----------|-------|
| Min distance | 10 |
| Max distance | 40 |
| Min polar angle | 0.15π |
| Max polar angle | 0.45π |
| Min azimuth | -π/3 |
| Max azimuth | π/3 |

---

## Data Pipeline

### CSV Structure

**File:** `StateOfMind-2025-10-16-2026-01-14.csv`

| Field | Type | Description |
|-------|------|-------------|
| Start | DateTime | Timestamp with timezone (e.g., `2026-01-09 15:34:06 -0500`) |
| End | DateTime | Same as Start |
| Kind | String | `Momentary Emotion` or `Daily Mood` |
| Labels | Pipe-separated | Emotions (` \| ` separator with spaces) |
| Associations | Pipe-separated | Context tags |
| Valence | Float | -1 to 1 |
| Valence Classification | String | Apple's classification |

**Parsing notes:**
- Labels = Emotions (CSV column name)
- Labels and Associations may be empty strings
- Trailing comma after Valence Classification (export artifact)
- ~308 total entries across 89 unique dates

### Pipeline Flow

```
CSV → csvParser.ts → MoodEntry[]
  → percentileCalculator.ts → EntryWithPercentile[] (Daily Mood excluded from ranking)
  → dnaMapper.ts → PlantDNA (FlowerDNA | SproutDNA | FallenBloomDNA)
    (entryToDNA cache: computed once per entry, reused)
  → positionCalculator.ts → Map<entryId, [x, y, z]> (Daily Mood excluded)
  → App.tsx: Only Momentary Emotion entries spawn plants
  → App.tsx: All entries feed garden level + mood valence
```

### Daily Mood Filtering (Critical)

Daily Mood entries are filtered OUT of:
1. Percentile ranking (percentileCalculator.ts)
2. Position calculation (positionCalculator.ts)
3. Plant creation (App.tsx createdEntries filter)

Daily Mood entries ARE used for:
- Atmosphere (moodValence calculation)
- Garden level (contributes to cumulative emotional state)

---

## Performance & Stability

### Optimizations Applied (Feb 19, 2026)

| Optimization | Before | After |
|-------------|--------|-------|
| LEDWall | 2,494 individual meshes | 2 InstancedMesh instances |
| Draw calls | ~3,000–3,500 | ~500–1,000 |
| DNA computation | Recreated every 50ms tick | Cached per entry (Map) |
| Time dependencies | All recompute every tick | Quantized: minute/day/10s |
| Playback interval | Cleared/recreated every tick | Stable setInterval with functional updates |
| GPU objects | Leaked on every prop change | Persistent refs, in-place mutation |
| Memory | Crashed Safari after ~2min | Stable 27–72MB sawtooth (healthy GC) |

### Key Patterns

- **Never use `args` with dynamic values** in R3F — this destroys and recreates the Three.js object. Use refs and mutate in-place.
- **Quantize time dependencies** — Not everything needs to recompute every 50ms. hour→minute, mood→day, fading→10s.
- **Dispose geometries on unmount** — useEffect cleanup for ExtrudeGeometry, BufferGeometry, SphereGeometry.
- **Cache immutable computations** — DNA, positions, percentiles calculated once and stored.

---

## Decisions Log

Key decisions made during development, with reasoning. Preserved so future sessions don't re-explore rejected paths.

### Content Emotion Color: #9CA3AF → #6B7280
**Why:** Original grey (#9CA3AF, RGB 156,163,175) appeared white under toon material highlight band + key light. Darkened to Tailwind gray-500 (#6B7280, RGB 107,114,128). Under toon highlight, brightest face ≈ RGB(88,93,105) — clearly reads as grey.

### Community Association: #FFFFFF → #C8D6E5
**Why:** White was invisible on white petals/stems. Light steel blue is visible.

### Fallback Emotion Color: #FFFFFF → #6B7280
**Why:** Same as Content — white invisible under toon lighting. Grey matches Content (the most common "empty" emotion scenario).

### Saturation Fading: Removed
**Why:** Desaturation turned all aging plants grey, conflicting with Content emotion (also grey). Impossible to tell if a plant was Content-colored or just old. Opacity-only fading preserves color identity throughout lifespan.

### FallenBloom: Scale as Primary Valence Signal
**Why:** Multiple progression approaches were tried and rejected:
- Curl-proportional spread → petal clipping
- Fragmentation → conflicts with petal count encoding
- Surface detail progression → narrow usable range (0.5–0.7)
- Discrete stages → continuous data doesn't map
- Arrangement chaos → random, not meaningful

Scale mirrors how flowers work (bigger = more intense) and is immediately readable. Fixed decayAmount (0.55) provides the "fallen" aesthetic for all decays uniformly.

### God Rays: Removed
**Why:** Never functional — broken forwardRef chain + mood threshold bug meant sunMesh ref was always null. Removed entirely (dead code). No visual loss.

### Bloom: Disabled (Diagnostic)
**Why:** Disabled during Phase 5 to diagnose white plant visibility. Issue was color fallback, not bloom. Bloom remains commented out. Considered unlikely to return as a main feature — tends to be distracting and GPU-intensive. May have a targeted use-case.

### Clean Toon: Chosen Rendering Style
**Why:** Four styles were compared: Normal (wobble/emissive/sparkles), Toon (lost data encoding), Clean (standard materials), Clean Toon (toon + full encoding). Clean Toon was chosen as best balance of visual cohesion and data encoding preservation.

### Daily Mood: Atmosphere Only, Not Plants
**Why:** Discovered via click-to-identify that ~66 Daily Mood entries were incorrectly spawning as plants. Per design intent, Daily Mood sets the day's weather/atmosphere. Only Momentary Emotion entries spawn plants. Critical accuracy fix.

---

## File Structure

```
garden/
├── src/
│   ├── components/
│   │   ├── App.tsx                    # Main scene, data pipeline, timeline, dev panel
│   │   ├── TimelineControls.tsx       # Playback UI
│   │   ├── CleanToonFlower3D.tsx      # Flower (negative valence)
│   │   ├── CleanToonSprout3D.tsx      # Sprout (neutral)
│   │   ├── FallenBloom3D.tsx          # Decay (positive valence)
│   │   ├── AnimatedToonFlower3D.tsx   # Growth animation (test scene only)
│   │   ├── ExcavatedBed.tsx           # Ground system
│   │   ├── FallenBloomGenerator.tsx   # Decay test scene
│   │   ├── VitrineTest.tsx            # Environment test scene
│   │   └── environment/
│   │       ├── SpecimenVitrine.tsx    # Environment orchestrator
│   │       ├── ProceduralSky.tsx      # Time-based sky
│   │       ├── TheatricalLighting.tsx # Time-based lighting + shadows
│   │       ├── ToonClouds.tsx         # Mood-responsive clouds
│   │       ├── LEDWall.tsx            # Valence text (InstancedMesh)
│   │       ├── SunMesh.tsx            # Visible sun orb
│   │       └── PostProcessing.tsx     # Vignette, saturation (bloom disabled)
│   ├── utils/
│   │   ├── csvParser.ts              # CSV → MoodEntry parsing
│   │   ├── dnaMapper.ts              # Entry → DNA (with cache)
│   │   ├── percentileCalculator.ts   # Percentile-based scale ranking
│   │   ├── positionCalculator.ts     # Spiral+scatter layout
│   │   ├── gardenLevel.ts            # Cumulative emotional state
│   │   ├── plantFading.ts            # Opacity fade system
│   │   └── toonGradient.ts           # Shared toon + decay gradients
│   ├── config/
│   │   └── environmentConfig.ts      # Ground bounds, camera limits, scene config
│   └── types.ts                      # FlowerDNA, SproutDNA, FallenBloomDNA, MoodEntry
└── public/
    └── mood-data.csv                 # Data copy for browser
```

### Test Modes

| URL Parameter | Scene | Purpose |
|---------------|-------|---------|
| (none) | Main garden | Full experience with data pipeline |
| ?test=vitrine | VitrineTest | Environment testing with controls |
| ?test=environment | EnvironmentTest | Legacy — has animation test panel |
| ?test=fallenbloom | FallenBloomGenerator | Decay parameter tuning |
| /playground | AtmospherePlayground | Atmosphere parameter testing |
| ?dev=true | (adds dev panel to main) | Runtime parameter overrides |

---

## Dev Commands

```bash
cd garden && npm install    # Install dependencies
cd garden && npm run dev    # Start dev server (localhost:5173)
cd garden && npm run build  # Production build
cd garden && npx tsc --noEmit  # Type check
```

---

## Related Documents

| Document | Location | Purpose |
|----------|----------|---------|
| FINAL-SPRINT.md | docs/ | Active sprint tasks (working document — update every session) |
| inverse-garden-animation-brief.md | docs/ | Build spec for growth animations |
| inverse-garden-moebius-pass-spec.md | docs/ | Build spec for post-processing shader |
| implementation-plan-v2.md | docs/ | Context: how the sprint was planned |
| TASKS.md | root | Archived session log (historical reference) |

---

*This document is the canonical reference for Inverse Garden. It contains all locked specs, current system state, and key decisions. Update only when fundamental design decisions change.*
