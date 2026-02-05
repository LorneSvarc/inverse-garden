import React, { useRef, useMemo, forwardRef } from 'react';
import * as THREE from 'three';

/**
 * SunMesh v10 - Wet/Dry Garden (Courtyard)
 *
 * Emissive sphere for god rays source. Uses SAME sun arc as TheatricalLighting.
 *
 * Sun path: X-Y plane at FIXED Z=-60 (behind LED wall)
 * - Dawn (6:00): [60, 10, -60]
 * - Noon (12:00): [0, 70, -60]
 * - Dusk (18:00): [-60, 10, -60]
 * - Night: hidden
 *
 * Visibility controlled by mood:
 * - Negative mood (radiant/wet): Sun visible for god rays
 * - Positive mood (overcast/dry): Sun hidden
 */

interface SunMeshProps {
  hour: number;         // 0-24, controls position and color
  moodValence: number;  // -1 to 1, controls visibility/intensity
  size?: number;        // Radius of the sun sphere
  distance?: number;    // How far away the sun is from center
}


/**
 * Get sun color based on time of day
 * Dawn/dusk: warm golden, Noon: bright warm white, Night: cool blue (moon)
 */
function getSunColor(hour: number): THREE.Color {
  const h = ((hour % 24) + 24) % 24;

  // Night (before 5, after 20): Cool blue moonlight
  if (h < 5 || h >= 21) {
    return new THREE.Color('#8899bb');
  }

  // Dawn (5-7): Golden warm
  if (h < 7) {
    const t = (h - 5) / 2;
    const dawn = new THREE.Color('#ff9944');
    const morning = new THREE.Color('#ffffee');
    return dawn.lerp(morning, t);
  }

  // Dusk (18-21): Golden warm
  if (h >= 18) {
    const t = (h - 18) / 3;
    const evening = new THREE.Color('#ffeecc');
    const dusk = new THREE.Color('#ff8844');
    return evening.lerp(dusk, t);
  }

  // Day (7-18): Warm white
  return new THREE.Color('#fffaf0');
}

/**
 * Get sun position - SAME arc as TheatricalLighting
 * X-Y plane at fixed Z=-60, hidden when mood >= -0.3 or at night
 */
function getSunPosition(hour: number, moodValence: number): [number, number, number] {
  const Z_PLANE = -60;

  // Hide when mood >= -0.3 (not sufficiently radiant for god rays)
  if (moodValence >= -0.3) {
    return [0, -200, Z_PLANE];
  }

  const h = ((hour % 24) + 24) % 24;

  // Night: sun below horizon
  if (h < 6 || h >= 18) {
    return [0, -200, Z_PLANE];
  }

  // Daytime: SAME arc as TheatricalLighting
  const dayProgress = (h - 6) / 12;
  const angle = dayProgress * Math.PI;

  const x = Math.cos(angle) * 60;
  const y = Math.sin(angle) * 60 + 10;

  return [x, y, Z_PLANE];
}

/**
 * Get sun intensity based on mood valence
 * Only visible for sufficiently negative mood (radiant weather)
 * CAPPED at 1.0 to prevent HDR blowout
 */
function getSunIntensity(moodValence: number, hour: number): number {
  // Only show for sufficiently radiant mood (< -0.3)
  if (moodValence >= -0.3) {
    return 0;
  }

  const h = ((hour % 24) + 24) % 24;

  // Night: much lower base intensity
  const isNight = h < 6 || h >= 18;
  const baseIntensity = isNight ? 0.2 : 0.6;

  // Mood affects intensity: more negative = more radiant
  // Map from [-0.3 to -1] range to [0 to 1] for modifier
  const radiance = Math.min(1, (-moodValence - 0.3) / 0.7);
  const moodMultiplier = 0.5 + radiance * 0.5;  // 0.5 to 1.0

  // CAPPED at 1.0 (was reaching 2.0+ before)
  return Math.min(1.0, baseIntensity * moodMultiplier);
}

export const SunMesh = forwardRef<THREE.Mesh, SunMeshProps>(({
  hour,
  moodValence,
  size = 8,
  distance = 60,
}, ref) => {
  const internalRef = useRef<THREE.Mesh>(null);
  const meshRef = ref || internalRef;

  const position = useMemo(() => getSunPosition(hour, moodValence), [hour, moodValence]);
  const color = useMemo(() => getSunColor(hour), [hour]);
  const intensity = useMemo(() => getSunIntensity(moodValence, hour), [moodValence, hour]);

  // Sun should be smaller when dim (overcast), larger when radiant
  const dynamicSize = size * (0.5 + intensity * 0.5);

  return (
    <mesh
      ref={meshRef}
      position={position}
    >
      <sphereGeometry args={[dynamicSize, 32, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={Math.min(1.5, intensity * 1.5)} // CAPPED at 1.5 (was 3x)
        toneMapped={false}
      />
    </mesh>
  );
});

SunMesh.displayName = 'SunMesh';

export default SunMesh;
