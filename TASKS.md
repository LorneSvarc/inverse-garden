# Inverse Garden: Task Tracker

**Canonical Spec:** `inverse-garden-gdd-v3.3.md` (always defer to GDD for details)

---

## Phase 1: Data Pipeline & Basic Spawning

- [ ] Parse CSV data into entry objects
  - File: `StateOfMind-2025-10-16-2026-01-14.csv`
  - Labels field = Emotions
  - Pipe separator has spaces: ` | `
  - Handle empty Labels/Associations as empty arrays
  - Handle trailing comma in CSV rows
- [ ] Map entries to DNA objects (FlowerDNA, SproutDNA, DecayDNA)
  - Use valence classification for component type selection
  - Apply emotion colors to petals/buds/layers
  - Apply association colors to stems/leaves/cracks
  - Use FLOWER_DEFAULTS, SPROUT_DEFAULTS, DECAY_DEFAULTS for non-data parameters
- [ ] Spawn correct component type based on valence classification
  - Very Unpleasant, Unpleasant, Slightly Unpleasant → Flower
  - Neutral → Sprout
  - Slightly Pleasant, Pleasant, Very Pleasant → Decay
- [ ] Display ~1 week of data to validate encoding
- [ ] Basic orbit camera controls

**Success criteria:** Plants appear with correct colors based on data. Scale may look uniform (fixed in Phase 1.5).

---

## Phase 1.5: Scale Calibration

- [ ] Implement percentile-based scale calculation
  - Calculate percentiles separately for flowers and decays
  - Sprouts get fixed percentile (50)
  - Store percentile with each entry at load time
  - See GDD "Percentile Calculation Reference" for code example
- [ ] Update scale ranges
  - Flowers: 0.7 - 1.5
  - Sprouts: 0.8 - 1.0
  - Decays: 0.8 - 1.8
- [ ] Visual validation with full dataset
- [ ] Tune min/max scale values if needed

**Success criteria:** Plants show clear size variation; sprouts are visible; adjacent entries don't look identical in size.

---

## Phase 2: Timeline, Scrubbing & Garden Level

- [ ] Timeline UI control
- [ ] Plants appear/disappear based on time position
- [ ] Garden level calculation
  - Negative valence adds to garden level
  - Positive valence subtracts from garden level
  - Garden level decays toward zero over time
- [ ] Plant fading over time (opacity + desaturation)
- [ ] Garden level affects fading rates
  - Matching plants fade slower
  - Mismatched plants fade faster
- [ ] Define and tune parameters:
  - Base plant lifespan
  - Garden level time window
  - Fade modifier strength

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
├── StateOfMind-2025-10-16-2026-01-14.csv # The data
├── reference/FlowerGen/                  # Source components to copy
│   ├── components/
│   │   ├── Flower3D.tsx
│   │   ├── Sprout3D.tsx
│   │   └── Decay3D.tsx
│   └── types.ts
└── garden/                               # Build here
```

---

## Key Reminders

1. **Always read the GDD first** for any phase — it has full specs and code examples
2. **Explain technical decisions** as you make them (creator is learning)
3. **Ask when uncertain** about visual/design intent
4. **One plant per entry** (clustering deferred)
5. **Labels = Emotions** in the CSV
6. **Percentile scaling** ensures visual variety despite clustered data
