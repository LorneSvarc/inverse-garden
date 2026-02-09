# Inverse Garden: Task Tracker

**Canonical Spec:** `inverse-garden-gdd-v3.3.md` (always defer to GDD for details)
**GitHub Repo:** https://github.com/LorneSvarc/inverse-garden

---

## Phase 1: Data Pipeline & Basic Spawning ✅ COMPLETE

- [x] Parse CSV data into entry objects
  - File: `StateOfMind-2025-10-16-2026-01-14.csv`
  - Labels field = Emotions
  - Pipe separator has spaces: ` | `
  - Handle empty Labels/Associations as empty arrays
  - Handle trailing comma in CSV rows
  - **Implementation:** `garden/src/utils/csvParser.ts`
- [x] Map entries to DNA objects (FlowerDNA, SproutDNA, DecayDNA)
  - Use valence classification for component type selection
  - Apply emotion colors to petals/buds/layers
  - Apply association colors to stems/leaves/cracks
  - Use FLOWER_DEFAULTS, SPROUT_DEFAULTS, DECAY_DEFAULTS for non-data parameters
  - **Implementation:** `garden/src/utils/dnaMapper.ts`
  - **Note:** Added fallback colors for unknown emotions (e.g., "Surpirsed" typo, "Peaceful")
- [x] Spawn correct component type based on valence classification
  - Very Unpleasant, Unpleasant, Slightly Unpleasant → Flower
  - Neutral → Sprout
  - Slightly Pleasant, Pleasant, Very Pleasant → Decay
- [x] Display diverse sample to validate encoding
  - Shows flowers with varied primary associations (not just Self Care)
  - Includes sprouts and decays for all plant type validation
  - Collapsible info panel shows emotions, associations, valence for each plant
- [x] Basic orbit camera controls (OrbitControls from drei)

**Completed:** 2025-01-19
**Commit:** `a0d5ee7` - Initial commit: Phase 1 complete

### Implementation Notes

**Project Structure:**
```
garden/
├── src/
│   ├── components/
│   │   ├── Flower3D.tsx    # Adapted from reference, removed individual ground/lights
│   │   ├── Sprout3D.tsx
│   │   └── Decay3D.tsx
│   ├── utils/
│   │   ├── csvParser.ts    # Parses Apple Health CSV format
│   │   └── dnaMapper.ts    # Entry → DNA conversion with color lookups
│   ├── types.ts            # FlowerDNA, SproutDNA, DecayDNA, MoodEntry, PlantDNA
│   ├── App.tsx             # Main scene with validation UI
│   └── App.css
└── public/
    └── mood-data.csv       # Copy of mood data for browser access
```

**Color Encoding (from GDD):**
- Emotions → Petal colors (flowers), bud colors (sprouts), layer colors (decays)
- Associations → Stem/leaf colors (flowers/sprouts), crack colors (decays)
- Fallback: White (#FFFFFF) for missing emotions, Gold (#FFD700) for missing associations

**Scale Calculation (current - absolute value method):**
```
scale = minScale + |valence| × (maxScale - minScale)
```
- Flowers: 0.6 - 1.4
- Sprouts: 0.4 - 0.8
- Decays: 0.8 - 1.8

---

## Phase 1.5: Scale Calibration ✅ COMPLETE

- [x] Implement percentile-based scale calculation
  - Calculate percentiles separately for flowers and decays
  - Sprouts get fixed percentile (50)
  - Store percentile with each entry at load time
  - **Implementation:** `garden/src/utils/percentileCalculator.ts`
- [x] Update scale ranges (widened for visual distinction)
  - Flowers: 0.4 - 1.8
  - Sprouts: 0.8 - 1.0
  - Decays: 0.4 - 1.8
- [x] Fixed Safari timestamp parsing (ISO 8601 conversion)
- [ ] **REVISIT:** Flower scale tuning - low percentile flowers (0-10%) still look similar; may need further range adjustment or non-linear curve
- [ ] **REVISIT:** Decay scale validation - need to test with diverse percentile samples (current sample only shows 0-1%)

**Completed:** 2025-01-19

### Implementation Notes
- Percentile system ranks entries within each plant type by |valence|
- Ensures full size distribution regardless of how raw valence values cluster
- Scale ranges widened from original GDD values to make differences more visible

---

## Phase 2A: Timeline & Plant Visibility ✅ COMPLETE

- [x] Timeline UI control
  - Horizontal slider spanning full data range
  - Play/pause button for auto-advance
  - Speed control (0.5x, 1x, 2x, 5x)
  - Current date display with plant count
  - **Implementation:** `garden/src/components/TimelineControls.tsx`
- [x] Plants appear based on time position
  - Plants visible when `currentTime >= entry.timestamp`
  - All entries loaded (no longer using sample selection)
  - Entries sorted by timestamp for consistent ordering
- [x] Playback system
  - Configurable playback speed (days per second)
  - Smooth 50ms update interval
  - Auto-stop at end of timeline

**Completed:** 2025-01-21

### Implementation Notes
- Removed `selectDiverseSample()` - now loads ALL entries for timeline
- Added `useMemo` for visible entries filtering (performance)
- Added `useCallback` for handler functions
- Info panel now shows most recent 10 entries (newest first)

---

## Phase 2.5: Spatial Layout Foundation ✅ COMPLETE

**Why now:** Plants were recalculating positions based on visible count, causing a "scrolling" effect. Stable positions needed before implementing fading mechanics.

**Algorithm: Subtle Temporal Spiral with Scatter**

Three-level positioning system:
1. **Spiral base:** Days map to positions along a 3.5-rotation spiral (center → edge over time)
2. **Day scatter:** Each day offset randomly from spiral (±8 units) to break up pattern
3. **Entry scatter:** Same-day entries cluster tightly (±1.5 units) around day position

### Implementation

- [x] Create `garden/src/utils/positionCalculator.ts`
  - `calculatePositions(entries): Map<entryId, [x, y, z]>`
  - Seeded PRNG (mulberry32) from timestamps for reproducibility
  - Calculated once at load time, stored in state
- [x] Position entries on XZ plane (Y = 0)
- [x] Store positions in Map, lookup by entry ID
- [x] Update App.tsx to use pre-calculated positions
- [x] Ground size matches garden radius (25 units + margin)
- [x] Camera repositioned for garden overview (0, 30, 40)

**Completed:** 2025-01-21

### Parameters (Tunable in positionCalculator.ts)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Garden radius | 25 units | Overall plantable area |
| Spiral rotations | 3.5 | How many times spiral wraps around |
| Day scatter radius | ±4 units | How far a day drifts from spiral position (reduced from 8 to fix center-clustering) |
| Entry scatter radius | ±1.5 units | How far entries spread within a day |
| Minimum entry spacing | 0.8 units | Prevent direct overlap within clusters |
| Minimum stem distance | 2.0 units | Global collision detection - prevents stem overlap |

### Design Rationale

**Why spiral?** Creates subtle temporal structure without causing "empty regions" as time passes.

**Why center-out?** Garden "grows outward" over time - core is history, edges are recent.

**Why heavy scatter?** Prevents artificial/grid-like appearance. Temporal structure is a secret that rewards observation.

---

## Phase 2B: Garden Level & Fading

### Detailed Design (Agreed 2025-01-23)

**Fading System Overview:**
Plants fade over time through two channels: saturation and opacity.
- **Saturation** fades faster than opacity: vibrant → grey → ghost → gone
- **No grace period**: Plants begin fading immediately upon creation, but slowly at first
- **Accelerating curve**: Fading speeds up over time (not linear)
- **At 0 opacity**: Plant disappears (not rendered)
- **Timeline scrubbing**: Shows proper fade/unfade states based on time position

**Garden Level:**
- Cumulative emotional state that affects environment and fade rates
- Negative entries (flowers) add to garden level
- Positive entries (decays) subtract from garden level
- Decays toward zero over time (exponential decay)
- Negative garden level = "lush" (flowers thrive)
- Positive garden level = "barren" (decays thrive)

**Two Fade Modifiers:**

1. **Intensity Modifier** (per-plant, based on |valence|):
   - Higher |valence| = plant fades slower (lasts longer)
   - A -0.9 flower fades slower than a -0.2 flower
   - A +0.9 decay fades slower than a +0.2 decay
   - Sprouts use the same logic (|valence| = 0, so baseline fade)

2. **Garden Level Modifier** (environmental, affects all plants):
   - Negative garden level → ALL flowers fade slower
   - Positive garden level → ALL decays fade slower
   - "Matching" means: flowers match negative periods, decays match positive periods
   - Plants only fade down, never get brighter

### Implementation Checklist ✅ COMPLETE

- [x] Garden level calculation
  - Negative valence adds to garden level (toward lush)
  - Positive valence subtracts from garden level (toward barren)
  - Exponential decay toward zero (half-life: 7 days)
  - **Implementation:** `garden/src/utils/gardenLevel.ts`
- [x] Plant fading over time (opacity + desaturation)
  - Base lifespan: 14 days (tunable)
  - Saturation fades faster: 1.0 → 0.0 before opacity reaches 0
  - Opacity: 1.0 → 0.0 (accelerating curve, not linear)
  - **Implementation:** `garden/src/utils/plantFading.ts`
- [x] Intensity modifier (per-plant)
  - Higher |valence| = slower fade rate
  - Applied per plant based on its own intensity
- [x] Garden level modifier (environmental)
  - Negative garden level → flowers fade slower
  - Positive garden level → decays fade slower
  - Modifier strength: ±50% fade rate adjustment
- [x] Modify plant components to accept opacity/saturation props
  - Flower3D, Sprout3D, Decay3D all need updates
  - Use transparent materials with opacity
  - Apply saturation adjustment to colors
- [x] Add garden level dev UI display
  - Show current garden level value
  - Useful for tuning parameters
- [x] Define and tune parameters:
  - Base plant lifespan (start: 14 days)
  - Garden level half-life (start: 7 days)
  - Intensity modifier strength
  - Garden level modifier strength (start: ±50%)
  - Saturation fade curve (faster than opacity)
  - Opacity fade curve (accelerating)

**Completed:** 2025-01-23

**Success criteria:** Scrubbing through time shows garden evolving with persistence mechanics. Plants fade from vibrant to grey to ghost to gone. Garden level visibly affects which plant types persist.

### Parameters to Fine-Tune Later
- Base lifespan (14 days may be too short/long for the data range)
- Garden level half-life (7 days - affects how quickly environment responds)
- Fade curve exponent (2.0 - affects how fast acceleration feels)
- Saturation fade speed (1.5x - affects grey-out timing relative to transparency)
- Garden level modifier strength (±50% - how much environment affects persistence)
- Intensity modifier strength (+50% - how much valence affects individual plant lifespan)

---

## Phase 3: Spatial Layout ⏸️ DEFERRED

**Status:** Skipping for now - Phase 2.5 already established spiral+scatter positioning. Full spatial layout refinement deferred until other features are complete.

- [ ] Determine garden plot size
- [ ] Position plants with natural distribution
- [ ] Depth layering (foreground/midground/background)
- [ ] Prevent excessive overlap

**Success criteria:** Garden looks like a garden, not a pile.

**Why deferred:** Spatial layout will be a significant undertaking. Better to have lighting, atmosphere, and other visual systems working first, then refine positioning with full context.

---

## Phase 4: Polish & Atmosphere 🔄 IN PROGRESS

### Phase 4A: Atmosphere Playground

**Spec Document:** `inverse-garden-atmosphere-spec.md`

Before implementing the full lighting system, we need to explore and validate the visual approach through a playground at `/playground` route.

**Two-Layer Lighting System:**
1. **Layer 1: Time-Based (The Sun)** — Position/intensity from entry timestamps
2. **Layer 2: Emotional (The Grade)** — Post-processing color/exposure from garden level

- [ ] Create `/playground` route with atmosphere controls
- [ ] Implement sun positioning based on time of day
- [ ] Implement color grading (temperature shift) based on garden level
- [ ] Implement exposure modifier based on garden level
- [ ] Add fog system (density, color, distance)
- [ ] Add bloom post-processing
- [ ] Add flower emissive controls
- [ ] Add preset buttons (Negative Noon, Positive Noon, Negative Night, Positive Night)
- [ ] Test and validate parameters

**Implementation:** `garden/src/components/AtmospherePlayground.tsx`

### Phase 4B: Full Atmosphere Integration (After Playground Validation)

- [ ] Daily Mood lighting system
  - Negative Daily Mood → warm, bright, golden hour
  - Positive Daily Mood → cool, overcast, muted
- [ ] Ambient vegetation (grass, ground cover) — decorative only
- [ ] Plant inspection UI
  - Show: timestamp, emotions, associations, valence
- [ ] Plant parameter variance
  - Seeded randomness from entry timestamp
  - ±20-30% variation from defaults
- [ ] Particle effects (optional)

**Success criteria:** Ready for audience viewing.

---

## Reference Paths

```
/Mood Garden Build/
├── inverse-garden-gdd-v3.3.md           # THE SPEC - read this first
├── TASKS.md                              # This file
├── inverse-garden-emotion-colors.html    # Color reference
├── inverse-garden-association-colors.html
├── StateOfMind-2025-10-16-2026-01-14.csv # The data (~308 entries)
├── reference/FlowerGen/                  # Source components (copied to garden)
│   ├── components/
│   │   ├── Flower3D.tsx
│   │   ├── Sprout3D.tsx
│   │   └── Decay3D.tsx
│   └── types.ts
└── garden/                               # The React Three Fiber app
    ├── src/                              # Source code
    └── public/mood-data.csv              # Data copy for browser
```

---

## Key Reminders

1. **Always read the GDD first** for any phase — it has full specs and code examples
2. **Explain technical decisions** as you make them (creator is learning)
3. **Ask when uncertain** about visual/design intent
4. **One plant per entry** (clustering deferred)
5. **Labels = Emotions** in the CSV
6. **Percentile scaling** (Phase 1.5) ensures visual variety despite clustered data

---

## Dev Commands

```bash
# Start development server
cd garden && npm run dev

# Build for production
cd garden && npm run build

# Type check
cd garden && npx tsc --noEmit
```

---

## Session Log

### 2025-01-19 - Phase 1 Complete
- Set up Vite + React + TypeScript project with React Three Fiber
- Copied and adapted plant components from reference (removed individual ground planes/lights)
- Built CSV parser for Apple Health State of Mind format
- Built DNA mapper with complete emotion/association color tables
- Created validation view with collapsible panel showing diverse plant samples
- Pushed to GitHub: https://github.com/LorneSvarc/inverse-garden

### 2025-01-21 - Phase 2A Complete
- Added timeline slider with full date range scrubbing
- Play/pause functionality with configurable speed (0.5x to 5x)
- Plants now appear based on timeline position
- Loads all ~308 entries instead of sample selection
- Info panel shows most recent entries during playback

### 2025-01-21 - Phase 2.5 Complete
- Created positionCalculator.ts with spiral + scatter algorithm
- Seeded PRNG (mulberry32) ensures reproducible positions
- Plants now have stable positions that don't change as timeline scrubs
- Ground sized to match 25-unit garden radius
- Camera repositioned for better garden overview

### 2025-01-23 - Phase 2.5 Refinements
- **Test Mode:** Added `?test=true` URL parameter for calibration scene
  - Shows 5 flowers at different scales (0.4 to 1.8)
  - Shows 3-flower cluster for spacing visualization
  - Helps tune sizes and spacing before algorithm adjustments
- **Flower Rendering Fixes:**
  - Fixed stem positioning: base now at ground level (Y=0), not buried
  - Added random Y-rotation per flower (seeded from timestamp) - breaks "clone army" look
  - Increased and randomized stem bend (0.1-0.5) for organic variety
  - Reduced flower size: petalLength 2.5→1.2, petalWidth 1.2→0.6 (roughly halved footprint)
- **Ground Plane:** Added DoubleSide rendering to fix disappearing at camera angles
- **Global Collision Detection:** Added to positionCalculator.ts
  - `minStemDistance: 2.0` prevents stem overlap across all plants
  - Nudges colliding positions outward until clear
- **Coordinate System:** Unified Y=0 as ground level across all plant types
  - Updated Sprout3D and Decay3D to match new ground level

### 2025-01-23 - Phase 2B Complete
- **Garden Level System:** `garden/src/utils/gardenLevel.ts`
  - Calculates cumulative emotional state at any point in time
  - Negative entries add (toward lush), positive entries subtract (toward barren)
  - Exponential decay toward zero (half-life: 7 days)
  - Returns fade rate modifier per plant type
- **Plant Fading System:** `garden/src/utils/plantFading.ts`
  - Two-channel fading: saturation (faster) and opacity (slower)
  - Accelerating fade curve (slow start, fast end)
  - Intensity modifier: higher |valence| = longer lifespan
  - Garden level modifier: matching environment = slower fade
  - Color saturation adjustment utility function
- **Plant Component Updates:**
  - Flower3D, Sprout3D, Decay3D now accept opacity/saturation props
  - All materials use transparent mode with proper opacity
  - Colors adjusted for saturation in real-time
- **App Integration:**
  - Garden level calculated at current timeline position
  - Fade state calculated for all plants
  - Fully faded plants (opacity = 0) are not rendered
  - Garden level dev UI in top-right corner
- **Parameters (Tunable):**
  - Base lifespan: 14 days
  - Garden level half-life: 7 days
  - Intensity modifier: +50% lifespan at max |valence|
  - Garden level modifier: ±50% fade rate
  - Saturation fades 1.5x faster than opacity
  - Fade curve exponent: 2.0 (quadratic acceleration)
- **Bug Fix:** Corrected garden level sign - negative entries now correctly push garden level negative (lush)

### 2025-01-23 - Phase 4A: Atmosphere Playground
- **New Route:** `/playground` - Visual playground for testing atmosphere parameters
- **Two-Layer Lighting System:**
  - Layer 1 (Sun): Position/intensity calculated from time of day (6am sunrise → 6pm sunset arc)
  - Layer 2 (Emotional Grade): Color temperature, exposure modifier based on garden level
- **Dynamic Lighting:**
  - DirectionalLight as sun with position based on hour
  - HemisphereLight for sky/ground ambient fill
  - AmbientLight for base fill
  - All lights respond to exposure modifier
- **Fog System:**
  - Configurable near/far distances
  - Warmth control (cool blue-grey ↔ warm amber-brown)
  - Scene background matches fog color
- **Post-Processing:**
  - Bloom with intensity and threshold controls
  - Vignette with intensity control
  - Tone mapping exposure via gl settings
- **Control Panel:**
  - Collapsible UI with all atmosphere parameters
  - Sun controls: time override, intensity, warmth
  - Emotional atmosphere: garden level override, color temperature, exposure
  - Fog controls: enable, near/far distance, warmth
  - Bloom/Vignette controls
  - Ambient light controls
  - Flower emissive boost (placeholder for future implementation)
- **Presets:**
  - "Negative Noon" - bright + warm + vivid
  - "Positive Noon" - bright + cool + muted
  - "Negative Night" - dark + warm + glowing
  - "Positive Night" - dark + cool + empty
  - "Reset" - return to defaults
- **Implementation:** `garden/src/components/AtmospherePlayground.tsx` + CSS
- **Dependencies Added:** `@react-three/postprocessing`

### 2025-01-26 - Rendering Style Exploration & Integration

**Rendering Mode Exploration in Playground:**
- Added 4 rendering modes to compare visual styles:
  - **Normal:** Original components with MeshWobbleMaterial, emissive, sparkles
  - **Toon:** Cel-shaded with meshToonMaterial (lost data encoding on sprouts/decays)
  - **Clean:** Simplified meshStandardMaterial, no effects, WITH full data encoding
  - **Clean Toon:** Cel-shaded + full data encoding (best of both worlds)

**Clean Toon Components Created:**
- `CleanToonFlower3D.tsx` - Cel-shaded flower, subtle petal animation
- `CleanToonSprout3D.tsx` - Cel-shaded sprout WITH restored bud stripes (secondary/tertiary emotion encoding)
- `CleanToonDecay3D.tsx` - Cel-shaded decay WITH restored cracks (association color encoding)
- `utils/toonGradient.ts` - Shared 4-step gradient texture for toon materials

**Decision: Clean Toon chosen as main scene style**
- Toon shading provides softer shadows and cohesive visual language
- Data encoding preserved (stripes on sprouts, cracks on decays)
- No distracting visual noise (wobble, sparkles, emissive glow)

**Main Scene Updated:**
- `App.tsx` now imports and uses CleanToon* components instead of original Flower3D/Sprout3D/Decay3D
- Original components preserved as fallbacks

**Preserved Files (not modified):**
- `Flower3D.tsx`, `Sprout3D.tsx`, `Decay3D.tsx` - original components
- `CleanFlower3D.tsx`, `CleanSprout3D.tsx`, `CleanDecay3D.tsx` - meshStandardMaterial versions

### 2025-01-26 - Decay Visual Design Experiment (In Progress)

**Goal:** Make decays feel like "barren patches" — places where something should have grown but couldn't — rather than abstract graphic discs.

**Experiment: Barren Patch Mode**
Adding toggle in AtmospherePlayground to compare current decay style with experimental "barren patch" treatment:

1. Position slightly below ground plane (y = -0.05) — slight depression
2. Desaturate layer colors by ~50% — "stained/depleted earth" not vibrant rings
3. Amplify edgeWobble effect — visible irregularity in boundary
4. Amplify crackWobble effect — organic variation in cracks
5. Make cracks cast shadows — subtle grooves catching light

Data encoding preserved: 3 emotion colors (layers), 3 association colors (cracks), size from valence

### 2025-02-02 - Lighting & Shadows Investigation (REVISIT NEEDED)

**Problem:** Attempted to add controllable shadow parameters to EnvironmentTest.tsx. Shadows work but controls are limited.

**What Works:**
- Shadows Enabled checkbox - toggles shadow casting
- Sun Intensity slider - changes scene brightness
- Time of Day slider - moves sun position and shadow direction

**What Doesn't Work (and why):**
- **Shadow Softness slider** - `shadow.radius` only works with VSMShadowMap, not PCFSoftShadowMap. VSM has visual artifacts (light bleeding), so we reverted to PCFSoftShadowMap.
- **Shadow darkness** - Shadow maps are binary. Ambient light raises overall brightness but doesn't change shadow contrast.
- **Shadow length at dawn/dusk** - Physically accurate but extreme. Could clamp minimum sun elevation.

**Material Compatibility Issue:**
- `meshToonMaterial` uses discrete banding that interferes with smooth shadow appearance
- DirtSurface changed to `meshLambertMaterial` to receive shadows properly
- The "harsh shadows" on the dirt are actually working shadow maps, not toon banding

**Current State:**
- Canvas uses `THREE.PCFSoftShadowMap` (stable, no artifacts, but no softness control)
- Shadow Softness slider exists but does nothing with current shadow map type
- DirtSurface: meshLambertMaterial with receiveShadow
- RaisedBed: meshToonMaterial, no castShadow/receiveShadow
- Flowers: castShadow on all geometry

**Options to Explore Later:**
1. Baked shadows (static, high quality)
2. Custom shader combining toon shading with controllable shadow overlay
3. Accept toon-style hard shadows as part of aesthetic
4. drei's `softShadows` helper (untested)
5. Clamp sun elevation to prevent extreme shadow lengths

### 2025-02-02 - Flower Growth Animation ✅ COMPLETE

**Spec Document:** `inverse-garden-animation-brief.md`

**Implementation:** `garden/src/components/AnimatedToonFlower3D.tsx`

Created procedural flower growth animation with overlapping phases:

**Phase Timing (overlapping for organic feel):**
- Stem: 0% - 55% of growth progress
- Leaves: 20% - 55% (starts while stem is still growing)
- Bloom: 35% - 100% (starts while leaves are still growing)

**Animation Features:**
- **Stem Growth:** Emerges from below ground, uses easeOutQuad for gradual growth
- **Leaves:** All leaves grow together using the same phase progress
- **Petals:** Staggered radial appearance - each petal starts at a different time, creating a blooming effect
- **Center/Pistil:** Grows linearly with bloom phase

**Test Scene:** `EnvironmentTest.tsx` (`?test=environment` URL param)
- Animation controls panel with Growth Progress slider
- Play/Pause and Reset buttons
- Animation speed control (default 1.7x works best)
- Toggle between animated and static flowers
- Toggle between 3 test flowers and full set

**Key Technical Decisions:**
- Used `growthProgress > threshold` for visibility instead of phase progress to ensure correct timing
- Linear scaling for petals (no easing) provides smooth, visible growth
- Petal stagger: each petal takes 0.5 of bloom phase to fully open, staggered over first 0.5 of bloom phase
- Removed elastic easing which caused instant jumps

### 2025-02-09 - ToonClouds v10: Ghibli-Style Gradient Clouds

**Implementation:** `garden/src/components/environment/ToonClouds.tsx`

**Major Improvements:**
- Replaced simple sphere-puff clouds with Ghibli-style gradient clouds
- Top-to-bottom gradient shading using vertex colors (lit tops, shadowed undersides)
- Custom geometry merging for smooth cloud shapes

**Mood-Responsive Dynamics:**
| Mood State | Color | Opacity | Scale |
|------------|-------|---------|-------|
| Neutral (0) | White/bright | 40% (wispy) | 0.7x (small) |
| Positive (+1) | Gray/heavy | 100% (dense) | 1.2x (large) |

- Coverage: Clouds start appearing at mood -0.2, full coverage at +1
- Density: Wispy transparent at neutral, solid opaque at positive
- Scale: Small clouds at neutral, large puffy clouds at positive
- Color: White tops with light shadows → Gray tops with dark shadows

**Time-of-Day Color Variations:**
- Night (20-6): Silvery blue-gray
- Dawn (6-8): Warm peachy white
- Day (8-17): Bright white to heavy gray
- Dusk (17-20): Warm amber tints

**Camera Controls Added to VitrineTest:**
- Min/Max Distance sliders (default: 20-35)
- Min/Max Polar Angle sliders (default: 0.1π - 0.43π)
- Useful for finding optimal cloud viewing positions

**Cloud Positioning:**
- Clouds placed at y=18 (lowered from 28 for visibility from default camera)
- Z positions: -15 to -40 (behind garden)
- X spread: -38 to +30 for full sky coverage

**Note:** Clouds are functional but still need refinement. Current implementation is a placeholder - future improvements could include:
- Better Ghibli-style puffy shapes
- More natural arrangement
- Improved mood response curves

### 2025-02-09 - Scene Assembly: Unified Main Scene with Environment

**Goal:** Assemble all working pieces from separate test scenes into one unified main scene.

**Architecture Change — App.tsx is the base:**
- Replaced primitive `Lighting()` and `Ground()` components with `SpecimenVitrine` + `PostProcessing` from the vitrine test scene
- App.tsx chosen because it has the irreplaceable data pipeline (CSV → DNA → positions → timeline → fading)
- VitrineTest had the best environment but only hardcoded test plants
- Growth animation (AnimatedToonFlower3D) deferred to follow-up session

**New Components Integrated:**
- `SpecimenVitrine` — composite environment: ProceduralSky, ToonClouds, SunMesh, ExcavatedBed, LEDWall, TheatricalLighting, AtmosphericFog
- `PostProcessing` — bloom, god rays, vignette, saturation (with sunMesh ref for god rays)
- Camera now uses `CAMERA_LIMITS` from environmentConfig (constrained orbit)
- Canvas upgraded: PCFSoftShadowMap, ACES tone mapping, exposure 0.9

**Data → Environment Bridge (two axes):**
1. **Time of day** (`hour` from `currentTime`) → drives sun arc, sky colors, theatrical lighting
2. **Daily mood valence** (`moodValence`) → drives clouds, floor glow, fog, god rays

**Mood Valence Calculation:**
- Primary: Daily Mood entries matched by calendar day (applied to WHOLE day, not gated by log time)
- Fallback: Average of ALL Momentary Emotion entries on that day (also applied to whole day)
- If no entries at all: neutral (0) — only 1 day (Oct 17) in the dataset

**Key Design Decisions (user-directed):**
- `gardenLevel` controls fading ONLY, NOT atmosphere (corrected from original plan)
- Daily Mood valence drives atmosphere for the whole calendar day
- LED wall shows valence classification of most recent entry of any kind (not just Daily Mood)
- God rays enabled with toggle in dev panel
- Mood inversion: negative valence = RADIANT (warm, clear); positive = OVERCAST (cool, gloomy)

**Bugs Fixed:**
1. **moodValence timestamp gate** — Daily Mood entries logged at 10pm-midnight were gated by `timestamp <= currentTime`, so atmosphere was stuck at neutral for ~22 hours/day. Fix: match by calendar date only.
2. **Momentary fallback timestamp gate** — On 23 days with only Momentary entries, the atmosphere was neutral from midnight until the first entry (~10am). Fix: use whole-day average (same as Daily Mood).
3. **Bloom threshold too high** — FloorVoid emissive intensity (0.5) was below bloom threshold (0.55), so floor never visibly glowed. Fix: lowered threshold to 0.4.
4. **Mood value snap at day boundaries** — moodValence changed instantly at midnight causing visual pops. Fix: added `SmoothedMoodBridge` component using `useFrame` + exponential interpolation (~1s transition).

**Spatial Layout Updates (positionCalculator.ts):**
- `gardenRadius` reduced from 25 to 12 to fit inside ExcavatedBed
- `dayScatterRadius` reduced from 4 to 2
- Replaced circular clamping with rectangular clamping to match ExcavatedBed bounds (PLANT_BOUNDS: 34x28)

**Dev Panel Added:**
- `?dev=true` enables tuning panel with:
  - Read-only data values (hour, raw mood → smoothed mood, valence text, garden level)
  - Hour override slider
  - Mood override slider
  - Fog density, bloom intensity, bloom threshold, vignette sliders
  - God rays, clouds, shadows toggles

**Files Modified:**
- `garden/src/App.tsx` — Major rewrite: SpecimenVitrine/PostProcessing integration, DevPanel, mood bridge, SmoothedMoodBridge
- `garden/src/utils/positionCalculator.ts` — Rectangular clamping, reduced radii
- `garden/src/components/environment/PostProcessing.tsx` — bloomThreshold default 0.55 → 0.4

**Files Added (new components from previous sessions, now tracked):**
- `garden/src/components/NewEnvironmentTest.tsx`
- `garden/src/components/Backdrop.tsx`
- `garden/src/components/SceneLighting.tsx`
- `garden/src/components/environment/EmissiveGround.tsx`
- `garden/src/components/environment/GallerySurround.tsx`
- `garden/src/components/environment/SoilBed.tsx`
- `garden/src/components/environment/VitrineBase.tsx`

**Data Summary (verified):**
- 306 data rows, 89 unique dates (Oct 16, 2025 - Jan 13, 2026)
- 66 days with Daily Mood entries
- 23 days with only Momentary Emotion entries
- 1 day with no entries (Oct 17)
- Plants spawn at exact logged timestamp (full datetime precision)
