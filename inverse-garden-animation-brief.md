# Inverse Garden: Animation Brief

## Document Information

**Version:** 1.0  
**Status:** Ready for Implementation  
**Created:** February 2025  
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
└── Duration: ~60% of total time

Phase 2: LEAF UNFURL  
├── Leaves appear one at a time
├── Each leaf unfurls (or scales in if unfurl is too complex)
├── Staggered timing between leaves
└── Duration: ~20% of total time

Phase 3: BLOOM REVEAL
├── Flower head/center appears
├── Petals emerge (ideally one at a time, or as a group if needed)
├── Slight settle/overshoot at the end
└── Duration: ~20% of total time
```

**Total Duration:** ~1.5 seconds (tunable parameter)

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

Same philosophy, adapted for the simpler form:

```
Phase 1: STEM EMERGENCE
├── Thin stem rises from below ground
└── Duration: ~50% of total time

Phase 2: COTYLEDON SPREAD
├── Cotyledons (seed leaves) spread open
├── Start folded against stem, open outward
└── Duration: ~30% of total time

Phase 3: BUD REVEAL
├── Bud emerges at top
├── Small scale-in or "pop" into place
└── Duration: ~20% of total time
```

**Total Duration:** ~1.2 seconds (slightly faster than flower — it's simpler)

---

## Decay Animation

**Status:** Tabled — asset not yet finalized.

When the fallen petal/debris decay asset is built, animation options to consider:
- Pieces fall from above and scatter
- Cracks spread outward from center
- Fade/materialize in place

---

## Fade-Out Animation (Phase 2)

When plants age out of visibility due to timeline position and garden level:

### The Sequence

```
FADE OUT
├── Opacity reduces (toward transparent)
├── Saturation reduces (toward grey)
├── Plant slowly sinks into the ground
└── Duration: ~2-3 seconds (slower than growth)
```

### Implementation Notes

- **Sinking:** The entire plant (stem, leaves, bloom) translates downward on Y-axis
- **Opacity + Y-position** should animate together
- **Saturation** can be a shader/material property shift
- **Easing:** `easeInQuad` or linear — gentle, inevitable disappearance

---

## Timeline Scrubbing Behavior

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
  const animationDuration = 1.5; // seconds (converted to timeline units)
  
  if (timeSinceBirth < 0) {
    // Not born yet
    plant.visible = false;
    return;
  }
  
  const progress = Math.min(timeSinceBirth / animationDuration, 1.0);
  
  // Phase 1: Stem (0% - 60%)
  const stemProgress = Math.min(progress / 0.6, 1.0);
  plant.stemY = easeOutQuart(stemProgress) * plant.finalStemHeight - plant.stemStartDepth;
  
  // Phase 2: Leaves (60% - 80%)
  const leafProgress = Math.max(0, Math.min((progress - 0.6) / 0.2, 1.0));
  plant.leafScale = easeOutBack(leafProgress);
  
  // Phase 3: Bloom (80% - 100%)
  const bloomProgress = Math.max(0, Math.min((progress - 0.8) / 0.2, 1.0));
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

## Open Parameters (To Tune)

| Parameter | Starting Value | Notes |
|-----------|----------------|-------|
| Flower growth duration | 1.5s | Full animation time |
| Sprout growth duration | 1.2s | Simpler form = faster |
| Stem phase percentage | 60% | How much of duration is stem |
| Leaf phase percentage | 20% | How much of duration is leaves |
| Bloom phase percentage | 20% | How much of duration is bloom |
| Fast scrub threshold | 2.0 days/sec | When to skip animations |
| Fade-out duration | 2.5s | Slower than growth |
| Stem start depth | -2.0 units | How far below ground stem starts |
| Elastic amplitude | 0.3 | Very subtle spring |
| Back overshoot | 0.5 | Very subtle overshoot |

---

## Visual Reference

```
TIME →

t=0         t=0.3       t=0.6       t=0.9       t=1.0       t=1.5
(birth)     (30%)       (60%)       (90%)       (100%)      (growth complete)

            ·                        🌸          🌸          🌸
                        ╷           ╱│╲         ╱│╲         ╱│╲
                        │          🌿│🌿       🌿│🌿       🌿│🌿
            ·           │           │           │           │
═══════════════════════════════════════════════════════════════════
    ↑           ↑           ↑           ↑           ↑
 (below     (stem tip   (stem full, (leaves +   (final
 ground)    emerging)   leaves      bloom)      state)
                        starting)
```

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

- [ ] Flower stem visibly emerges from below ground, not scaling from a point
- [ ] Leaves appear after stem, with individual timing
- [ ] Bloom appears last, with satisfying settle
- [ ] Scrubbing forward at normal speed shows smooth staggered growth
- [ ] Scrubbing fast skips animations (plants snap to final state)
- [ ] Scrubbing backward removes plants cleanly (no reverse animation needed)
- [ ] Overall feel is "elegant cartoon" — stylized but not cheap

---

*This brief should be read alongside the main GDD (inverse-garden-gdd-v3.3.md) and the atmosphere spec for full context.*
