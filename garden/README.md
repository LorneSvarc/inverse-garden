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

- `http://localhost:5173/` - Main garden with timeline
- `http://localhost:5173/?test=vitrine` - Environment test scene (recommended for development)
- `http://localhost:5173/?test=environment` - Legacy environment test
- `http://localhost:5173/playground` - Atmosphere playground

## Architecture

### Environment System (`src/components/environment/`)

The "Specimen Vitrine" environment creates a bounded, exhibit-like space:

| Component | Purpose | Responds To |
|-----------|---------|-------------|
| `SpecimenVitrine.tsx` | Main orchestrator | - |
| `ProceduralSky.tsx` | Gradient sky dome | Time only |
| `TheatricalLighting.tsx` | Sun arc, shadows | Time only |
| `ToonClouds.tsx` | Cloud coverage | Mood (toggleable) |
| `LEDWall.tsx` | Valence text display | Mood |
| `SunMesh.tsx` | Visible sun for god rays | Hour, Mood |
| `PostProcessing.tsx` | Bloom, god rays, vignette | Mood |

### Ground System (`src/components/ExcavatedBed.tsx`)

Two distinct areas:

1. **Soil (inside bed)** - Static brown with texture, no mood response
2. **Floor (outside bed)** - Emissive glow that changes with mood:
   - Negative mood (-1): Sweet yellow-orange glow (`#ff9922`)
   - Neutral (0): Warm amber (`#996633`)
   - Positive mood (+1): Musty dark blue (`#334466`)

### Plant Components

| Component | Valence | Description |
|-----------|---------|-------------|
| `CleanToonFlower3D.tsx` | Negative | Beautiful, vibrant flowers |
| `CleanToonSprout3D.tsx` | Neutral | Growing sprouts |
| `CleanToonDecay3D.tsx` | Positive | Decay patches |

## Controls (Vitrine Test)

- **Time of Day**: Hour slider (affects lighting direction and color)
- **Mood Valence**: -1 to +1 (affects floor glow, clouds, god rays)
- **Clouds**: Toggle on/off
- **Shadows**: Toggle on/off
- **God Rays**: Toggle on/off
- **Post-processing**: Bloom, vignette, fog density

## Design Principles

1. **Inversion is sacred** - Negative = beautiful, positive = muted
2. **Time controls lighting** - Sun position, shadow direction, color temperature
3. **Mood controls atmosphere** - Floor glow, cloud coverage, god ray intensity
4. **Exhibit aesthetic** - Bounded, intentional space with LED wall anchor
5. **Toon shading** - Consistent stylized look across all elements

## Data Flow

```
Timeline scrub → Current entry
                    ↓
         ┌─────────┴─────────┐
         ↓                   ↓
    Entry timestamp     Daily Mood
         ↓                   ↓
    Hour (0-24)        Mood Valence (-1 to +1)
         ↓                   ↓
    - Sky colors         - Floor glow color
    - Sun position       - Cloud coverage
    - Shadow angle       - God ray intensity
    - Light temperature  - Bloom/saturation
```

## File Structure

```
src/
├── components/
│   ├── environment/
│   │   ├── SpecimenVitrine.tsx    # Main environment
│   │   ├── ProceduralSky.tsx      # Time-based sky
│   │   ├── TheatricalLighting.tsx # Time-based lighting
│   │   ├── ToonClouds.tsx         # Mood-based clouds
│   │   ├── LEDWall.tsx            # Valence text display
│   │   ├── SunMesh.tsx            # Visible sun
│   │   └── PostProcessing.tsx     # Effects
│   ├── ExcavatedBed.tsx           # Ground system
│   ├── CleanToonFlower3D.tsx      # Flower component
│   ├── CleanToonSprout3D.tsx      # Sprout component
│   ├── CleanToonDecay3D.tsx       # Decay component
│   └── VitrineTest.tsx            # Test scene
├── utils/
│   ├── dnaMapper.ts               # Entry → plant DNA
│   ├── csvParser.ts               # Mood data parsing
│   └── toonGradient.ts            # Shared toon materials
└── config/
    └── environmentConfig.ts       # Ground bounds, etc.
```

## Tech Stack

- React + TypeScript
- Three.js via React Three Fiber
- @react-three/drei for helpers
- @react-three/postprocessing for effects
- Vite for build
