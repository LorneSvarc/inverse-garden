import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ToonClouds - Stylized cloud coverage for overcast mood
 *
 * v9 FIXES: Recalculated positions for camera visibility
 * Camera at [0, 25, 45], FOV 45, looking at garden center
 * Clouds need to be in front of camera but above the garden
 *
 * Cloud coverage increases with positive mood valence:
 * - Very negative (-1): No clouds - clear radiant sky
 * - Neutral (0): Few/no clouds
 * - Very positive (+1): Heavy cloud coverage - oppressive overcast
 *
 * Clouds are toon-shaded to match the plant aesthetic.
 */

interface ToonCloudsProps {
  moodValence: number;  // -1 to 1, controls cloud density
  hour: number;         // 0-24, affects cloud color
  height?: number;      // How high above the garden
  spread?: number;      // How spread out the clouds are
}

// Pre-generate cloud positions for consistent layout
// Camera is at [0, 25, 45] looking at [0, 2, 0]
// The camera looks DOWN at the garden at ~27° angle
// With 45° FOV, we need clouds positioned IN FRONT of the camera
// but high enough to appear in the sky portion of the frame
//
// Key insight: clouds at z=20-35 and height=28 will appear
// in the upper sky area above the garden when viewed from z=45
//
// Z positions: 15-35 range (between garden and camera)
// X positions: -30 to +30 to fill the frame width
const CLOUD_POSITIONS: Array<{
  x: number;
  z: number;
  scale: number;
  rotationY: number;
  puffCount: number;
}> = [
  // Primary clouds - center of frame, most visible
  { x: 0, z: 25, scale: 1.6, rotationY: 0, puffCount: 6 },
  { x: -15, z: 20, scale: 1.4, rotationY: 0.5, puffCount: 5 },
  { x: 15, z: 22, scale: 1.5, rotationY: -0.3, puffCount: 5 },

  // Secondary layer - wider spread
  { x: -25, z: 28, scale: 1.3, rotationY: 0.8, puffCount: 5 },
  { x: 25, z: 18, scale: 1.2, rotationY: -0.6, puffCount: 4 },
  { x: 0, z: 15, scale: 1.4, rotationY: 0.2, puffCount: 5 },
  { x: -10, z: 32, scale: 1.2, rotationY: 1.0, puffCount: 4 },

  // Outer clouds (appear with heavier coverage)
  { x: -30, z: 16, scale: 1.2, rotationY: -0.4, puffCount: 4 },
  { x: 30, z: 24, scale: 1.3, rotationY: 0.6, puffCount: 5 },
  { x: 10, z: 12, scale: 1.4, rotationY: 0, puffCount: 5 },
  { x: -20, z: 10, scale: 1.2, rotationY: -0.7, puffCount: 4 },
  { x: 20, z: 30, scale: 1.3, rotationY: 0.4, puffCount: 5 },
];

/**
 * A single cloud made of overlapping spheres (puffs)
 */
const CloudPuff: React.FC<{
  position: [number, number, number];
  scale: number;
  rotationY: number;
  puffCount: number;
  color: THREE.Color;
  opacity: number;
}> = ({ position, scale, rotationY, puffCount, color, opacity }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Generate puff positions for this cloud - BIGGER puffs
  const puffs = useMemo(() => {
    const result: Array<{ pos: [number, number, number]; size: number }> = [];
    const baseSize = 6 * scale; // Increased from 4 to 6

    for (let i = 0; i < puffCount; i++) {
      // Distribute puffs along the cloud body - wider spread
      const xOffset = (i - (puffCount - 1) / 2) * (baseSize * 0.7); // Increased spacing
      const yOffset = Math.sin(i * 0.7) * (baseSize * 0.25);
      const zOffset = Math.cos(i * 0.9) * (baseSize * 0.4);
      const size = baseSize * (0.8 + Math.abs(Math.sin(i * 1.2)) * 0.4); // Bigger base size

      result.push({
        pos: [xOffset, yOffset, zOffset],
        size,
      });
    }
    return result;
  }, [puffCount, scale]);

  // Slow drift animation
  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.position.x = position[0] + Math.sin(t * 0.05 + position[0]) * 0.5;
      groupRef.current.position.y = position[1] + Math.sin(t * 0.03 + position[2]) * 0.3;
    }
  });

  if (opacity <= 0) return null;

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      {puffs.map((puff, i) => (
        <mesh key={i} position={puff.pos}>
          <sphereGeometry args={[puff.size, 16, 16]} />
          <meshToonMaterial
            color={color}
            transparent
            opacity={opacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
};

/**
 * Get cloud color based on time of day AND mood
 * Whiter/lighter at neutral, darker/grayer at positive
 */
function getCloudColor(hour: number, moodValence: number): THREE.Color {
  const h = ((hour % 24) + 24) % 24;

  // Base colors for light (neutral) and dark (positive) clouds
  let lightColor: THREE.Color;
  let darkColor: THREE.Color;

  // Night: dark gray-blue
  if (h < 6 || h >= 20) {
    lightColor = new THREE.Color('#6a6a7a'); // Lighter night clouds
    darkColor = new THREE.Color('#3a3a4a');  // Darker night clouds
  }
  // Dawn (6-8): warm tints
  else if (h < 8) {
    lightColor = new THREE.Color('#c0b0a8'); // Light warm
    darkColor = new THREE.Color('#5a4a45');  // Dark warm
  }
  // Dusk (17-20): warm tints
  else if (h >= 17) {
    lightColor = new THREE.Color('#b8a8a0'); // Light warm
    darkColor = new THREE.Color('#5a4a4a');  // Dark warm
  }
  // Day: white to gray
  else {
    lightColor = new THREE.Color('#c8c8c8'); // Light/white clouds
    darkColor = new THREE.Color('#5a5a5a');  // Dark gray clouds
  }

  // Interpolate based on mood: more positive = darker clouds
  // At neutral (0): lighter clouds, at +1: darker clouds
  const t = Math.max(0, moodValence); // 0 to 1
  return lightColor.clone().lerp(darkColor, t);
}

/**
 * Calculate how many clouds should be visible based on mood
 * Returns 0-1 representing the cloud coverage percentage
 */
function getCloudCoverage(moodValence: number): number {
  // Start showing wispy clouds earlier (at -0.2)
  // This makes the transition more gradual
  if (moodValence <= -0.2) {
    return 0;
  }

  // From -0.2 to +1.0, scale up cloud coverage
  // At -0.2: 0%, at 0: ~17%, at +0.5: ~58%, at +1.0: 100%
  const normalizedMood = (moodValence + 0.2) / 1.2;
  return Math.min(1, normalizedMood);
}

export const ToonClouds: React.FC<ToonCloudsProps> = ({
  moodValence,
  hour,
  height = 12, // Much lower - just above LED wall (wall top is at y~21)
  spread = 1.0,
}) => {
  const cloudColor = useMemo(() => getCloudColor(hour, moodValence), [hour, moodValence]);
  const coverage = useMemo(() => getCloudCoverage(moodValence), [moodValence]);

  // Determine which clouds are visible based on coverage
  const visibleClouds = useMemo(() => {
    if (coverage <= 0) return [];

    // Number of clouds based on coverage (0-1 maps to 0-12 clouds)
    const numClouds = Math.ceil(coverage * CLOUD_POSITIONS.length);

    // First clouds to appear are the central ones (indexes 0-2)
    // Then mid-range (3-6), then outer (7-11)
    return CLOUD_POSITIONS.slice(0, numClouds).map((cloud, i) => ({
      ...cloud,
      // Higher opacity - more visible clouds
      opacity: Math.min(1, (coverage - i / CLOUD_POSITIONS.length) * CLOUD_POSITIONS.length * 1.0), // Increased from 0.7
    }));
  }, [coverage]);

  if (visibleClouds.length === 0) {
    return null;
  }

  return (
    <group>
      {visibleClouds.map((cloud, i) => (
        <CloudPuff
          key={i}
          position={[cloud.x * spread, height, cloud.z * spread]}
          scale={cloud.scale}
          rotationY={cloud.rotationY}
          puffCount={cloud.puffCount}
          color={cloudColor}
          opacity={cloud.opacity}
        />
      ))}
    </group>
  );
};

export default ToonClouds;
