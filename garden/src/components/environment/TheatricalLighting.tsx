import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

/**
 * TheatricalLighting v10 - Wet/Dry Garden (Courtyard)
 *
 * Sun arc fixed properly:
 * - Moves in X-Y plane at fixed Z=-60 (behind LED wall at z=-30)
 * - Dawn (6:00): East (positive X), low
 * - Noon (12:00): Overhead (X=0), high
 * - Dusk (18:00): West (negative X), low
 * - Night: Below horizon, ambient only
 *
 * TIME controls shadow direction and color temperature.
 * MOOD now controls material properties (in ExcavatedBed), not lighting.
 */

interface TheatricalLightingProps {
  hour: number;
  moodValence?: number;
  shadowsEnabled?: boolean;
  shadowSoftness?: number;
}

/**
 * Calculate sun position based on hour
 *
 * FIXED: Sun moves in X-Y plane at FIXED Z=-60 (always behind LED wall)
 * - Dawn (6:00): [60, 10, -60] - east, low
 * - Noon (12:00): [0, 70, -60] - overhead
 * - Dusk (18:00): [-60, 10, -60] - west, low
 * - Night: [0, -30, -60] - below horizon
 */
function getSunPosition(hour: number): [number, number, number] {
  const h = ((hour % 24) + 24) % 24;
  const Z_PLANE = -60; // Fixed Z - always behind the wall

  // Night: sun below horizon
  if (h < 6 || h >= 18) {
    // Position below for ambient moonlight direction
    return [0, -30, Z_PLANE];
  }

  // Daytime: arc from east to west in X-Y plane
  // At 6am: east (positive X, low Y)
  // At 12pm: overhead (X=0, high Y)
  // At 6pm: west (negative X, low Y)
  const dayProgress = (h - 6) / 12;  // 0 at 6am, 1 at 6pm
  const angle = dayProgress * Math.PI;  // 0 to PI

  // X: east (+60) to west (-60)
  const x = Math.cos(angle) * 60;

  // Y: arc up (10 at dawn/dusk, 70 at noon)
  const y = Math.sin(angle) * 60 + 10;

  return [x, y, Z_PLANE];
}

function getTimeBasedLighting(hour: number): {
  keyIntensity: number;
  keyColor: string;
  warmth: number;
} {
  // Night (0-5, 21-24) - LOW: emissive ground is the hero
  if (hour < 5 || hour >= 21) {
    return {
      keyIntensity: 0.4,  // Was 1.2 - reduced since emissive handles night
      keyColor: '#aabbdd',  // Cool blue moonlight
      warmth: 0.2,
    };
  }

  // Dawn (5-7) - Rising sun, emissive fading
  if (hour < 7) {
    const t = (hour - 5) / 2;
    return {
      keyIntensity: 0.6 + t * 1.4,  // 0.6 → 2.0
      keyColor: '#ffe8d0',  // Warm golden
      warmth: 0.7 + t * 0.2,
    };
  }

  // Morning (7-10)
  if (hour < 10) {
    const t = (hour - 7) / 3;
    return {
      keyIntensity: 2.0 + t * 0.5,
      keyColor: '#fff8f0',
      warmth: 0.6,
    };
  }

  // Midday (10-15) - BRIGHT sun is hero
  if (hour < 15) {
    return {
      keyIntensity: 2.5,  // Strong - emissive is minimal
      keyColor: '#fffaf5',  // Warm white
      warmth: 0.5,
    };
  }

  // Afternoon (15-17)
  if (hour < 17) {
    const t = (hour - 15) / 2;
    return {
      keyIntensity: 2.3 - t * 0.3,
      keyColor: '#fff5e8',
      warmth: 0.6 + t * 0.1,
    };
  }

  // Evening (17-19)
  if (hour < 19) {
    const t = (hour - 17) / 2;
    return {
      keyIntensity: 2.0 - t * 0.6,  // 2.0 → 1.4
      keyColor: '#ffd8a8',  // Golden hour
      warmth: 0.8,
    };
  }

  // Dusk (19-21) - Sun setting, emissive rising
  const t = (hour - 19) / 2;
  return {
    keyIntensity: 1.4 - t * 1.0,  // 1.4 → 0.4
    keyColor: '#ddbbaa',
    warmth: 0.5,
  };
}

function applyMoodModifier(
  base: ReturnType<typeof getTimeBasedLighting>,
  moodValence: number
): ReturnType<typeof getTimeBasedLighting> {
  const moodFactor = -moodValence;

  return {
    keyIntensity: base.keyIntensity * (1 + moodFactor * 0.15),
    keyColor: base.keyColor,
    warmth: Math.min(1, Math.max(0, base.warmth + moodFactor * 0.15)),
  };
}

export const TheatricalLighting: React.FC<TheatricalLightingProps> = ({
  hour,
  moodValence = 0,
  shadowsEnabled = true,
  shadowSoftness = 4,
}) => {
  const keyLightRef = useRef<THREE.DirectionalLight>(null);

  const lighting = useMemo(() => {
    const base = getTimeBasedLighting(hour);
    return applyMoodModifier(base, moodValence);
  }, [hour, moodValence]);

  // DYNAMIC sun position - shadows follow the sun arc at fixed Z=-60
  const sunPosition = useMemo(() => getSunPosition(hour), [hour]);

  // Rim light intensity - reduced at night when emissive is hero
  const rimIntensity = useMemo(() => {
    if (hour < 5 || hour >= 21) return 0.3;  // Night: low
    if (hour < 7 || hour >= 19) return 0.5;  // Dawn/dusk: medium
    return 1.0;  // Day: full
  }, [hour]);

  // Warmer ground bounce color
  const groundColor = useMemo(() => {
    const baseGround = new THREE.Color('#4a3525');
    const warmGround = new THREE.Color('#5a4030');
    return baseGround.lerp(warmGround, lighting.warmth);
  }, [lighting.warmth]);

  const skyColor = useMemo(() => {
    const coolSky = new THREE.Color('#3a3a50');
    const warmSky = new THREE.Color('#4a4540');
    return coolSky.lerp(warmSky, lighting.warmth);
  }, [lighting.warmth]);

  useEffect(() => {
    if (keyLightRef.current) {
      keyLightRef.current.castShadow = shadowsEnabled;
      keyLightRef.current.shadow.radius = shadowSoftness;
      keyLightRef.current.shadow.bias = -0.0001;
      keyLightRef.current.shadow.normalBias = 0.02;
      keyLightRef.current.shadow.needsUpdate = true;
    }
  }, [shadowsEnabled, shadowSoftness]);

  return (
    <>
      {/* KEY LIGHT - Position follows sun arc for dynamic shadows */}
      <directionalLight
        ref={keyLightRef}
        position={sunPosition}
        intensity={lighting.keyIntensity * Math.PI}
        color={lighting.keyColor}
        castShadow={shadowsEnabled}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={100}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />

      {/* Hemisphere light - subtle ambient with ground bounce */}
      <hemisphereLight
        args={[skyColor, groundColor, 0.4]}
      />

      {/* MINIMAL ambient - just enough to keep shadows from going pure black */}
      <ambientLight
        intensity={0.05}
        color="#ffffff"
      />

      {/* RIM LIGHT - Cool blue-white from behind, catches edges */}
      <directionalLight
        position={[0, 20, -30]}
        intensity={rimIntensity * Math.PI}
        color="#aaccff"
        castShadow={false}
      />

      {/* Secondary rim from side for more definition */}
      <directionalLight
        position={[-25, 15, 0]}
        intensity={rimIntensity * 0.4 * Math.PI}
        color="#ccddff"
        castShadow={false}
      />
    </>
  );
};

export default TheatricalLighting;
