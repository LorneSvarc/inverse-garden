# Inverse Garden: Camera, Layout & Data Display Spec

**Status:** Active build spec
**Created:** March 2026
**Source:** `Inverse-Garden-Camera-Layout-Plan.docx` (Lorne)
**Purpose:** Three-phase implementation plan transforming the garden from a passive 3D viewer into a multi-level storytelling experience.

---

## Overview

The camera becomes the primary narrative mechanism — zooming in reveals individual mood entries, pulling back reveals patterns across days and weeks.

The three systems are tightly coupled but must be built in **strict sequence**. Each phase creates the foundation the next depends on. **Do not start Phase 2 until Phase 1 is validated. Do not start Phase 3 until Phase 2 is validated.**

---

## Read Before Writing Code

Key files to understand first:

- `src/utils/positionCalculator.ts` — the positioning system being replaced
- `src/config/environmentConfig.ts` — PLANT_BOUNDS and CAMERA_LIMITS
- `src/config/patchConfig.ts` — patch config being replaced
- `src/App.tsx` — main app, camera, OrbitControls wiring
- `src/components/TimelineControls.tsx` — must continue working at all zoom levels
- `src/components/environment/SpecimenVitrine.tsx` — environment component

**Do not change GROUND_BOUNDS, PLANT_BOUNDS, or the SpecimenVitrine environment.** The enclosure and soil bed are already built correctly. The positioning system must work within existing bounds.

---

## Locked Design Decisions

These are not open questions. Do not deviate from them.

- **Spatial layout:** left-to-right within rows, rows from back (oldest) to front (newest)
- **Row unit:** one calendar week per row, 7 days per row, ~13 rows total for 90 days of data
- **No space reuse:** plants fade in place, the space they occupied is never reassigned to new entries
- **Four zoom levels:** garden overview → week row → day cluster → single plant
- **Navigation:** scroll/pinch to move between levels; click a plant to enter Level 3 from anywhere
- **Data display:** classification headline → emotions in their mapped hex colors → associations in their mapped hex colors
- **No raw numbers visible to viewers:** no valence floats, no scale percentiles, no technical fields

---

## Phase 1: Positioning System Rewrite

**Depends on:** Nothing — build this first

### What Exists Now

`positionCalculator.ts` implements a jittered 5x6 patch grid with serpentine fill order and patch reuse. Days get assigned to patches, and when plants in a patch fade, the patch is recycled. The result is organic-looking but temporally meaningless — there is no way to read time from the spatial arrangement.

PLANT_BOUNDS is 34 wide x 28 deep (world units). GROUND_BOUNDS is 36 x 30. These are correct and should not change.

### The New Layout

Each calendar week maps to one spatial row. Rows run left-to-right and are ordered front-to-back: the most recent week is the front row (lowest Z, closest to camera), the oldest week is the back row (highest Z, furthest from camera). Within each row, days run Monday left to Sunday right. Within each day, entries cluster together.

This makes time readable at every scale. From the garden overview, you can see the arc of the whole dataset. Zoomed into a row, you read a week left-to-right. Zoomed into a cluster, you see a single day.

### Layout Math (starting values — tune by eye)

- PLANT_BOUNDS: 34 wide x 28 deep
- ~13 rows: (90 days / 7 days per row, rounded up)
- Row spacing: ~2.0 world units between row centers
- Day slot width: ~4.6 world units (34 / 7, allowing some margin)
- Entry cluster radius: ~1.5 world units within a day slot

### Coordinate System

Garden center is [0, 0, 0]. Oldest row (week 0) is at highest Z (back). Newest row is at lowest Z (front). Within a row:

```
Z = HALF_DEPTH - (rowIndex * rowSpacing) - rowSpacing/2
X = -HALF_WIDTH + (dayIndexInWeek * daySlotWidth) + daySlotWidth/2
```

- `dayIndexInWeek`: 0 = Monday, 6 = Sunday
- Use calendar weeks (Mon-Sun), not rolling 7-day windows
- First row may have fewer than 7 days if dataset starts mid-week

### What to Delete

- `generatePatches()` — entire patch generation system
- `orderPatchesSerpentine()` — serpentine ordering logic
- `simulateTimeline()` — patch reuse and freed-at tracking
- `PATCH_CONFIG` from `patchConfig.ts` — all patch configuration
- `patch.freedAtMs` logic — no reuse means no tracking of when patches free up

### What to Keep

- `createSeededRandom()`, `timestampToSeed()`, `dateStringToSeed()`, `getDateString()` — reusable utilities
- `positionEntriesInPatch()` ring-layout logic — rename `positionEntriesInDaySlot()`, adapt center/radius params
- `calculatePositions()` function signature: same inputs (`MoodEntryWithPercentile[]`), same output (`Map<string, [x,y,z]>`). App.tsx must not need changes.
- `calculatePositionsWithDebug()` — update to export week/day metadata instead of patch metadata

### New Config

Add `LAYOUT_CONFIG` to `environmentConfig.ts` or a new `layoutConfig.ts`:

```typescript
export const LAYOUT_CONFIG = {
  daysPerRow: 7,
  rowSpacing: 2.0,           // world units between row centers
  daySlotWidth: 4.6,         // world units per day slot
  entryClusterRadius: 1.5,   // max spread within a day cluster
  weekStartDay: 1,           // 1 = Monday
};
```

### Pre-calculate Day and Week Metadata

At load time (alongside position calculation), build lookup maps that Phase 3 will need for the data cards. Calculate these once and store them — do not recompute on render.

```typescript
// Map from day string ("2025-10-14") to summary
interface DaySummary {
  dateStr: string;
  entryCount: number;
  topEmotions: string[];   // top 2-3 by frequency
  center: [number, number, number]; // bounding box center of day's plants
}

// Map from weekIndex to summary
interface WeekSummary {
  weekIndex: number;
  startDate: Date;
  endDate: Date;
  flowerCount: number;
  sproutCount: number;
  decayCount: number;
  topEmotions: string[];   // top 2 by frequency for the week
  center: [number, number, number]; // bounding box center of week row
}
```

Export these maps from `positionCalculator.ts` or a new `summaryCalculator.ts` utility. They will be passed to the camera system and data display components in Phase 2 and 3.

### Phase 1 Validation — do not proceed until all pass

- October entries are at the back of the garden (high Z), January at the front (low Z)
- Within any row, Monday entries are on the left, Sunday on the right
- Entries from the same day cluster together visibly
- No entries spawn outside PLANT_BOUNDS
- Debug overlay shows week/day grid (update PatchDebugOverlay or equivalent)
- The garden looks like a temporal landscape, not a scatter plot

---

## Phase 2: Camera Zoom System

**Depends on:** Phase 1 complete and validated

### The Four Zoom Levels

**Level 0: Garden Overview (default)**
- Camera: Elevated, slightly angled — sees full garden as a landscape
- What's visible: All plants, full timeline, LED wall in background
- Interaction: Limited orbit (existing CAMERA_LIMITS), click any plant to enter Level 3
- Data shown: None

**Level 1: Week Row**
- Camera: Framing the full width of one week's row
- What's visible: All 7 days of one week, prominent
- Interaction: Slight orbit within row frame; scroll/pinch out → Level 0
- Data shown: Week date range, dominant emotions, entry count breakdown (X flowers / Y sprouts / Z decays)

**Level 2: Day Cluster**
- Camera: Framing one day's cluster
- What's visible: All entries for that calendar day
- Interaction: Slight orbit; scroll/pinch out → Level 1; click plant → Level 3
- Data shown: Date, entry count, top 2-3 emotions for the day

**Level 3: Single Plant**
- Camera: Medium shot — close enough to appreciate the flower geometry, ~7-10 units from plant
- What's visible: One plant centered, neighboring plants secondary
- Interaction: Free orbit around plant; scroll/pinch out → Level 2
- Data shown: Full plant entry card (see Phase 3)

### Navigation

One gesture, one direction. No mode buttons or level selectors.

- Click any plant from any level → jumps directly to Level 3 for that plant
- Scroll/pinch out from Level 3 → Level 2 (that plant's day cluster)
- Scroll/pinch out from Level 2 → Level 1 (that day's week row)
- Scroll/pinch out from Level 1 → Level 0 (garden overview)
- Escape key from any level → Level 0 directly
- Click a different plant from Level 2 or 3 → transition to that plant's Level 3

**There are no buttons labeled "week view" or "day view."** The only explicit UI is a subtle breadcrumb that appears when zoomed in. See Breadcrumb section below.

### Camera State

Add a `cameraState` to App.tsx. This drives everything — camera position, OrbitControls limits, which data card is visible.

```typescript
interface CameraState {
  level: 0 | 1 | 2 | 3;
  targetPlantId: string | null;    // Level 3: which plant
  targetDayStr: string | null;     // Level 2: "2025-10-14"
  targetWeekIndex: number | null;  // Level 1: which week row
}
```

### Camera Target Calculation

Derived from pre-calculated positions (Phase 1). Never recompute layout on camera transition.

- **Level 3:** Target = plant [x, 0, z]. Camera at roughly [plantX+3, plantY+5, plantZ+8], looking at plant. Distance 8-12 units.
- **Level 2:** Target = center of bounding box of all positions for that day (from `DaySummary.center`). Camera elevated, framing all day's plants.
- **Level 1:** Target = center of bounding box of that week's row (from `WeekSummary.center`). Camera elevated, framing full row width.
- **Level 0:** Fixed position [0, 25, 35], target [0, 2, 0]. Same as current default.

### Animated Transitions

Camera transitions must lerp smoothly — ~0.8 seconds to settle. Both camera position and lookAt target lerp simultaneously. Snapping is not acceptable.

Create a `CameraController` component inside Canvas. It holds `targetPosition` and `targetLookAt` in refs, and lerps toward them each frame:

```typescript
useFrame(() => {
  camera.position.lerp(targetPositionRef.current, 0.05);
  currentLookAt.lerp(targetLookAtRef.current, 0.05);
  camera.lookAt(currentLookAt);
});
```

When `cameraState` changes, `CameraController` updates its target refs. The lerp factor of 0.05 produces a ~0.8s transition at 60fps — tune as needed.

### OrbitControls Per Level

OrbitControls remains active at every level but with tighter constraints when zoomed in. Update limits when `cameraState.level` changes.

- **Level 0:** Existing CAMERA_LIMITS (minDist 10, maxDist 40, azimuth ±60°)
- **Level 1:** minDist 15, maxDist 35, polar ±15°, azimuth ±20°
- **Level 2:** minDist 6, maxDist 18, polar ±20°, azimuth ±30°
- **Level 3:** minDist 4, maxDist 14, polar ±30°, azimuth ±60°

**Disable OrbitControls during transition animation.** Re-enable when camera has settled (when lerp distance < 0.1 units from target). Otherwise OrbitControls fights the lerp.

### Breadcrumb Navigation

A minimal back-navigation indicator, positioned bottom-left of screen above the timeline controls. Appears only at Level 1, 2, or 3. Clicking returns to the previous level.

- **Level 1:** "← Garden"
- **Level 2:** "← Oct 14–20" (the week range)
- **Level 3:** "← Tuesday, Oct 14" (the day)

Style: small, muted, semi-transparent background. This is a wayfinding hint, not a prominent UI element. Font size ~12px.

### Phase 2 Validation — do not proceed until all pass

- Clicking a plant from garden view smoothly zooms to that plant (Level 3)
- Scroll/pinch out at each level moves to the correct parent level
- Escape always returns to Level 0
- Transitions are smoothly animated, not snapping
- OrbitControls work at each level with appropriate constraints
- Breadcrumb shows the correct label and clicking it navigates back
- Timeline scrubbing continues to work while zoomed in at any level
- If focused plant fades during scrubbing, camera returns to Level 0 gracefully

---

## Phase 3: Data Display

**Depends on:** Phase 2 complete and validated

### Design Principles

- **No raw numbers.** Valence floats, scale percentiles, and technical fields are not shown to viewers.
- **Emotion words are primary** — each word rendered in its mapped hex color from the emotion color table.
- **Classification is the headline** — it names what the plant type already communicates visually.
- **Associations are quieter than emotions** — smaller, same color system, but secondary.
- **Cards are non-blocking** — they overlay the scene without obscuring the plants they describe.
- **All cards are React DOM overlays** (absolute-positioned HTML), not Three.js objects.

### Level 3: Plant Card

Appears when `cameraState.level === 3`. Positioned lower-left or lower-right (whichever side has more screen space relative to the plant's projected position).

Typography hierarchy:

```
OCT 9, 2025  ·  3:34 PM           ← 11px, muted (#888), light weight
VERY UNPLEASANT                    ← 22px, bold, all caps, classification color*

Anxious  ·  Irritated  ·  Sad      ← 16px, medium weight, each word in its emotion hex color

Family  ·  Self Care               ← 13px, each word in its association hex color
```

*Classification color: muted version of the dominant emotion color (desaturate ~40%) so it reads as related without competing. If no emotions, use #AAAAAA.

If no emotions logged: show classification only. If no associations: omit that line.

### Level 2: Day Card

Appears when `cameraState.level === 2`. Same screen position logic as plant card.

```
TUESDAY, OCT 14, 2025              ← 18px, bold
4 entries                          ← 12px, muted

Anxious  ·  Discouraged  ·  Sad    ← 15px, top 3 emotions by frequency, colored
```

Top emotions: count occurrences across all entries for the day. Show top 2-3 (max 4 if tied). If no emotions logged for the day, omit that line.

### Level 1: Week Card

Appears when `cameraState.level === 1`.

```
OCT 14 – OCT 20, 2025             ← 18px, bold

12 entries  ·  8 flowers  ·  3 sprouts  ·  1 decay   ← 12px, muted

Anxious  ·  Discouraged            ← 15px, top 2 emotions for the week, colored
```

The flower/sprout/decay breakdown communicates the week's emotional character. A week of all flowers was a hard week. This is the inversion made legible without explanation.

### Card Styling

All three cards share consistent visual treatment:

- Background: `rgba(10, 10, 15, 0.88)`
- Border: `1px solid rgba(255,255,255,0.08)`
- Border radius: `8px`
- Padding: `16px 20px`
- Max width: `300px`
- Font: System sans-serif stack
- Transition: `opacity 200ms ease` on appear/disappear

The card should feel like a museum label — minimal, precise, in service of the work.

### Remove Default Dev Panel

The current collapsible "Plant Details" panel on the left is creator-facing. It exposes valence floats, scale percentiles, and technical data inappropriate for viewers.

Remove it from the default experience. Keep it accessible via `?dev=true` URL parameter — it remains useful for debugging. The DevPanel and related state in App.tsx stays, just gate it behind the `isDevMode` check that already exists.

The new plant/day/week cards replace it for the viewer experience.

### Phase 3 Validation

- Plant card shows date/time, classification, emotions in correct hex colors, associations in correct hex colors
- Day card shows date, entry count, top emotions in color
- Week card shows date range, entry breakdown, dominant emotions in color
- Cards fade in and out smoothly (200ms) when changing zoom levels
- Cards do not obscure the plants they describe
- No raw numbers (valence, percentile, scale) visible in default viewer mode
- Dev panel hidden by default, accessible via `?dev=true`

---

## Cross-Cutting Concerns

### Timeline Scrubbing

The timeline scrubber must work at all zoom levels. Plants appear and fade as normal regardless of zoom state. Two edge cases to handle explicitly:

- If the currently focused plant fades out while scrubbing at Level 3, return camera to Level 0.
- If scrubbing backward past the creation time of the focused plant, return camera to Level 0.

### Performance

- Positions are calculated once at load time. The camera system reads from pre-calculated positions — never recalculate layout on a camera transition.
- Day/week summaries (`DaySummary`, `WeekSummary` maps) are pre-calculated at load time alongside positions, not computed on render.
- The existing memoization structure in App.tsx (quantized time keys, useMemo gating) must be preserved.

### No Space Reuse — Confirmed

Remove all of: `simulateTimeline()`, `patch.freedAtMs` tracking, `PATCH_CONFIG.reuseGraceDays`, and any logic checking whether a patch has freed. Each entry has one fixed spatial position for the lifetime of the visualization. This simplifies the system significantly.

---

## Files to Modify

### Phase 1

- `src/utils/positionCalculator.ts` — complete rewrite
- `src/config/patchConfig.ts` — replace with LAYOUT_CONFIG or delete
- `src/config/environmentConfig.ts` — add LAYOUT_CONFIG
- `src/components/PatchDebugOverlay.tsx` — update to show week/day grid

### Phase 2

- `src/App.tsx` — add cameraState, use CameraController, update click handling
- `src/components/CameraController.tsx` — new: handles zoom, lerp transitions, OrbitControls gating
- `src/components/BreadcrumbNav.tsx` — new: back navigation indicator

### Phase 3

- `src/components/PlantCard.tsx` — new: Level 3 data overlay
- `src/components/DayCard.tsx` — new: Level 2 data overlay
- `src/components/WeekCard.tsx` — new: Level 1 data overlay
- `src/App.tsx` — remove default panel, add card overlays, wire summary data

---

## Success Criteria

The implementation is complete when a viewer can:

- Open the page and read the emotional arc of 90 days through space — oldest at the back, newest at the front.
- Click any flower and zoom smoothly to a close-up with legible, emotionally resonant data.
- Scroll back out through day context, then week context, then the full garden — each level adding meaning.
- Understand what they are seeing without instruction.

And when:

- No raw numbers are visible in the default viewer experience.
- Timeline scrubbing works correctly at all zoom levels.
- Camera transitions are smooth and intentional, not jarring.
- The data shown serves someone who doesn't know the creator.
