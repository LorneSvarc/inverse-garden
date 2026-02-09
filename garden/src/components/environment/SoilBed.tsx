import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * SoilBed - The warm earth surface where plants grow
 *
 * This is NOT dark/black. It's warm earth tones that:
 * - Catch light and show shadows clearly
 * - Feel alive and organic
 * - Let colorful plants pop against it
 * - Have visible texture variation
 *
 * The soil sits slightly recessed into the vitrine base.
 */

interface SoilBedProps {
  width?: number;
  depth?: number;
}

// LIGHTER earth tones - visible against the environment
const COLORS = {
  base: '#b89d75',      // Warm ochre - LIGHTER
  dark: '#a08660',      // Darker patches
  light: '#cbb48a',     // Lighter patches - tan
  accent: '#a89060',    // Mid variation
};

// Seeded random for consistent noise
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Multi-octave noise for natural-looking patches
function fbmNoise(x: number, y: number, seed: number, octaves: number = 3): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    const rand = seededRandom(
      seed +
      Math.floor(x * frequency) * 10000 +
      Math.floor(y * frequency)
    );

    // Smooth interpolation within cell
    const fx = (x * frequency) % 1;
    const fy = (y * frequency) % 1;
    const smoothX = fx * fx * (3 - 2 * fx);
    const smoothY = fy * fy * (3 - 2 * fy);

    // Sample corners and interpolate
    const a = seededRandom(seed + Math.floor(x * frequency) * 10000 + Math.floor(y * frequency))();
    const b = seededRandom(seed + (Math.floor(x * frequency) + 1) * 10000 + Math.floor(y * frequency))();
    const c = seededRandom(seed + Math.floor(x * frequency) * 10000 + (Math.floor(y * frequency) + 1))();
    const d = seededRandom(seed + (Math.floor(x * frequency) + 1) * 10000 + (Math.floor(y * frequency) + 1))();

    const noise = a + (b - a) * smoothX + (c - a) * smoothY + (a - b - c + d) * smoothX * smoothY;

    value += noise * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue;
}

export const SoilBed: React.FC<SoilBedProps> = ({
  width = 40,           // Slightly smaller than vitrine to show rim
  depth = 32,
}) => {
  const { geometry } = useMemo(() => {
    // Higher resolution for visible texture
    const segments = 48;
    const geo = new THREE.PlaneGeometry(width, depth, segments, segments);

    // Rotate to horizontal
    geo.rotateX(-Math.PI / 2);

    // Apply vertex colors for soil variation
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);

    const baseColor = new THREE.Color(COLORS.base);
    const darkColor = new THREE.Color(COLORS.dark);
    const lightColor = new THREE.Color(COLORS.light);
    const accentColor = new THREE.Color(COLORS.accent);

    // Apply subtle height displacement for organic undulation
    const positions = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      // Height variation - very subtle, organic undulation
      const heightNoise = fbmNoise(x * 0.15, z * 0.15, 99999, 2);
      const y = positions.getY(i) + (heightNoise - 0.5) * 0.3; // ±0.15 units
      positions.setY(i, y);
    }
    geo.computeVertexNormals();

    for (let i = 0; i < count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      // Large patches (low frequency)
      const n1 = fbmNoise(x * 0.08, z * 0.08, 12345, 2);

      // Medium detail (medium frequency)
      const n2 = fbmNoise(x * 0.2, z * 0.2, 67890, 2) * 0.3;

      // Fine grain (high frequency)
      const n3 = fbmNoise(x * 0.5, z * 0.5, 11111, 1) * 0.1;

      const n = Math.min(1, Math.max(0, n1 + n2 + n3));

      // Blend between colors based on noise
      const c = new THREE.Color();
      if (n < 0.3) {
        c.lerpColors(darkColor, accentColor, n / 0.3);
      } else if (n < 0.6) {
        c.lerpColors(accentColor, baseColor, (n - 0.3) / 0.3);
      } else if (n < 0.85) {
        c.lerpColors(baseColor, lightColor, (n - 0.6) / 0.25);
      } else {
        c.copy(lightColor);
      }

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    return { geometry: geo };
  }, [width, depth]);

  return (
    <mesh
      geometry={geometry}
      position={[0, 0.01, 0]}  // Just above y=0
      receiveShadow
    >
      <meshStandardMaterial
        vertexColors
        roughness={0.95}       // Very matte, like real earth
        metalness={0}
      />
    </mesh>
  );
};

export default SoilBed;
