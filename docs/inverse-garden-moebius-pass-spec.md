# Inverse Garden: Post-Processing Visual Pass

## Implementation Spec for Claude Code

**Version:** 1.0
**Status:** Ready to build — First task in the Final Sprint (shader decision point B1)
**Approach:** Implement Maxime Heckel's Moebius-style post-processing pass, then adapt for Inverse Garden
**Note:** This is an exploration with a hard exit. If after implementation the visual result is clearly wrong or fights the emotion colors, revert. See `docs/FINAL-SPRINT.md` for decision criteria and sequencing.

---

## Strategy

We are implementing a proven, working post-processing pass based on Maxime Heckel's Moebius-style shader (https://blog.maximeheckel.com/posts/moebius-style-post-processing/). This pass has been battle-tested in React Three Fiber and transforms an entire scene through image-space filtering.

**Why this approach:** We've spent months trying to achieve visual quality through material-level changes (toon shading, lighting, fog, atmosphere). None of it elevated the scene past "generic 3D." Post-processing operates on the rendered image as a whole, creating unified visual identity across every element in the scene simultaneously.

**The plan:**
1. Implement Heckel's Moebius pass close to verbatim
2. Get it running on our actual scene
3. See how it looks with our procedural flowers
4. Adapt the artistic elements to serve Inverse Garden specifically

Do NOT try to invent a custom artistic direction during implementation. Get the proven thing working first.

---

## Step 0: Revert Materials to Standard PBR

**Before building the post-processing pass**, swap all toon materials back to standard materials.

The existing codebase uses `meshToonMaterial` with a custom `getToonGradient()` utility across the plant components. The toon shading was an earlier attempt to achieve the same goal this pass addresses. With the pass handling all stylistic work, toon materials conflict — they pre-quantize colors and create banding that fights with the pass's own shadow treatment.

**What to change:**
- In all flower/sprout/decay components: replace `meshToonMaterial` with `meshStandardMaterial`
- Remove `gradientMap={gradientMap}` props
- Keep all color values (`color`, `emissive` if used) exactly as they are
- The `getToonGradient.ts` utility file can stay but shouldn't be imported by anything
- Do NOT change any geometry, positioning, scale, or color mapping logic

**What standard materials need:**
- Same `color` prop values (these are the data-encoded emotion/association colors — don't touch them)
- Add `roughness={0.7}` and `metalness={0.1}` as reasonable defaults for organic-looking plants
- Keep `transparent` and `opacity` props if they exist (used for fading system)

**Validation:** The scene should look like a normal PBR-rendered garden. Smooth gradients, realistic-ish lighting. It will look MORE generic than the toon version temporarily. That's fine — the pass will transform it.

---

## Step 1: Scaffold the Custom Pass

### Architecture

The pass extends `Pass` from the `postprocessing` package and uses `drei`'s `Effects` component for R3F integration. This is NOT using `@react-three/postprocessing`'s `EffectComposer` — custom passes require the drei approach.

### File Structure

```
src/
  postprocessing/
    InverseGardenPass.ts        // The Pass class + shader
    StylizedRenderer.tsx        // R3F component wiring it together
```

### Skeleton Pass Class

```typescript
// src/postprocessing/InverseGardenPass.ts

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'postprocessing';

// For FullScreenQuad, if 'postprocessing' doesn't export it, 
// import from 'three-stdlib' instead:
// import { FullScreenQuad } from 'three-stdlib';

const inverseGardenShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    tNormal: { value: null },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 100 },
    resolution: { value: new THREE.Vector2(1, 1) },
    outlineColor: { value: new THREE.Vector4(0.0, 0.0, 0.0, 1.0) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    // START WITH A SIMPLE TEST — just tint the scene red
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    
    void main() {
      vec2 uv = vUv;
      vec4 color = texture2D(tDiffuse, uv);
      gl_FragColor = vec4(color.r + 0.2, color.g, color.b, color.a);
    }
  `,
};

class InverseGardenPass extends Pass {
  material: THREE.ShaderMaterial;
  fsQuad: FullScreenQuad;

  constructor(args: {
    depthRenderTarget: THREE.WebGLRenderTarget;
    normalRenderTarget: THREE.WebGLRenderTarget;
    camera: THREE.Camera;
    resolution: THREE.Vector2;
  }) {
    super();

    this.material = new THREE.ShaderMaterial(inverseGardenShader);
    this.fsQuad = new FullScreenQuad(this.material);

    // Store references for updating uniforms
    const { camera, resolution } = args;
    this.material.uniforms.cameraNear.value = (camera as THREE.PerspectiveCamera).near;
    this.material.uniforms.cameraFar.value = (camera as THREE.PerspectiveCamera).far;
    this.material.uniforms.resolution.value = resolution;
  }

  dispose() {
    this.material.dispose();
    this.fsQuad.dispose();
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ) {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    }
  }
}

export { InverseGardenPass };
```

### R3F Integration Component

```tsx
// src/postprocessing/StylizedRenderer.tsx

import { useRef, useMemo } from 'react';
import { extend, useThree, useFrame } from '@react-three/fiber';
import { Effects, useFBO } from '@react-three/drei';
import * as THREE from 'three';
import { InverseGardenPass } from './InverseGardenPass';

// Extend R3F's namespace so JSX recognizes the pass
extend({ InverseGardenPass });

// Declare the JSX type (TypeScript)
declare global {
  namespace JSX {
    interface IntrinsicElements {
      inverseGardenPass: any;
    }
  }
}

export function StylizedRenderer() {
  const { camera, size } = useThree();
  const passRef = useRef<any>();

  // Depth render target
  const depthTexture = useMemo(
    () => new THREE.DepthTexture(size.width, size.height),
    [size.width, size.height]
  );

  const depthRenderTarget = useFBO(size.width, size.height, {
    depthTexture,
    depthBuffer: true,
  });

  // Normal render target
  const normalRenderTarget = useFBO(size.width, size.height);

  // Custom normal material for the normal pass
  const normalMaterial = useMemo(() => new THREE.MeshNormalMaterial(), []);

  useFrame((state) => {
    const { gl, scene, camera } = state;

    // 1. Render depth
    gl.setRenderTarget(depthRenderTarget);
    gl.render(scene, camera);

    // 2. Render normals (override all materials temporarily)
    const originalMaterial = scene.overrideMaterial;
    gl.setRenderTarget(normalRenderTarget);
    scene.matrixWorldNeedsUpdate = true;
    scene.overrideMaterial = normalMaterial;
    gl.render(scene, camera);
    scene.overrideMaterial = originalMaterial;

    // 3. Reset render target
    gl.setRenderTarget(null);

    // 4. Update pass uniforms
    if (passRef.current) {
      passRef.current.material.uniforms.tDepth.value = depthRenderTarget.depthTexture;
      passRef.current.material.uniforms.tNormal.value = normalRenderTarget.texture;
    }
  });

  const resolution = useMemo(
    () => new THREE.Vector2(size.width, size.height),
    [size.width, size.height]
  );

  return (
    <Effects>
      <inverseGardenPass
        ref={passRef}
        args={[
          {
            depthRenderTarget,
            normalRenderTarget,
            camera,
            resolution,
          },
        ]}
      />
    </Effects>
  );
}
```

### Validation

Add `<StylizedRenderer />` as a child of your Canvas (alongside the scene content). The scene should render with a red tint. If it does, the pipeline works. If it doesn't, fix this before proceeding.

---

## Step 2: Edge Detection — Outlines

Replace the test fragment shader with the full Sobel filter implementation. This is the core of the Moebius look.

### Complete Fragment Shader with Outlines

```glsl
#include <packing>

varying vec2 vUv;

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform float cameraNear;
uniform float cameraFar;
uniform vec2 resolution;
uniform vec4 outlineColor;

// --- Depth reading ---
float readDepth(sampler2D depthTexture, vec2 coord) {
  float fragCoordZ = texture2D(depthTexture, coord).x;
  float viewZ = perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);
  return viewZToOrthographicDepth(viewZ, cameraNear, cameraFar);
}

// --- Luminance ---
float luma(vec3 color) {
  const vec3 magic = vec3(0.2125, 0.7154, 0.0721);
  return dot(magic, color);
}

// --- Hash for hand-drawn wobble ---
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// --- Sobel matrices ---
const mat3 Sx = mat3(-1, -2, -1, 0, 0, 0, 1, 2, 1);
const mat3 Sy = mat3(-1, 0, 1, -2, 0, 2, -1, 0, 1);

void main() {
  vec2 texel = vec2(1.0 / resolution.x, 1.0 / resolution.y);
  float outlineThickness = 1.0; // Heckel uses 1.0-3.0
  vec4 pixelColor = texture2D(tDiffuse, vUv);

  // --- Hand-drawn displacement ---
  float frequency = 0.08;
  float amplitude = 2.0;
  vec2 displacement = vec2(
    (hash(gl_FragCoord.xy) * sin(gl_FragCoord.y * frequency)),
    (hash(gl_FragCoord.xy) * cos(gl_FragCoord.x * frequency))
  ) * amplitude / resolution.xy;

  // --- Sobel on DEPTH buffer ---
  float depth00 = readDepth(tDepth, vUv + displacement + outlineThickness * texel * vec2(-1, 1));
  float depth01 = readDepth(tDepth, vUv + displacement + outlineThickness * texel * vec2(-1, 0));
  float depth02 = readDepth(tDepth, vUv + displacement + outlineThickness * texel * vec2(-1, -1));
  
  float depth10 = readDepth(tDepth, vUv + displacement + outlineThickness * texel * vec2(0, -1));
  float depth11 = readDepth(tDepth, vUv + displacement + outlineThickness * texel * vec2(0, 0));
  float depth12 = readDepth(tDepth, vUv + displacement + outlineThickness * texel * vec2(0, 1));
  
  float depth20 = readDepth(tDepth, vUv + displacement + outlineThickness * texel * vec2(1, -1));
  float depth21 = readDepth(tDepth, vUv + displacement + outlineThickness * texel * vec2(1, 0));
  float depth22 = readDepth(tDepth, vUv + displacement + outlineThickness * texel * vec2(1, 1));
  
  float xSobelDepth = 
    Sx[0][0] * depth00 + Sx[1][0] * depth01 + Sx[2][0] * depth02 +
    Sx[0][1] * depth10 + Sx[1][1] * depth11 + Sx[2][1] * depth12 +
    Sx[0][2] * depth20 + Sx[1][2] * depth21 + Sx[2][2] * depth22;
    
  float ySobelDepth = 
    Sy[0][0] * depth00 + Sy[1][0] * depth01 + Sy[2][0] * depth02 +
    Sy[0][1] * depth10 + Sy[1][1] * depth11 + Sy[2][1] * depth12 +
    Sy[0][2] * depth20 + Sy[1][2] * depth21 + Sy[2][2] * depth22;
    
  float gradientDepth = sqrt(pow(xSobelDepth, 2.0) + pow(ySobelDepth, 2.0));

  // --- Sobel on NORMAL buffer ---
  float normal00 = luma(texture2D(tNormal, vUv + displacement + outlineThickness * texel * vec2(-1, -1)).rgb);
  float normal01 = luma(texture2D(tNormal, vUv + displacement + outlineThickness * texel * vec2(-1, 0)).rgb);
  float normal02 = luma(texture2D(tNormal, vUv + displacement + outlineThickness * texel * vec2(-1, 1)).rgb);
  
  float normal10 = luma(texture2D(tNormal, vUv + displacement + outlineThickness * texel * vec2(0, -1)).rgb);
  float normal11 = luma(texture2D(tNormal, vUv + displacement + outlineThickness * texel * vec2(0, 0)).rgb);
  float normal12 = luma(texture2D(tNormal, vUv + displacement + outlineThickness * texel * vec2(0, 1)).rgb);
  
  float normal20 = luma(texture2D(tNormal, vUv + displacement + outlineThickness * texel * vec2(1, -1)).rgb);
  float normal21 = luma(texture2D(tNormal, vUv + displacement + outlineThickness * texel * vec2(1, 0)).rgb);
  float normal22 = luma(texture2D(tNormal, vUv + displacement + outlineThickness * texel * vec2(1, 1)).rgb);

  float xSobelNormal =
    Sx[0][0] * normal00 + Sx[1][0] * normal10 + Sx[2][0] * normal20 +
    Sx[0][1] * normal01 + Sx[1][1] * normal11 + Sx[2][1] * normal21 +
    Sx[0][2] * normal02 + Sx[1][2] * normal12 + Sx[2][2] * normal22;

  float ySobelNormal =
    Sy[0][0] * normal00 + Sy[1][0] * normal10 + Sy[2][0] * normal20 +
    Sy[0][1] * normal01 + Sy[1][1] * normal11 + Sy[2][1] * normal21 +
    Sy[0][2] * normal02 + Sy[1][2] * normal12 + Sy[2][2] * normal22;

  float gradientNormal = sqrt(pow(xSobelNormal, 2.0) + pow(ySobelNormal, 2.0));

  // --- Combine edges ---
  // Depth gradient needs more weight to catch silhouettes
  float outline = gradientDepth * 25.0 + gradientNormal;
  outline = clamp(outline, 0.0, 1.0);

  // --- Apply outline ---
  vec4 color = mix(pixelColor, outlineColor, outline);
  
  gl_FragColor = color;
}
```

### Validation

The scene should now have black outlines around every object — flowers, stems, ground edges. The outlines should look slightly wobbly/hand-drawn due to the hash displacement. If outlines are missing or too faint, increase `outlineThickness` or the depth weight multiplier (the `25.0`).

---

## Step 3: Crosshatched Shadows

This is the most distinctively "Moebius" element. Add the shadow pattern code AFTER the outline calculation, BEFORE applying the outline overlay.

### Add to Fragment Shader (before the outline mix)

```glsl
  // --- Crosshatched shadows ---
  float pixelLuma = luma(pixelColor.rgb);
  float depth = readDepth(tDepth, vUv);
  float modVal = 8.0; // Stripe spacing in pixels

  // Darkest shadows: add horizontal stripes
  if (pixelLuma <= 0.35 && depth <= 0.99) {
    if (mod((vUv.y + displacement.y) * resolution.y, modVal) < 1.0) {
      pixelColor = outlineColor;
    }
  }
  
  // Medium shadows: add vertical stripes
  if (pixelLuma <= 0.55 && depth <= 0.99) {
    if (mod((vUv.x + displacement.x) * resolution.x, modVal) < 1.0) {
      pixelColor = outlineColor;
    }
  }
  
  // Lightest shadows: add diagonal stripes
  if (pixelLuma <= 0.80 && depth <= 0.99) {
    if (mod(
      (vUv.x + displacement.x) * resolution.y + (vUv.y + displacement.y) * resolution.x, 
      modVal
    ) <= 1.0) {
      pixelColor = outlineColor;
    }
  }
  
  // THEN apply the outline on top of the shadow-patterned colors
  vec4 color = mix(pixelColor, outlineColor, outline);
  gl_FragColor = color;
```

### Key Details

- The `depth <= 0.99` check prevents the shadow pattern from applying to the background/sky (which has depth ~1.0)
- The `displacement` reuse means shadow stripes have the same hand-drawn wobble as the outlines — this is intentional and creates visual consistency
- `modVal = 8.0` means stripes every 8 pixels. Adjust if too dense or too sparse on your screen resolution
- The three thresholds (0.35, 0.55, 0.80) layer progressively: darkest areas get all three patterns (cross-hatch), medium shadows get two (cross), lightest shadows get one (diagonal only)

### Validation

Shadow areas on flowers and ground should now show crosshatched line patterns instead of smooth gradients. The pattern should be denser in darker areas. If the whole scene is covered in lines, the luma thresholds are too high. If no lines appear, they're too low, or the scene is too bright.

---

## Step 4: Specular Highlights (Optional but Recommended)

In Heckel's implementation, specular highlights are rendered as flat white dots with outlines around them. This is achieved by modifying the normal material to include Blinn-Phong specular calculations.

### Custom Normal Material with Specular

Instead of plain `THREE.MeshNormalMaterial`, use a custom shader material for the normal pass:

```typescript
const CustomNormalMaterial = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    uniform vec3 lightPosition;
    
    void main() {
      vec3 normal = normalize(vNormal);
      
      // Blinn-Phong specular
      vec3 viewDir = normalize(vViewPosition);
      vec3 lightDir = normalize(lightPosition);
      vec3 halfDir = normalize(lightDir + viewDir);
      float specular = pow(max(dot(normal, halfDir), 0.0), 100.0); // High shininess = small dot
      
      // If specular is strong enough, output white (will be caught by Sobel as an edge)
      if (specular > 0.5) {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White specular dot
      } else {
        gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0); // Normal colors
      }
    }
  `,
  uniforms: {
    lightPosition: { value: new THREE.Vector3(10, 10, 10) }, // Match your scene's light
  },
});
```

**Why this works:** The white specular dots in the normal buffer create a sharp contrast that the Sobel filter detects as an edge. So the specular automatically gets an outline around it, creating the classic Moebius "dot with a circle" specular look.

### Update the StylizedRenderer

Replace `new THREE.MeshNormalMaterial()` with this `CustomNormalMaterial` and make sure to update `lightPosition` uniform to match your directional light's position.

---

## Step 5: Wire Up Uniforms for Live Tuning

Add uniforms for all tunable parameters so they can be controlled via a UI panel (leva, dat.gui, or whatever exists in the project).

### Add These Uniforms to the Shader

```typescript
uniforms: {
  tDiffuse: { value: null },
  tDepth: { value: null },
  tNormal: { value: null },
  cameraNear: { value: 0.1 },
  cameraFar: { value: 100 },
  resolution: { value: new THREE.Vector2(1, 1) },
  outlineColor: { value: new THREE.Vector4(0.0, 0.0, 0.0, 1.0) },
  outlineThickness: { value: 1.0 },
  depthMultiplier: { value: 25.0 },
  frequency: { value: 0.08 },
  amplitude: { value: 2.0 },
  shadowModVal: { value: 8.0 },
  shadowThreshold1: { value: 0.35 },
  shadowThreshold2: { value: 0.55 },
  shadowThreshold3: { value: 0.80 },
}
```

### Expose Controls

| Parameter | Starting Value | What It Does |
|-----------|---------------|--------------|
| `outlineThickness` | 1.0 | Width of edge lines (try 1.0 – 3.0) |
| `outlineColor` | black (0,0,0,1) | Color of all lines and shadow stripes |
| `depthMultiplier` | 25.0 | How strongly depth edges contribute (try 10 – 50) |
| `frequency` | 0.08 | Wobble frequency — lower = smoother waves |
| `amplitude` | 2.0 | Wobble strength — higher = more hand-drawn |
| `shadowModVal` | 8.0 | Stripe spacing — lower = denser hatching |
| `shadowThreshold1` | 0.35 | Darkest shadow threshold |
| `shadowThreshold2` | 0.55 | Medium shadow threshold |
| `shadowThreshold3` | 0.80 | Lightest shadow threshold |

### Toggle

Add a boolean that enables/disables the pass entirely. This is essential for comparing before/after:

```tsx
// In your scene component
const [stylizeEnabled, setStylizeEnabled] = useState(true);

// Conditionally render
{stylizeEnabled && <StylizedRenderer />}
```

---

## Important Implementation Notes

### Package Dependencies

You need:
- `postprocessing` — for the `Pass` base class
- `three-stdlib` — for `FullScreenQuad` (if not exported by `postprocessing`)
- `@react-three/drei` — for `Effects` component and `useFBO` hook

Check what's already installed. `drei` and `three` are almost certainly there. `postprocessing` might need installing:
```bash
npm install postprocessing
```

If `three-stdlib` isn't installed and `FullScreenQuad` isn't available from `postprocessing`:
```bash
npm install three-stdlib
```

### drei Effects vs postprocessing EffectComposer

**Use `Effects` from `@react-three/drei`**, NOT `EffectComposer` from `@react-three/postprocessing`. They work differently:

- `drei`'s `Effects` wraps Three.js's vanilla `EffectComposer` and supports custom `Pass` objects
- `@react-three/postprocessing`'s `EffectComposer` is built for the `postprocessing` library's `Effect` system, which does NOT support custom passes

If drei's `Effects` gives trouble (it can be finicky with newer versions), the fallback is to set up Three.js's `EffectComposer` manually:

```typescript
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
```

### Disable Existing Post-Processing

If the scene currently has ANY post-processing (bloom, hue-saturation, brightness-contrast, etc.), disable or remove it before adding this pass. Only one post-processing pipeline should be active.

### The scene.overrideMaterial Gotcha

When rendering the normal pass, `scene.overrideMaterial` replaces ALL materials in the scene temporarily. This is correct behavior. But make sure to restore the original material immediately after:

```typescript
const original = scene.overrideMaterial;
scene.overrideMaterial = normalMaterial;
gl.render(scene, camera);
scene.overrideMaterial = original; // RESTORE immediately
```

If you forget to restore, the whole scene renders as rainbow normal colors.

### Performance

This approach renders the scene THREE times per frame:
1. Normal render (for the diffuse/color output)
2. Depth render
3. Normal material render

This is fine for a web art piece. If performance becomes an issue later, the depth and normal passes can be optimized (e.g., lower resolution render targets), but don't optimize prematurely.

---

## What NOT To Do

- **Don't modify plant component geometry or color logic.** The pass operates on the rendered image.
- **Don't invent new artistic effects during implementation.** Get Heckel's proven approach working first.
- **Don't start with subtle parameter values.** Use Heckel's starting values. We can refine later.
- **Don't use `@react-three/postprocessing`'s EffectComposer.** Use drei's `Effects` or vanilla Three.js.
- **Don't skip the red-tint test in Step 1.** If the pipeline doesn't work, nothing else matters.

---

## After It's Working: Adaptation Notes

Once the Moebius pass is running on the Inverse Garden scene, we'll evaluate what to keep, modify, or replace. These are the likely adaptation points — but do NOT implement these during the initial build:

- **Outline color:** Moebius uses black. We might shift to dark warm brown.
- **Shadow treatment:** Crosshatching is distinctly Moebius. We might swap for flat color zones, color-shifted shadows, or keep crosshatching if it works with the flowers.
- **Shadow luma thresholds:** Will almost certainly need tuning for our scene's specific lighting.
- **Specular:** The white dot style might work beautifully on flower petals, or it might be too much. Will evaluate.
- **Wobble intensity:** The hand-drawn wiggle might need to be more or less pronounced for our aesthetic.
- **Additional effects:** We might add posterization, saturation boost, or vignette ON TOP of the Moebius base if needed.

But all of that comes AFTER we see the proven pass running on our actual geometry.

---

## Success Criteria

1. **Step 1:** Scene renders with a red tint → pipeline works
2. **Step 2:** Bold outlines visible on all objects with hand-drawn wobble
3. **Step 3:** Crosshatched shadow patterns in dark areas
4. **Step 4:** (Optional) White specular dots with outlines on shiny surfaces
5. **Step 5:** All parameters adjustable via UI controls
6. **Overall:** Toggling the pass on/off produces a DRAMATIC visual difference

The scene should look recognizably Moebius-inspired. Not identical to Heckel's demo (different geometry, different colors), but unmistakably the same technique. From there, we adapt.

---

## Reference

- **Primary source:** https://blog.maximeheckel.com/posts/moebius-style-post-processing/
- **Video source Heckel studied:** https://www.youtube.com/watch?v=jlKNOirh66E (UselessGameDev's Moebius-style 3D Rendering in Unity)
- **Sketchy pencil alternative approach:** https://tympanus.net/codrops/2022/11/29/sketchy-pencil-effect-with-three-js-post-processing/
- **drei Effects docs:** https://github.com/pmndrs/drei#effects
