# Inverse Garden

A data visualization art piece that transforms personal mood tracking data into a 3D garden using React Three Fiber.

## Core Concept

**Inversion**: Negative emotions produce beautiful, lush flowers while positive emotions produce decay and barrenness. Difficult emotional experiences deserve beautiful representation.

## Running the Project

```bash
npm install
npm run dev
```

### Test Modes

- `http://localhost:5173/` — Main garden with full data pipeline and timeline
- `http://localhost:5173/?dev=true` — Main garden with dev panel (parameter overrides)
- `http://localhost:5173/?test=vitrine` — Environment test scene with controls
- `http://localhost:5173/?test=environment` — Legacy environment test (has animation panel)
- `http://localhost:5173/?test=fallenbloom` — Decay parameter tuning
- `http://localhost:5173/playground` — Atmosphere playground

## Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **GDD v4.0** | `docs/inverse-garden-gdd-v4.0.md` | Canonical reference — read first |
| **Final Sprint** | `docs/FINAL-SPRINT.md` | Active tasks — working document |
| Animation Brief | `docs/inverse-garden-animation-brief.md` | Build spec for growth animations |
| Moebius Pass Spec | `docs/inverse-garden-moebius-pass-spec.md` | Build spec for post-processing shader |
| Session History | `TASKS.md` (root) | Archived development log |

## Architecture

### Data Flow

```
CSV → csvParser → percentileCalculator → dnaMapper (cached) → positionCalculator
                                                                      ↓
Timeline scrub → currentTime → ┬→ hour         → Sky, Lighting, Shadows
                               ├→ moodValence  → Clouds, Floor glow, Fog
                               ├→ gardenLevel  → Plant fading rates
                               └→ visiblePlants → Render plants with fade state
```

### Plant Components

| Component | Valence | Material |
|-----------|---------|----------|
| `CleanToonFlower3D.tsx` | Negative | meshToonMaterial |
| `CleanToonSprout3D.tsx` | Neutral | meshToonMaterial |
| `FallenBloom3D.tsx` | Positive | meshToonMaterial (decay gradient) |

### Environment (`src/components/environment/`)

| Component | Responds To |
|-----------|-------------|
| `SpecimenVitrine.tsx` | Orchestrator |
| `ProceduralSky.tsx` | Time |
| `TheatricalLighting.tsx` | Time |
| `ToonClouds.tsx` | Mood |
| `LEDWall.tsx` | Mood + Time |
| `SunMesh.tsx` | Time + Mood |
| `PostProcessing.tsx` | — (bloom disabled, vignette active) |

### Ground (`ExcavatedBed.tsx`)

- **Inside bed**: Static brown soil with texture
- **Outside bed**: Emissive glow responding to mood

## Tech Stack

- React 19 + TypeScript
- Three.js via React Three Fiber
- @react-three/drei for helpers
- @react-three/postprocessing for effects
- Vite for build
