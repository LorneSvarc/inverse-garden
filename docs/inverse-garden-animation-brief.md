# Inverse Garden: Animation Brief

## Document Information

**Version:** 1.1
**Status:** In Progress — Animation implemented in test scene (`?test=environment`), not yet in main scene
**Created:** February 2025
**Updated:** February 2026
**Purpose:** Define plant growth and fade animations for timeline scrubbing

---

## Design Goals

1. **Feel alive** — Plants should feel like they're actively growing, not just appearing
2. **Elegant cartoon** — Stylized and smooth, not realistic simulation
3. **Timeline-driven** — Animations respond to scrub position, not just play once
4. **Performance-aware** — Handle 300+ plants without breaking the experience

---

## Core Animation: Plant Growth

### The Sequence (Flower)

Growth happens in distinct phases, each completing before the next begins:

```
Phase 1: STEM EMERGENCE
├── Stem geometry starts below ground plane
├── Rises upward, breaching the surface
├── No bloom/head visible during this phase
└── Active: 0–50% of total time

Phase 2: LEAF UNFURL
├── Leaves appear one at a time
├── Each leaf unfurls (or scales in if unfurl is too complex)
├── Staggered timing between leaves
└── Active: 25–70% of total time (overlaps with stem tail and bloom start)

Phase 3: BLOOM REVEAL
├── Flower head/center appears
├── Petals emerge (ideally one at a time, or as a group if needed)
├── Slight settle/overshoot at the end
└── Active: 60–100% of total time
```

> **Note:** Phases overlap — this is the implemented behavior in the test scene. The original brief described sequential phases (60/20/20%); the overlapping approach was chosen during implementation and feels better.

**Total Duration:** ~0.74 seconds at the chosen speed (2.7x multiplier applied to a 2.0s base)

### The Feel

- **"Pushing up from the ground"** — The stem physically emerges from below, not scaling from a point
- **Fast start, gentle settle** — Ease-out curve as the primary easing
- **Slight spring on petals** — Optional: small overshoot/bounce when bloom completes
- **Not linear** — Organic acceleration, like real growth but compressed

### Easing Recommendations

| Phase | Suggested Easing | Rationale |
|-------|------------------|-----------|
| Stem emergence | `easeOutQuart` or `easeOutExpo` | Fast burst from ground, slows as it reaches height |
| Leaf unfurl | `easeOutBack` (subtle) | Slight overshoot gives life |
| Bloom reveal | `easeOutElastic` (very subtle) | Petals feel like they're settling into place |

**Note:** These are starting points. The elastic/back easing should be subtle — we want elegance, not bounciness.

---

## Sprout Animation

**Status:** Needs implementation and testing — phases not yet animated per-section (currently plays as a single unit, if at all).

Same philosophy as the flower, adapted for the simpler form. The phase breakdown and overlapping approach from the flower should be applied here, then tuned:

```
Phase 1: STEM EMERGENCE
├── Thin stem rises from below ground
└── Active: ~0–50% of total time

Phase 2: COTYLEDON SPREAD
├── Cotyledons (seed leaves) spread open
├── Start folded against stem, open outward
└── Active: ~30–70% of total time (overlapping)

Phase 3: BUD REVEAL
├── Bud emerges at top
├── Small scale-in or "pop" into place
└── Active: ~65–100% of total time
```

**Total Duration:** ~0.59 seconds at 2.7x (proportionally shorter than flower; ratio maintained from original design)

**TODO:**
- [ ] Implement per-phase animation (stem → cotyledons → bud) matching the flower's overlapping approach
- [ ] Test in the `?test=environment` scene with the animation test panel
- [ ] Confirm 2.7x speed feels right for the sprout's simpler form (may want slight adjustment)

---

## FallenBloom3D Animation (formerly Decay)

**Status:** Needs decision, creation, and testing — asset exists (`FallenBloom3D`) but animation is not yet defined or implemented.

The `FallenBloom3D` component represents the decayed/fallen state of a flower. Its appearance animation needs to be designed from scratch.

### Options to Decide Between

- **A — Fall from above:** Petals/pieces drop from above and land in final position (dramatic, reads clearly)
- **B — Materialize in place:** Fade/scale in from nothing (simple, consistent with "timeline reveals")
- **C — Wilt and collapse:** Plant droops, then the fallen version appears as the grown plant fades out (more narrative, more complex)

### TODO
- [ ] Decide on the animation approach (A, B, or C above)
- [ ] Implement the chosen animation in the test scene
- [ ] Test and tune timing — should it feel abrupt or gradual?
- [ ] Confirm whether FallenBloom3D plays a growth-style entrance, or simply appears when its timestamp is crossed
- [ ] Add to the confirmed parameters table once timing is locked

---

## Fade-Out Animation (Phase 2)

**Status:** Partially implemented — opacity fade is working. Sinking not yet implemented. Desaturation removed from design.

When plants age out of visibility due to garden level:

### The Sequence

```
FADE OUT
├── Opacity reduces progressively (toward transparent)
└── Plant slowly sinks into the ground [NOT YET IMPLEMENTED]
```

### Key Design Note

This is **not a triggered animation** — it's a continuous state driven by garden level. As the garden level changes, plant opacity is calculated directly from that value. There is no fixed duration; the fade is as slow or fast as the user moves through levels.

### Implementation Notes

- **Opacity:** Already connected to garden level — works
- **Desaturation:** Removed from design — opacity alone is sufficient
- **Sinking:** The entire plant (stem, leaves, bloom) translates downward on Y-axis — still to be implemented, also driven by garden level (not a timed animation)
- **Easing:** `easeInQuad` or linear applied to the garden level → opacity/Y mapping

---

## Timeline Scrubbing Behavior

> **Note:** This section describes the intended approach, not confirmed behavior. The trigger logic and scrub speed detection are starting points — they haven't been implemented or tested yet and may need significant revision once we get there.

### Trigger Logic

A plant's growth animation triggers when the **timeline position crosses the plant's timestamp**.

```typescript
// Pseudocode
if (previousTime < plant.timestamp && currentTime >= plant.timestamp) {
  // Timeline crossed this plant's birth moment → trigger growth
  plant.triggerGrowthAnimation();
}
```

### Scrub Speed Detection (Option C)

To prevent chaos during fast scrubbing:

```typescript
const scrubSpeed = Math.abs(currentTime - previousTime) / deltaFrame;
const FAST_SCRUB_THRESHOLD = 2.0; // days per second (tune this)

if (scrubSpeed > FAST_SCRUB_THRESHOLD) {
  // Fast scrub → snap plants to final state
  plant.setToFinalState();
} else {
  // Normal scrub → play animation
  plant.triggerGrowthAnimation();
}
```

**Threshold tuning:** Start with ~2 days/second. If the user is scrubbing faster than that, they're seeking, not watching.

### Reverse Scrubbing

When scrubbing backward:
- Plants that are "unborn" (timeline < their timestamp) should not be visible
- No reverse growth animation needed — they simply don't exist yet
- If timeline crosses back forward over them, they animate normally (or snap if fast)

### Staggering (Natural)

Since each entry has a unique timestamp, staggering happens naturally as the timeline progresses. No artificial delay needed — the data provides the stagger.

---

## Technical Implementation Approach

### Option A: Procedural Animation (Recommended)

Animate properties frame-by-frame based on timeline position:

```typescript
function updatePlantAnimation(plant: Plant, timelinePosition: number) {
  const timeSinceBirth = timelinePosition - plant.timestamp;
  const animationDuration = 2.0 / 2.7; // ~0.74s — base 2.0s at speed 1.0x, running at 2.7x
  
  if (timeSinceBirth < 0) {
    // Not born yet
    plant.visible = false;
    return;
  }
  
  const progress = Math.min(timeSinceBirth / animationDuration, 1.0);
  
  // Phase 1: Stem (0% - 50%) — overlapping
  const stemProgress = Math.min(progress / 0.5, 1.0);
  plant.stemY = easeOutQuart(stemProgress) * plant.finalStemHeight - plant.stemStartDepth;

  // Phase 2: Leaves (25% - 70%) — overlapping
  const leafProgress = Math.max(0, Math.min((progress - 0.25) / 0.45, 1.0));
  plant.leafScale = easeOutBack(leafProgress);

  // Phase 3: Bloom (60% - 100%) — overlapping
  const bloomProgress = Math.max(0, Math.min((progress - 0.6) / 0.4, 1.0));
  plant.bloomScale = easeOutElastic(bloomProgress, 0.3); // subtle elastic
  
  plant.visible = true;
}
```

**Pros:** 
- Scrubbing backward/forward "just works" — animation state derived from timeline
- No need to track animation state separately
- Pause/resume is free

**Cons:**
- Recalculated every frame (but it's just math, very cheap)

### Option B: Triggered Tweens

Use a tweening library (e.g., `@react-spring/three`, `framer-motion-3d`, or raw GSAP) to fire off animations when timestamps are crossed.

**Pros:**
- Familiar animation API
- Built-in easing functions

**Cons:**
- Need to handle scrub direction changes carefully
- "Current state" vs "target state" management gets complex with timeline

### Recommendation

**Use Option A (procedural)** for the timeline-driven nature of this project. The animation state should be a pure function of `(plant.timestamp, timeline.position)` — this makes scrubbing in any direction trivial.

---

## Easing Function Reference

```typescript
// Fast start, gentle settle
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// Slight overshoot
function easeOutBack(t: number, overshoot = 1.70158): number {
  return 1 + (overshoot + 1) * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}

// Springy settle (use very subtle settings)
function easeOutElastic(t: number, amplitude = 1, period = 0.3): number {
  if (t === 0 || t === 1) return t;
  const s = period / (2 * Math.PI) * Math.asin(1 / amplitude);
  return amplitude * Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / period) + 1;
}
```

---

## Confirmed Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Animation speed multiplier | **2.7x** | Chosen feel — tuned in test scene |
| Base animation duration (code) | 2.0s | At 1.0x: `progress += deltaTime * speed * 0.5` → 1/0.5 = 2s |
| Flower growth duration (at 2.7x) | **~0.74s** | 2.0 / 2.7 |
| Sprout growth duration (at 2.7x) | **~0.59s** | Proportionally shorter (≈80% of flower) |
| Stem phase | 0–50% | Overlapping phases as implemented |
| Leaf phase | 25–70% | Overlapping with stem and bloom |
| Bloom phase | 60–100% | Overlapping with leaves |
| Fast scrub threshold | 2.0 days/sec | When to skip animations — still needs tuning |
| Fade-out | garden level → opacity | Not duration-based — progressive, driven by garden level. Sinking not yet implemented |
| Stem start depth | -2.0 units | How far below ground stem starts |
| Elastic amplitude | 0.3 | Very subtle spring |
| Back overshoot | 0.5 | Very subtle overshoot |

---

## Visual Reference

```
TIME → (at 2.7x speed, total = ~0.74s)

t=0         t=0.19      t=0.37      t=0.56      t=0.74
(birth)     (25%)       (50%)       (75%)       (100% — growth complete)

                                     🌸          🌸
                        ╷           ╱│╲         ╱│╲
                        │          🌿│🌿       🌿│🌿
            ·           │           │           │
═════════════════════════════════════════════════════
    ↑           ↑           ↑           ↑           ↑
 (below     (stem tip   (stem full, (leaves +   (final
 ground)    emerging)   leaves      bloom       state)
                        starting)   starting)
```

Implemented phase overlap:
- Stem active: t=0 → t=0.37s (0–50%)
- Leaves active: t=0.19s → t=0.52s (25–70%)
- Bloom active: t=0.44s → t=0.74s (60–100%)

---

## Integration Notes

### With Positioning System
- Plants need a `groundY` reference to know where "underground" is
- The raised bed has a known surface height — stem emergence should respect this

### With Fade System (Phase 2)
- Fade animation only triggers for plants that have completed growth
- A plant mid-growth that gets "unborn" by reverse scrub just disappears (no fade)

### With Performance
- Only calculate animation state for plants within a reasonable time window
- Plants far in the past (fully faded) or far in the future (not born) can be culled

---

## Success Criteria

**Flower (in progress)**
- [x] Flower animation implemented in test scene (`?test=environment`)
- [x] Animation speed confirmed at 2.7x (~0.74s total)
- [x] Overlapping phase approach implemented and feels good
- [ ] Flower animation ported to main scene
- [ ] Stem visibly emerges from below ground, not scaling from a point
- [ ] Leaves appear with individual timing, overlapping stem
- [ ] Bloom appears last, with satisfying settle

**Sprout (not started)**
- [ ] Per-phase animation implemented (stem → cotyledons → bud)
- [ ] Speed tested and confirmed at 2.7x (~0.59s target)
- [ ] Feels proportionally right alongside the flower

**FallenBloom3D (not started)**
- [ ] Animation approach decided
- [ ] Animation implemented and tested in test scene
- [ ] Feels consistent with the overall "elegant cartoon" tone

**System**
- [ ] Scrubbing forward at normal speed shows smooth staggered growth
- [ ] Scrubbing fast skips animations (plants snap to final state)
- [ ] Scrubbing backward removes plants cleanly (no reverse animation needed)
- [ ] All animations ported to main scene

---

*This brief should be read alongside the main GDD (inverse-garden-gdd-v4.0.md) for full context.*
