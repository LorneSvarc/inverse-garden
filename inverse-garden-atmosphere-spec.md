# Inverse Garden: Atmosphere & Lighting Spec

## Document Information

**Version:** 0.2 (Revised after research)  
**Status:** Implementation-ready foundation  
**Parent Document:** inverse-garden-gdd-v3.1.md  
**Purpose:** Provide a minimal, proven lighting system that works

---

## Design Goals

1. **Ground the user in time** — Sun position reflects actual time of day from entries
2. **Communicate emotional state** — Post-processing shifts based on garden level
3. **Honor the inversion** — Negative emotions feel warm, alive, beautiful; positive emotions feel cool, muted, empty
4. **Actually work** — Use proven R3F patterns, not theoretical specs

---

## Critical Implementation Notes

These are lessons from research that MUST be followed:

### Light Intensity Values (Three.js r155+)
Modern Three.js changed how light intensity works. Use these ranges:
- `directionalLight`: intensity = `Math.PI` to `Math.PI * 2` for normal daylight
- `ambientLight`: intensity = `0.5` to `1.5`
- Old tutorials showing `intensity={1}` are outdated

### Shadows Require All Three Pieces
For shadows to appear, ALL of these must be set:
```jsx
// 1. On the Canvas
<Canvas shadows>

// 2. On the light
<directionalLight castShadow shadow-mapSize={[2048, 2048]} />

// 3. On meshes that cast shadows
<mesh castShadow>

// 4. On meshes that receive shadows  
<mesh receiveShadow>
```

### Fog Bug Workaround (React 19)
Fog doesn't initialize properly with declarative syntax. Use imperative setup:
```jsx
const { scene } = useThree();
useLayoutEffect(() => {
  scene.fog = new THREE.Fog(fogColor, near, far);
}, [fogColor, near, far]);
```

---

## Phase 1: Foundation (Implement First)

Get these working and visually verified before adding anything else.

### 1A. Sky + Sun System

Use drei's `<Sky>` component paired with a matching directional light.

```jsx
import { Sky } from '@react-three/drei'

// Sky provides the visual sky dome with atmospheric scattering
<Sky
  sunPosition={sunPosition}  // [x, y, z] - calculated from time
  turbidity={8}              // 0-20, haziness of atmosphere
  rayleigh={0.5}             // 0-4, how blue the sky is
  mieCoefficient={0.005}     // sun disk size
  mieDirectionalG={0.7}      // sun glow
/>

// Directional light must match sun position for coherent shadows
<directionalLight
  position={sunPosition}
  intensity={sunIntensity}   // Math.PI to Math.PI * 2
  color={sunColor}
  castShadow
  shadow-mapSize={[2048, 2048]}
  shadow-camera-far={50}
  shadow-camera-left={-10}
  shadow-camera-right={10}
  shadow-camera-top={10}
  shadow-camera-bottom={-10}
/>
```

**Sun Position Calculation:**
```typescript
function getSunPosition(hour: number): [number, number, number] {
  // hour is 0-24
  // Sun rises in east (+x), arcs overhead (+y), sets in west (-x)
  
  const dayProgress = (hour - 6) / 12; // 0 at 6am, 1 at 6pm
  const angle = dayProgress * Math.PI;  // 0 to PI
  
  const x = Math.cos(angle) * 100;
  const y = Math.sin(angle) * 100;
  const z = 50;
  
  // Clamp y to handle night (sun below horizon)
  return [x, Math.max(y, -20), z];
}
```

**Sun Intensity by Time:**
| Time | Intensity | Color |
|------|-----------|-------|
| 6am-8am | `Math.PI * 0.8` | Warm `#fff5e0` |
| 8am-5pm | `Math.PI * 1.5` | Neutral `#ffffff` |
| 5pm-7pm | `Math.PI * 1.2` | Warm `#ffcc88` |
| 7pm-8pm | `Math.PI * 0.5` | Orange `#ff9955` |
| 8pm-6am | `Math.PI * 0.1` | Blue `#aabbff` (moonlight) |

### 1B. Ambient Fill Light

Provides base illumination so shadows aren't pure black.

```jsx
<ambientLight intensity={0.5} color="#ffffff" />

// OR use hemisphere light for more natural outdoor feel
<hemisphereLight
  args={[
    '#87CEEB',  // sky color (top)
    '#362312',  // ground color (bottom) 
    0.6         // intensity
  ]}
/>
```

### 1C. Ground Plane with Shadows

```jsx
<mesh 
  rotation={[-Math.PI / 2, 0, 0]} 
  position={[0, 0, 0]} 
  receiveShadow
>
  <circleGeometry args={[15, 64]} />
  <meshStandardMaterial color="#3d2817" roughness={0.9} />
</mesh>
```

### 1D. Flower Shadow Setup

Every flower mesh needs `castShadow`:
```jsx
// In Flower3D component, on each mesh:
<mesh castShadow>
  <sphereGeometry ... />
  <meshStandardMaterial ... />
</mesh>
```

---

## Phase 1 Validation Checklist

Before proceeding to Phase 2, confirm ALL of these:

- [ ] Sky is visible and changes color based on sun position
- [ ] Moving sun position changes where shadows fall
- [ ] Shadows are actually visible on the ground
- [ ] Flowers cast shadows
- [ ] 6am looks like morning, noon looks bright, 8pm looks like dusk
- [ ] Night (10pm) is dark but not black

**If any of these fail, stop and fix before continuing.**

---

## Phase 2: Emotional Color Grading

Only implement after Phase 1 is fully working.

### 2A. Post-Processing Setup

```jsx
import { EffectComposer, HueSaturation, BrightnessContrast } from '@react-three/postprocessing'

<EffectComposer>
  <HueSaturation
    hue={hueShift}           // -Math.PI to Math.PI
    saturation={saturation}  // -1 to 1
  />
  <BrightnessContrast
    brightness={brightness}  // -1 to 1
    contrast={contrast}      // -1 to 1
  />
</EffectComposer>
```

### 2B. Garden Level → Post-Processing Values

**Garden Level:** 0 = positive (cool/muted) → 1 = negative (warm/vivid)

```typescript
function getPostProcessingValues(gardenLevel: number) {
  return {
    // Hue: shift toward warm (positive value) for negative emotions
    hue: gardenLevel * 0.15,  // 0 to 0.15 radians toward orange
    
    // Saturation: more vivid for negative
    saturation: -0.2 + (gardenLevel * 0.4),  // -0.2 to +0.2
    
    // Brightness: slightly brighter for negative
    brightness: -0.05 + (gardenLevel * 0.1),  // -0.05 to +0.05
    
    // Contrast: slightly higher for negative
    contrast: gardenLevel * 0.1,  // 0 to 0.1
  };
}
```

**Start with SUBTLE values.** These can be increased once working.

### 2C. Bloom (Optional Enhancement)

```jsx
import { Bloom } from '@react-three/postprocessing'

<EffectComposer>
  {/* ... other effects ... */}
  <Bloom
    intensity={0.5 + gardenLevel * 0.5}  // 0.5 to 1.0
    luminanceThreshold={0.8}              // Only bloom bright areas
    luminanceSmoothing={0.9}
  />
</EffectComposer>
```

---

## Phase 2 Validation Checklist

- [ ] Moving garden level slider visibly changes scene warmth
- [ ] Garden level 0 (positive) looks cool/muted
- [ ] Garden level 1 (negative) looks warm/vivid
- [ ] The shift is noticeable but not garish
- [ ] Bloom makes bright flowers glow slightly (if implemented)

---

## Phase 3: Flower Emissive (Night Enhancement)

Only implement after Phase 2 is working.

### 3A. Dynamic Emissive on Flower Materials

```jsx
// In flower material:
<meshStandardMaterial
  color={petalColor}
  emissive={petalColor}
  emissiveIntensity={emissiveIntensity}  // 0 to 0.5
/>
```

### 3B. Emissive Calculation

```typescript
function getFlowerEmissive(gardenLevel: number, hour: number): number {
  const isNight = hour < 6 || hour > 20;
  const isDusk = hour > 18 && hour <= 20;
  
  if (isNight) {
    // At night, negative emotions make flowers glow
    return gardenLevel * 0.4;  // 0 to 0.4
  } else if (isDusk) {
    // At dusk, subtle glow begins
    return gardenLevel * 0.15;
  } else {
    // Daytime: minimal emissive
    return gardenLevel * 0.05;
  }
}
```

---

## Phase 3 Validation Checklist

- [ ] At night with high garden level, flowers visibly glow
- [ ] At night with low garden level, flowers are dark shapes
- [ ] Daytime flowers don't look weirdly luminous

---

## Phase 4: Fog (Optional)

Fog adds atmosphere but has a known React 19 bug. Only add if earlier phases are solid.

### 4A. Fog Setup (Imperative)

```jsx
function FogController({ gardenLevel, enabled }) {
  const { scene } = useThree();
  
  useLayoutEffect(() => {
    if (!enabled) {
      scene.fog = null;
      return;
    }
    
    // Interpolate fog color based on garden level
    const coolFog = new THREE.Color('#2a2a3a');
    const warmFog = new THREE.Color('#3a2820');
    const fogColor = coolFog.clone().lerp(warmFog, gardenLevel);
    
    // Fog density: more fog for negative emotions
    const near = 15 - (gardenLevel * 5);   // 15 to 10
    const far = 40 - (gardenLevel * 10);   // 40 to 30
    
    scene.fog = new THREE.Fog(fogColor, near, far);
    scene.background = fogColor;  // Match background to fog
    
  }, [scene, gardenLevel, enabled]);
  
  return null;
}
```

---

## What NOT to Implement (Yet)

These were in the original spec but should wait until foundation is solid:

- ❌ Particles / dust motes / fireflies
- ❌ Ground fog (separate from distance fog)
- ❌ Vignette
- ❌ Depth of field
- ❌ LUT-based color grading (use HueSaturation instead)
- ❌ Multiple HDRIs with blending

These can be added later as polish once the core system is working.

---

## Control Panel for Testing

The playground should have these controls, in this order:

### Time Controls
- Time of day slider (0-24 hours)
- "Link sun to time" toggle (auto-calculate sun position)

### Lighting Controls  
- Sun position manual override (if not linked to time)
- Sun intensity multiplier (0.5x to 2x)

### Emotion Controls
- Garden level slider (0-1)
- "Link post-processing to garden level" toggle

### Post-Processing Controls (if not linked)
- Hue shift (-0.3 to 0.3)
- Saturation (-0.5 to 0.5)
- Brightness (-0.2 to 0.2)
- Bloom intensity (0 to 1.5)

### Feature Toggles
- Shadows on/off
- Bloom on/off
- Fog on/off
- Flower emissive on/off

### Presets
Quick buttons to test specific scenarios:
- "Negative Noon" — 12pm, garden level 1.0
- "Positive Noon" — 12pm, garden level 0.0
- "Negative Night" — 10pm, garden level 1.0
- "Positive Night" — 10pm, garden level 0.0
- "Sunrise Anxious" — 7am, garden level 0.8
- "Dusk Content" — 7pm, garden level 0.2

---

## Alternative Approaches (If This Doesn't Work)

If after implementing all phases the visual quality isn't sufficient:

1. **HDRI Environments** — Use drei's `<Environment>` with preset HDRIs for richer ambient lighting. Can blend/swap between warm and cool HDRIs.

2. **HDRI + Sky Hybrid** — Use HDRI for ambient/reflections, Sky component for visible sun/sky.

3. **LUT Color Grading** — More cinematic control than HueSaturation, but requires creating/sourcing LUT files.

4. **Volumetric Lighting** — God rays through fog. Beautiful but performance-intensive.

5. **Custom Shaders** — Full control but significant implementation effort.

---

## Summary: Implementation Order

1. **Sky + Sun + Shadows** — Get a visible sun that casts real shadows
2. **Verify it works** — Stop here until shadows are visible
3. **Post-processing color grade** — Warm/cool shift based on garden level
4. **Verify it works** — Stop here until color shift is visible
5. **Flower emissive** — Night glow for negative emotions
6. **Fog** — Optional atmosphere layer
7. **Polish** — Tune values, add bloom, refine

Each phase must be validated before proceeding to the next.

---

*This document prioritizes working code over comprehensive features. Get the foundation right first.*
