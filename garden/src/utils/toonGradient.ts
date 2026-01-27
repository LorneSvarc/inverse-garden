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
    255, 255, 255, 255, // Highlight band
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
