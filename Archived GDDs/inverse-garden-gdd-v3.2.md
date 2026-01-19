# Inverse Garden: Game Design Document v3.2

## Document Information

**Version:** 3.2  
**Last Updated:** January 2025  
**Status:** Active — Complete Build Reference  
**Platform:** React Three Fiber (Web)  
**Purpose:** Single-source specification for AI-assisted development

---

## Working Style Note

The creator is a "vibe coder" — comfortable with concepts but learning procedural generation and React Three Fiber as they go. When building:
- **Explain technical decisions** as you make them, don't just produce code silently
- **Narrate your reasoning** so the creator can learn and course-correct
- **Ask when uncertain** rather than making assumptions about visual/design intent

---

## Project Overview

**Concept:** A data visualization art piece that transforms personal mood tracking data into a 3D garden. The core inversion: negative emotions produce beautiful, lush growth while positive emotions produce decay and barrenness.

**Purpose:** An audience-facing psychological/technological art experience visualizing the creator's mental health data, allowing viewers to journey through emotional struggles and triumphs represented as the flourishing and decay of a garden over time.

**Data Source:** Apple Health State of Mind tracker exports (CSV format), ~300+ entries over 3 months.

---

## The Core Inversion

This is the conceptual foundation of the entire project:

| Valence Classification | Component Type | Visual Result |
|------------------------|----------------|---------------|
| Unpleasant / Very Unpleasant | **Flower** | Beautiful, lush, vibrant blooms |
| Neutral | **Sprout** | Small bud with cotyledons, potential |
| Pleasant / Very Pleasant | **Decay** | Flat ground scar, cracked earth |

**Why:** Difficult emotional experiences deserve beautiful representation. The garden finds beauty in darkness and space in lightness.

---

## Component Type Selection

**Decision:** We use Apple's "Valence Classification" field to determine component type.

| Valence Classification | Component |
|------------------------|-----------|
| "Very Unpleasant" | Flower |
| "Unpleasant" | Flower |
| "Slightly Unpleasant" | Flower |
| "Neutral" | Sprout |
| "Slightly Pleasant" | Decay |
| "Pleasant" | Decay |
| "Very Pleasant" | Decay |

**Note:** The numeric valence value is used separately for **scale calculation** (see below).

---

## Plant Spawning

**Decision:** One plant per entry.

Each mood entry spawns exactly one plant. The option to spawn clusters (3-5 plants per entry) for visual density was considered but deferred — we will validate the encoding system first with one-to-one mapping and revisit clustering if the garden feels sparse.

---

## Visual Encoding System

### How Data Maps to Visuals

Each entry encodes four pieces of information:

| Data Element | Visual Property | Used For |
|--------------|-----------------|----------|
| Valence Classification | Component type | Flower vs Sprout vs Decay |
| Valence (numeric, absolute value) | Scale/size | Intensity of the entry |
| Emotions (Labels field) | Color palette | Primary visual identity |
| Associations | Accent colors | Stem/leaf/crack colors |

### Parameter Generation

Parameters not derived from entry data (petalCount, stemBend, leafCount, etc.) use the recommended defaults as fixed values for Phase 1.

**Future enhancement:** Generate these using deterministic pseudo-randomization seeded by the entry timestamp, with the defaults as midpoints and ±20-30% variation. This would add visual variety between entries while ensuring the same entry always produces an identical plant on revisit/reload.

### Scale Calculation

Scale is determined by the **absolute value** of the numeric valence:

```
scale = minScale + (|valence| × (maxScale - minScale))
```

**Suggested ranges (to tune):**
- Flowers: 0.6 to 1.4
- Sprouts: 0.4 to 0.8 (always smaller than flowers)
- Decays: 0.8 to 1.8 (size = diameter)

A valence of -0.8 and +0.8 produce equally large plants — the intensity matters, not the direction.

---

## Emotion → Color Mapping

### Flower Color Application

**1 emotion:** Entire bloom is that color (petals and center)
**2-3 emotions:** Center is primary emotion; petals rotate through all emotions

### Sprout Color Application

**1 emotion:** Entire bud is that color
**2 emotions:** Bud base is primary; stripe is secondary
**3 emotions:** Bud base is primary; two stripes are secondary and tertiary

### Decay Color Application

**1 emotion:** All three layers are that color  
**2 emotions:** Layer 1 (inner) = primary, Layers 2-3 = secondary  
**3 emotions:** Layer 1 = primary, Layer 2 = secondary, Layer 3 = tertiary

### Complete Emotion Color Table

#### Negative Emotions (Vibrant — appear on Flowers)

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

#### Neutral Emotion

| Emotion | Hex Code | Color Name |
|---------|----------|------------|
| Indifferent | #DFFF00 | Chartreuse |

#### Positive Emotions (Muted — appear on Decays)

| Emotion | Hex Code | Color Name |
|---------|----------|------------|
| Content | #9CA3AF | Grey |
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

### Fallback for Missing Emotions

Entries with **no emotions** use:
- Flower/Sprout: White petals/bud (#FFFFFF), bright yellow center (#FFD700)
- Decay: All layers white (#FFFFFF)

---

## Association → Accent Color Mapping

### Flower & Sprout Color Application

**1 association:** Stem and all leaves/cotyledons are that color  
**2 associations:** Stem = primary, leaves/cotyledons = secondary  
**3 associations:** Stem = primary, leaf/cotyledon 1 = secondary, leaf/cotyledon 2 = tertiary

### Decay Color Application

**1 association:** All cracks are that color  
**2-3 associations:** Cracks cycle through association colors

### Complete Association Color Table

| Association | Hex Code | Color Name |
|-------------|----------|------------|
| Self Care | #9DC183 | Sage green |
| Health | #A0522D | Sienna |
| Fitness | #FF69B4 | Hot pink |
| Partner | #FFB6C1 | Light pink |
| Family | #00FF7F | Spring green |
| Friends | #E0FFFF | Light cyan |
| Community | #FFFFFF | White |
| Work | #DAA520 | Goldenrod |
| Tasks | #708090 | Slate gray |
| Identity | #9370DB | Medium purple |
| Hobbies | #B22222 | Firebrick |
| Travel | #FFA500 | Orange |
| Weather | #00BFFF | Deep sky blue |

### Fallback for Missing Associations

Entries with **no associations** use:
- Bright yellow (#FFD700) for stems/leaves/cracks

---

## Ambient Vegetation

**Decision:** Decorative only, not data-driven.

The garden includes ambient vegetation (grass, ground cover, environmental details) to make the space feel like a garden rather than plants floating in a void. This vegetation is purely aesthetic and does not encode any data.

**Implementation:** Phase 4 (Polish & Atmosphere)

---

## Plant Persistence & Fading (Phase 2)

Plants fade over time through:
- **Opacity reduction** (toward transparent)
- **Color desaturation** (toward grey)

### Fading Rate Mechanics

The rate of fading is affected by **garden level** (cumulative emotional state):

- **Matching plants fade slower:** During sustained negative periods, flowers persist longer. During sustained positive periods, decays persist longer.
- **Mismatched plants fade faster:** Flowers fade quickly during positive periods; decays fade quickly during negative periods.

This creates a natural "ecosystem" effect where the dominant mood type accumulates while the opposite type clears out.

### Open Questions (TBD — Phase 2)

The following parameters need to be defined during Phase 2 implementation:

**Base Plant Lifespan:**
- How many days until a plant is fully faded at neutral garden level?
- Options: Fixed window (e.g., 7 days) vs. infinite with asymptotic fade

**Garden Level Calculation:**
- How far back does garden level "look"?
- Options: 
  - Time-windowed (only entries within X days count)
  - Infinite with decay (all entries count, older ones fade in influence)
- The infinite-with-decay approach may be necessary since plants from any point in the timeline need to be capable of appearing when scrubbing to that time

**Garden Level Modifier Strength:**
- How much does garden level speed up or slow down fading?
- This affects how dramatically the "ecosystem" effect manifests

**For Phase 1:** Plants simply exist with no fading. This is acceptable for encoding validation.

---

## Garden Level

Garden level is a cumulative value representing recent emotional weight.

### What Garden Level Controls

1. **Plant fading rates** — Matching plants (flowers during negative periods, decays during positive periods) fade slower; mismatched plants fade faster.

### What Garden Level Does NOT Control

- **Lighting** — Lighting is controlled by Daily Mood entries, not garden level (see below)
- **Plant colors or sizes** — These are determined by individual entry data
- **Ambient vegetation** — Decorative elements are not data-driven

### Calculation (TBD — Phase 2)

The exact calculation method is deferred to Phase 2. The concept:
- Negative valence entries **add** to garden level (toward lush)
- Positive valence entries **subtract** from garden level (toward barren)
- Garden level **decays toward zero** over time

Specific parameters (time window, decay rate, weighting) will be determined during implementation.

---

## Daily Mood & Lighting

Entries with Kind = "Daily Mood" control **scene-wide lighting**:

| Daily Mood Valence | Lighting Effect |
|-------------------|-----------------|
| Negative | Warm, bright, golden hour feel |
| Positive | Cool, overcast, muted |

**Note:** This is separate from garden level. Daily Mood is a specific entry type that sets the lighting atmosphere for that day. Garden level (the cumulative value) does not affect lighting — it only affects plant fading rates.

**Implementation:** Phase 4 (Polish & Atmosphere)

---

## Time Navigation

Users scrub through a timeline covering the full data range. As time position changes:
- Plants appear (with bloom animation) when their timestamp is reached
- Plants fade based on their age and current garden level
- Lighting shifts based on Daily Mood entries
- Garden level updates based on current time position

---

## Interaction Model

### Primary Interactions

1. **Time scrubbing:** Move through time to see the garden evolve
2. **Exploration:** Navigate the 3D space (orbit controls)
3. **Inspection:** Hover/click on plants to see underlying data

### Data Display on Inspection

When a user inspects a plant, show:
- Timestamp (date and time)
- Emotion(s) logged
- Association(s) logged
- Valence value and classification

---

## Build Phases

### Phase 1: Data Pipeline & Basic Spawning
- Parse CSV data into entry objects
- Map entries to DNA objects (FlowerDNA, SproutDNA, DecayDNA)
- Spawn correct component type based on valence classification
- Display ~1 week of data to validate encoding
- Basic orbit camera controls
- **No fading, no garden level** — plants simply exist

**Success criteria:** Plants appear with correct colors and sizes based on data.

### Phase 2: Timeline, Scrubbing & Garden Level
- Timeline UI control
- Plants appear/disappear based on time position
- Garden level calculation
- Plant fading over time
- Garden level affecting fading rates
- **Define open parameters:** base lifespan, garden level window, fade modifier strength

**Success criteria:** Scrubbing through time shows garden evolving with persistence mechanics.

### Phase 3: Spatial Layout
- Determine garden plot size
- Position plants with natural distribution
- Depth layering (foreground/midground/background)
- Prevent excessive overlap

**Success criteria:** Garden looks like a garden, not a pile.

### Phase 4: Polish & Atmosphere
- Daily Mood lighting system
- Ambient vegetation (grass, ground cover)
- Plant inspection UI
- Particle effects (optional)

**Success criteria:** Ready for audience viewing.

---

## Open Parameters (To Tune)

| Parameter | Starting Value | Notes |
|-----------|---------------|-------|
| Flower scale range | 0.6 - 1.4 | |
| Sprout scale range | 0.4 - 0.8 | |
| Decay scale range | 0.8 - 1.8 | |
| Base fade rate | TBD | Phase 2 — How fast plants fade normally |
| Garden level window | TBD | Phase 2 — How far back garden level looks |
| Garden level fade modifier | TBD | Phase 2 — How much garden level affects fade |
| Garden plot size | TBD | Phase 3 — Depends on visual testing |

---

## Technical Reference

### Project Folder Structure

```
/Mood Garden Build/
├── inverse-garden-gdd-v3.2.md        # This document (the spec)
├── inverse-garden-emotion-colors.html # Visual color reference
├── inverse-garden-association-colors.html
├── StateOfMind-2025-10-16-2026-01-14.csv  # The data
├── reference/
│   └── FlowerGen/
│       ├── components/
│       │   ├── Flower3D.tsx    # Negative valence → beautiful bloom
│       │   ├── Sprout3D.tsx    # Neutral valence → bud with cotyledons
│       │   └── Decay3D.tsx     # Positive valence → ground-level scar
│       └── types.ts            # FlowerDNA, SproutDNA, DecayDNA interfaces
└── garden/                     # New project gets built here
```

**The reference components are already built and tested.** Copy them into the new garden project, don't import from the reference folder (you may need to modify them for integration).

### DNA Type Interfaces

```typescript
export interface FlowerDNA {
  name: string;
  description: string;
  petalCount: number;          // 5-12 typical
  petalRows: number;           // 1-3
  petalLength: number;         // 1.5-3.0
  petalWidth: number;          // 0.8-1.5
  petalCurvature: number;      // 0.3-0.8
  petalColors: string[];       // Emotion colors (cycles through)
  centerColor: string;         // Primary emotion color
  stemColors: string[];        // Association colors
  glowIntensity: number;       // 0.5-2.0
  wobbleSpeed: number;         // 0.5-1.2
  scale: number;               // 0.6-1.4 (calculated from valence)
  stemBend: number;            // 0-0.4
  leafCount: number;           // 0-3
  leafSize: number;            // 0.5-1.5
  leafOrientation: number;     // 0-360
  leafAngle: number;           // 0-1
}

export interface SproutDNA {
  name: string;
  description: string;
  
  // Bud (emotions)
  budColor: string;            // Primary emotion
  budStripe2Color: string;     // Secondary emotion (or same as primary)
  budStripe3Color: string;     // Tertiary emotion (or same as primary)
  budSize: number;             // 0.5-1.5
  budPointiness: number;       // 0-1
  
  // Stem (primary association)
  stemColor: string;           // Primary association
  stemHeight: number;          // 0.8-1.5
  stemCurve: number;           // -1 to 1
  stemThickness: number;       // 0.5-1
  
  // Cotyledons (associations 2 & 3)
  cotyledon1Color: string;     // Secondary association
  cotyledon2Color: string;     // Tertiary association
  cotyledonSize: number;       // 0.5-1.5
  
  // Animation
  swaySpeed: number;           // 0.3-1.5
  swayAmount: number;          // 0.1-0.5
  
  scale: number;               // 0.4-0.8 (calculated from valence)
}

export interface DecayDNA {
  name: string;
  description: string;
  
  // Size & Shape
  size: number;                // 0.8-1.8 (calculated from valence)
  aspectRatio: number;         // 0.8-1.2
  edgeWobble: number;          // 0.2-0.5
  
  // Layer Colors (emotions)
  layer1Color: string;         // Primary emotion (innermost)
  layer2Color: string;         // Secondary emotion
  layer3Color: string;         // Tertiary emotion (outermost)
  
  // Crack Configuration
  crackCount: number;          // 4-12
  crackWobble: number;         // 0.2-0.6
  crack1Color: string;         // Primary association
  crack2Color: string;         // Secondary association
  crack3Color: string;         // Tertiary association
}
```

### CSV Data Structure

**File:** `StateOfMind-2025-10-16-2026-01-14.csv`

**Fields:**
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| Start | DateTime | Timestamp with timezone | `2026-01-09 15:34:06 -0500` |
| End | DateTime | Same as Start for point-in-time entries | `2026-01-09 15:34:06 -0500` |
| Kind | String | Entry type | `Momentary Emotion` or `Daily Mood` |
| Labels | Pipe-separated | **Emotions** (this is the emotions field) | `Anxious | Irritated | Sad` |
| Associations | Pipe-separated | Context tags | `Self Care | Health | Identity` |
| Valence | Float | Numeric value (-1 to 1) | `-0.7235772667861566` |
| Valence Classification | String | Apple's classification | `Very Unpleasant` |

**Parsing notes:**
- Labels = Emotions (the CSV uses "Labels" as the column name)
- Labels and Associations may be empty strings
- Pipe separator includes spaces: ` | ` (space, pipe, space)
- Timestamps include timezone offset
- ~308 total entries
- There's a trailing comma after Valence Classification in each row (artifact of export)

**Sample rows:**
```csv
Start,End,Kind,Labels,Associations,Valence,Valence Classification
2026-01-09 15:34:06 -0500,2026-01-09 15:34:06 -0500,Momentary Emotion,Anxious | Irritated | Sad,Self Care | Health | Identity,-0.7235772667861566,Very Unpleasant,
2026-01-07 10:44:27 -0500,2026-01-07 10:44:27 -0500,Momentary Emotion,Indifferent,,0.09349590394555074,Neutral,
2026-01-06 14:25:34 -0500,2026-01-06 14:25:34 -0500,Momentary Emotion,,,0.0,Neutral,
```

### Default Values for Edge Cases

**No emotions, no associations:**
- Component type: Still determined by valence classification
- Flower: petalColors = ["#FFFFFF"], centerColor = "#FFD700", stemColors = ["#FFD700"]
- Sprout: budColor = "#FFFFFF", budStripe2/3 = "#FFFFFF", stemColor = "#FFD700", cotyledonColors = "#FFD700"
- Decay: layer1/2/3Color = "#FFFFFF", crack1/2/3Color = "#FFD700"

**Single emotion with multiple associations (or vice versa):**
- Use the single value for all slots that need it
- e.g., 1 emotion with 3 associations: all petal colors = that emotion, stem/leaves get different association colors

### Recommended Flower Defaults (Visual Sweet Spot)

From testing, these produce good-looking flowers:

```typescript
const FLOWER_DEFAULTS = {
  petalCount: 8,
  petalRows: 2,
  petalLength: 2.5,
  petalWidth: 1.2,
  petalCurvature: 0.5,
  glowIntensity: 1.5,
  wobbleSpeed: 0.8,
  stemBend: 0.2,
  leafCount: 2,
  leafSize: 1.0,
  leafOrientation: 0,
  leafAngle: 0.5,
};
```

### Recommended Sprout Defaults

```typescript
const SPROUT_DEFAULTS = {
  budSize: 1.0,
  budPointiness: 0.5,
  stemHeight: 1.0,
  stemCurve: 0.2,
  stemThickness: 0.8,
  cotyledonSize: 1.0,
  swaySpeed: 0.8,
  swayAmount: 0.3,
};
```

### Recommended Decay Defaults

```typescript
const DECAY_DEFAULTS = {
  aspectRatio: 1.0,
  edgeWobble: 0.3,
  crackCount: 8,
  crackWobble: 0.4,
};
```

---

*This document is the canonical and complete reference for Inverse Garden. It contains all information needed to build the project from scratch.*
