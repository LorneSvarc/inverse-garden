import * as THREE from 'three';

/**
 * Creates a 4-step gradient texture for cel/toon shading
 * Used with meshToonMaterial's gradientMap property
 */
function createToonGradientTexture(): THREE.DataTexture {
  const colors = new Uint8Array([
    64, 64, 64, 255,    // Dark band
    128, 128, 128, 255, // Mid band
    200, 200, 200, 255, // Light band
    210, 210, 210, 255, // Highlight band (was 255 — pure white washed out plant colors)
  ]);
  const texture = new THREE.DataTexture(colors, 4, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

// Singleton gradient texture for all toon materials
let toonGradientTexture: THREE.DataTexture | null = null;

/**
 * Returns a shared toon gradient texture instance
 * Creates it on first call, returns cached instance thereafter
 */
export function getToonGradient(): THREE.DataTexture {
  if (!toonGradientTexture) {
    toonGradientTexture = createToonGradientTexture();
  }
  return toonGradientTexture;
}

// ─── Decay Gradient ──────────────────────────────────────────────────────────
// Interpolates between normal (bright, 4-band) and harsh (dark, matte, 3-band)
// based on decayAmount. Cached by quantized decayAmount to avoid creating
// a new texture every render.

const decayGradientCache = new Map<number, THREE.DataTexture>();

function createDecayGradientTexture(decayAmount: number): THREE.DataTexture {
  const t = decayAmount; // 0=normal, 1=harsh

  // Normal bands:  64 / 128 / 200 / 255
  // Harsh bands:   40 / 100 / 160 / 160  (no bright highlight, darker overall)
  const dark = Math.round(64 - t * 24);       // 64 → 40
  const mid = Math.round(128 - t * 28);       // 128 → 100
  const light = Math.round(200 - t * 40);     // 200 → 160
  const highlight = Math.round(210 - t * 50); // 210 → 160 (matches normal gradient cap, converges to dead/matte)

  const colors = new Uint8Array([
    dark, dark, dark, 255,
    mid, mid, mid, 255,
    light, light, light, 255,
    highlight, highlight, highlight, 255,
  ]);
  const texture = new THREE.DataTexture(colors, 4, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Returns a decay-aware toon gradient.
 * decayAmount=0: normal bright gradient (same as getToonGradient)
 * decayAmount=1: dark, matte, no highlights — dried/dead look
 */
export function getDecayToonGradient(decayAmount: number): THREE.DataTexture {
  if (decayAmount <= 0) return getToonGradient();

  // Quantize to 0.05 steps for caching (max 20 textures)
  const key = Math.round(Math.min(1, decayAmount) * 20);
  let cached = decayGradientCache.get(key);
  if (!cached) {
    cached = createDecayGradientTexture(key / 20);
    decayGradientCache.set(key, cached);
  }
  return cached;
}
