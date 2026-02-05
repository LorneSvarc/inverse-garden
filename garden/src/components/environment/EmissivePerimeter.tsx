import React, { useMemo } from 'react';
import * as THREE from 'three';
import { getToonGradient } from '../../utils/toonGradient';

/**
 * EmissivePerimeter v9 - Organic Edges (The Observation Garden)
 *
 * Redesigned to match the organic aesthetic of ExcavatedBed:
 * - Uses same seeded wobble generation for organic edges
 * - Toon shaded material for consistency
 * - Sits on the outer edge of the excavation
 *
 * The floor ring MIRRORS the mood expressed in the sky:
 * - Negative mood (radiant sky): Ring glows warm/golden, bright
 * - Neutral: Ring is neutral warm white
 * - Positive mood (overcast sky): Ring dims, goes cool/gray
 */

interface EmissivePerimeterProps {
  moodValence?: number;  // -1 to 1
  hour?: number;         // 0-24
  innerRadius?: number;  // Where ring starts (outside excavation edge)
  outerRadius?: number;  // Where ring ends
}

// Seeded random for consistent organic variation (matches ExcavatedBed)
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/**
 * Generate organic shape points with wobble
 * This matches the ExcavatedBed generation for visual consistency
 */
function generateOrganicRing(
  innerRadius: number,
  outerRadius: number,
  wobbleAmount: number,
  pointCount: number,
  seed: number
): { inner: THREE.Vector2[]; outer: THREE.Vector2[] } {
  const rand = seededRandom(seed);
  const innerPoints: THREE.Vector2[] = [];
  const outerPoints: THREE.Vector2[] = [];

  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;

    // Inner edge wobble
    const innerWobble = 1 + (rand() - 0.5) * wobbleAmount;
    const innerX = Math.cos(angle) * innerRadius * innerWobble;
    const innerZ = Math.sin(angle) * innerRadius * innerWobble;
    innerPoints.push(new THREE.Vector2(innerX, innerZ));

    // Outer edge wobble (different random values for variety)
    const outerWobble = 1 + (rand() - 0.5) * wobbleAmount * 0.8;
    const outerX = Math.cos(angle) * outerRadius * outerWobble;
    const outerZ = Math.sin(angle) * outerRadius * outerWobble;
    outerPoints.push(new THREE.Vector2(outerX, outerZ));
  }

  return { inner: innerPoints, outer: outerPoints };
}

/**
 * Calculate ring intensity based on time of day AND mood
 * CAPPED at 1.0 to prevent overexposure
 */
function getRingIntensity(hour: number, moodValence: number): number {
  const h = ((hour % 24) + 24) % 24;

  // Base intensity from time of day
  let baseIntensity: number;

  if (h < 5 || h >= 21) {
    // Night: ring is more prominent
    baseIntensity = 0.5;
  } else if (h < 7) {
    // Dawn: transitioning
    const t = (h - 5) / 2;
    baseIntensity = 0.5 - t * 0.25; // 0.5 → 0.25
  } else if (h < 17) {
    // Day: sun dominates, ring subtle
    baseIntensity = 0.25;
  } else if (h < 19) {
    // Pre-dusk
    const t = (h - 17) / 2;
    baseIntensity = 0.25 + t * 0.1; // 0.25 → 0.35
  } else {
    // Evening
    const t = (h - 19) / 2;
    baseIntensity = 0.35 + t * 0.15; // 0.35 → 0.5
  }

  // Mood modifier: negative = brighter (radiant), positive = much dimmer (overcast)
  const moodMultiplier = moodValence < 0
    ? 1.0 + (-moodValence) * 0.8  // -1 → 1.8
    : 1.0 - moodValence * 0.6;    // +1 → 0.4

  // CAPPED at 1.0 to prevent overexposure
  return Math.min(1.0, baseIntensity * moodMultiplier);
}

/**
 * Get ring color based on mood and time
 * Warm golden at radiant, cool gray at overcast
 */
function getRingColor(hour: number, moodValence: number): THREE.Color {
  const h = ((hour % 24) + 24) % 24;

  // Base colors for different weather states
  const radiantGold = new THREE.Color('#ffcc66');   // Warm golden
  const neutralWarm = new THREE.Color('#fff0dd');    // Warm white
  const overcastGray = new THREE.Color('#99aabb');   // Cool gray

  // Interpolate based on mood
  let baseColor: THREE.Color;
  if (moodValence < 0) {
    const t = Math.abs(moodValence);
    baseColor = neutralWarm.clone().lerp(radiantGold, t);
  } else {
    const t = moodValence;
    baseColor = neutralWarm.clone().lerp(overcastGray, t);
  }

  // Time-based color temperature adjustment
  let timeColor: THREE.Color;
  if (h < 6 || h >= 20) {
    // Night: shift toward cool blue
    timeColor = new THREE.Color('#aabbdd');
  } else if (h < 8) {
    // Dawn: warm golden
    timeColor = new THREE.Color('#ffd088');
  } else if (h >= 17 && h < 20) {
    // Dusk: warm orange
    timeColor = new THREE.Color('#ffcc88');
  } else {
    // Day: neutral
    timeColor = new THREE.Color('#ffffff');
  }

  // Blend base mood color with time color (30% time influence)
  return baseColor.clone().lerp(timeColor, 0.3);
}

/**
 * Create geometry for organic ring shape
 */
function createOrganicRingGeometry(
  innerRadius: number,
  outerRadius: number,
  seed: number
): THREE.BufferGeometry {
  const pointCount = 64;
  const wobbleAmount = 0.08; // Matches ExcavatedBed

  const { inner, outer } = generateOrganicRing(
    innerRadius,
    outerRadius,
    wobbleAmount,
    pointCount,
    seed
  );

  // Create vertices and indices for the ring
  const vertices: number[] = [];
  const indices: number[] = [];

  // Add inner and outer ring vertices
  for (let i = 0; i < pointCount; i++) {
    // Inner vertex at y = 0
    vertices.push(inner[i].x, 0, inner[i].y);
    // Outer vertex at y = 0
    vertices.push(outer[i].x, 0, outer[i].y);
  }

  // Create triangles
  for (let i = 0; i < pointCount; i++) {
    const next = (i + 1) % pointCount;
    const innerCurrent = i * 2;
    const outerCurrent = i * 2 + 1;
    const innerNext = next * 2;
    const outerNext = next * 2 + 1;

    // Two triangles per quad
    indices.push(innerCurrent, outerCurrent, outerNext);
    indices.push(innerCurrent, outerNext, innerNext);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

// Point light positions - arranged around the perimeter, aimed inward
// Positioned at organic wobble-averaged radius
const LIGHT_POSITIONS: [number, number, number][] = [
  [22, 1, 0],
  [-22, 1, 0],
  [0, 1, 20],
  [0, 1, -20],
  [16, 1, 16],
  [-16, 1, 16],
  [16, 1, -16],
  [-16, 1, -16],
];

export const EmissivePerimeter: React.FC<EmissivePerimeterProps> = ({
  moodValence = 0,
  hour = 12,
  innerRadius = 18,
  outerRadius = 22,
}) => {
  const gradientMap = useMemo(() => getToonGradient(), []);

  // Generate organic ring geometry with same seed as ExcavatedBed for alignment
  const ringGeometry = useMemo(() =>
    createOrganicRingGeometry(innerRadius, outerRadius, 42),
    [innerRadius, outerRadius]
  );

  // Calculate intensity based on time AND mood
  const intensity = useMemo(
    () => getRingIntensity(hour, moodValence),
    [hour, moodValence]
  );

  // Get color based on time AND mood
  const ringColor = useMemo(
    () => getRingColor(hour, moodValence),
    [hour, moodValence]
  );

  // Light intensity scales with ring intensity
  const lightIntensity = intensity * 0.15;

  return (
    <group>
      {/* Organic emissive ring - toon shaded to match aesthetic */}
      <mesh
        geometry={ringGeometry}
        position={[0, -0.3, 0]}
        receiveShadow
      >
        <meshToonMaterial
          color={ringColor}
          emissive={ringColor}
          emissiveIntensity={intensity}
          gradientMap={gradientMap}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Point lights around perimeter - cast colored light onto plants */}
      {LIGHT_POSITIONS.map((pos, i) => (
        <pointLight
          key={i}
          position={pos}
          color={ringColor}
          intensity={lightIntensity * Math.PI}
          distance={25}
          decay={2}
        />
      ))}
    </group>
  );
};

export default EmissivePerimeter;
