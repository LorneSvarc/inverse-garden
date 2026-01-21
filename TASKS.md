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

### Design Rationale

**Why spiral?** Creates subtle temporal structure without causing "empty regions" as time passes.

**Why center-out?** Garden "grows outward" over time - core is history, edges are recent.

**Why heavy scatter?** Prevents artificial/grid-like appearance. Temporal structure is a secret that rewards observation.

---

## Phase 2B: Garden Level & Fading

- [ ] Garden level calculation
  - Negative valence adds to garden level (toward lush)
  - Positive valence subtracts from garden level (toward barren)
  - Use exponential decay so recent entries matter most
  - **Implementation:** `garden/src/utils/gardenLevel.ts`
- [ ] Plant fading over time (opacity + desaturation)
  - Base lifespan: 14 days (tunable)
  - Opacity: 1.0 → 0.0
  - Saturation: 1.0 → 0.3 (fade slower than opacity)
  - **Implementation:** `garden/src/utils/plantFading.ts`
- [ ] Garden level affects fading rates
  - Matching plants fade slower (flowers during negative periods)
  - Mismatched plants fade faster (flowers during positive periods)
  - Modifier: ±50% fade rate adjustment
- [ ] Modify plant components to accept opacity/saturation props
- [ ] Define and tune parameters:
  - Base plant lifespan (start: 14 days)
  - Garden level half-life (start: 7 days)
  - Fade modifier strength (start: ±50%)

**Success criteria:** Scrubbing through time shows garden evolving with persistence mechanics.

---

## Phase 3: Spatial Layout

- [ ] Determine garden plot size
- [ ] Position plants with natural distribution
- [ ] Depth layering (foreground/midground/background)
- [ ] Prevent excessive overlap

**Success criteria:** Garden looks like a garden, not a pile.

---

## Phase 4: Polish & Atmosphere

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
