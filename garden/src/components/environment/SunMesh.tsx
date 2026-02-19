import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';

/**
 * SunMesh v11 - Visible sun orb in the sky
 *
 * Emissive sphere that follows the sun arc (same as TheatricalLighting).
 * ForwardRef removed — god rays were removed so nothing needs the mesh ref.
 *
 * Sun path: X-Y plane at FIXED Z=-60 (behind LED wall)
 * - Dawn (6:00): [60, 10, -60]
 * - Noon (12:00): [0, 70, -60]
 * - Dusk (18:00): [-60, 10, -60]
 * - Night: hidden
 *
 * Visibility controlled by mood:
 * - Negative mood (radiant/wet): Sun visible
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

  // Hide when mood >= -0.3 (not sufficiently radiant)
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
  const radiance = Math.min(1, (-moodValence - 0.3) / 0.7);
  const moodMultiplier = 0.5 + radiance * 0.5;

  // CAPPED at 1.0
  return Math.min(1.0, baseIntensity * moodMultiplier);
}

export const SunMesh: React.FC<SunMeshProps> = ({
  hour,
  moodValence,
  size = 8,
  distance = 60,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const colorRef = useRef(new THREE.Color('#fffaf0'));

  const position = useMemo(() => getSunPosition(hour, moodValence), [hour, moodValence]);
  const intensity = useMemo(() => getSunIntensity(moodValence, hour), [moodValence, hour]);

  // Update color via ref mutation instead of creating new THREE.Color objects
  useEffect(() => {
    const newColor = getSunColor(hour);
    colorRef.current.copy(newColor);
    if (materialRef.current) {
      materialRef.current.color.copy(colorRef.current);
      materialRef.current.emissive.copy(colorRef.current);
    }
  }, [hour]);

  // Update emissive intensity via ref
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.emissiveIntensity = Math.min(1.5, intensity * 1.5);
    }
  }, [intensity]);

  // Sun should be smaller when dim (overcast), larger when radiant
  const dynamicScale = 0.5 + intensity * 0.5;

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={[dynamicScale, dynamicScale, dynamicScale]}
    >
      <sphereGeometry args={[size, 32, 32]} />
      <meshStandardMaterial
        ref={materialRef}
        color={colorRef.current}
        emissive={colorRef.current}
        emissiveIntensity={Math.min(1.5, intensity * 1.5)}
        toneMapped={false}
      />
    </mesh>
  );
};

SunMesh.displayName = 'SunMesh';

export default SunMesh;
