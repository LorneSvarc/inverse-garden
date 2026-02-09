import React, { useMemo } from 'react';
import * as THREE from 'three';
import { getToonGradient } from '../../utils/toonGradient';
import { GROUND_BOUNDS } from '../../config/environmentConfig';

/**
 * EmissivePerimeter v10 - Elliptical Organic Glow Ring
 *
 * Matches the excavation shape (ellipse, not circle):
 * - Inner edge just outside excavation boundary
 * - Outer edge creates a glowing ring around the bed
 * - Uses same seeded wobble as ExcavatedBed for alignment
 *
 * The ring MIRRORS the mood expressed in the sky:
 * - Negative mood (radiant): Warm golden glow, bright
 * - Neutral: Warm white
 * - Positive mood (overcast): Cool gray, dim
 */

interface EmissivePerimeterProps {
  moodValence?: number;  // -1 to 1
  hour?: number;         // 0-24
}

// Seeded random for consistent organic variation (matches ExcavatedBed)
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/**
 * Generate organic ellipse ring with wobble
 * Uses width/depth for ellipse shape (not circular radii)
 */
function generateOrganicEllipseRing(
  innerWidth: number,
  innerDepth: number,
  outerWidth: number,
  outerDepth: number,
  wobbleAmount: number,
  pointCount: number,
  seed: number
): { inner: THREE.Vector2[]; outer: THREE.Vector2[] } {
  const rand = seededRandom(seed);
  const innerPoints: THREE.Vector2[] = [];
  const outerPoints: THREE.Vector2[] = [];

  const halfInnerW = innerWidth / 2;
  const halfInnerD = innerDepth / 2;
  const halfOuterW = outerWidth / 2;
  const halfOuterD = outerDepth / 2;

  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;

    // Inner edge wobble (ellipse)
    const innerWobble = 1 + (rand() - 0.5) * wobbleAmount;
    const innerX = Math.cos(angle) * halfInnerW * innerWobble;
    const innerZ = Math.sin(angle) * halfInnerD * innerWobble;
    innerPoints.push(new THREE.Vector2(innerX, innerZ));

    // Outer edge wobble (ellipse)
    const outerWobble = 1 + (rand() - 0.5) * wobbleAmount * 0.8;
    const outerX = Math.cos(angle) * halfOuterW * outerWobble;
    const outerZ = Math.sin(angle) * halfOuterD * outerWobble;
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
    baseIntensity = 0.5 - t * 0.25;
  } else if (h < 17) {
    // Day: sun dominates, ring subtle
    baseIntensity = 0.25;
  } else if (h < 19) {
    // Pre-dusk
    const t = (h - 17) / 2;
    baseIntensity = 0.25 + t * 0.1;
  } else {
    // Evening
    const t = (h - 19) / 2;
    baseIntensity = 0.35 + t * 0.15;
  }

  // Mood modifier: negative = brighter (radiant), positive = dimmer (overcast)
  const moodMultiplier = moodValence < 0
    ? 1.0 + (-moodValence) * 0.8
    : 1.0 - moodValence * 0.6;

  return Math.min(1.0, baseIntensity * moodMultiplier);
}

/**
 * Get ring color based on mood and time
 */
function getRingColor(hour: number, moodValence: number): THREE.Color {
  const h = ((hour % 24) + 24) % 24;

  const radiantGold = new THREE.Color('#ffcc66');
  const neutralWarm = new THREE.Color('#fff0dd');
  const overcastGray = new THREE.Color('#99aabb');

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
    timeColor = new THREE.Color('#aabbdd');
  } else if (h < 8) {
    timeColor = new THREE.Color('#ffd088');
  } else if (h >= 17 && h < 20) {
    timeColor = new THREE.Color('#ffcc88');
  } else {
    timeColor = new THREE.Color('#ffffff');
  }

  return baseColor.clone().lerp(timeColor, 0.3);
}

/**
 * Create geometry for organic ellipse ring shape
 */
function createOrganicEllipseRingGeometry(
  innerWidth: number,
  innerDepth: number,
  outerWidth: number,
  outerDepth: number,
  seed: number
): THREE.BufferGeometry {
  const pointCount = 64;
  const wobbleAmount = 0.08;

  const { inner, outer } = generateOrganicEllipseRing(
    innerWidth,
    innerDepth,
    outerWidth,
    outerDepth,
    wobbleAmount,
    pointCount,
    seed
  );

  const vertices: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < pointCount; i++) {
    vertices.push(inner[i].x, 0, inner[i].y);
    vertices.push(outer[i].x, 0, outer[i].y);
  }

  for (let i = 0; i < pointCount; i++) {
    const next = (i + 1) % pointCount;
    const innerCurrent = i * 2;
    const outerCurrent = i * 2 + 1;
    const innerNext = next * 2;
    const outerNext = next * 2 + 1;

    indices.push(innerCurrent, outerCurrent, outerNext);
    indices.push(innerCurrent, outerNext, innerNext);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

export const EmissivePerimeter: React.FC<EmissivePerimeterProps> = ({
  moodValence = 0,
  hour = 12,
}) => {
  const gradientMap = useMemo(() => getToonGradient(), []);

  // Ring dimensions based on excavation bounds
  // Inner: just outside excavation edge (+3)
  // Outer: wider ring (+10)
  const innerWidth = GROUND_BOUNDS.width + 3;
  const innerDepth = GROUND_BOUNDS.depth + 3;
  const outerWidth = GROUND_BOUNDS.width + 10;
  const outerDepth = GROUND_BOUNDS.depth + 10;

  // Generate organic ellipse ring geometry (seed 42 matches ExcavatedBed)
  const ringGeometry = useMemo(() =>
    createOrganicEllipseRingGeometry(innerWidth, innerDepth, outerWidth, outerDepth, 42),
    [innerWidth, innerDepth, outerWidth, outerDepth]
  );

  const intensity = useMemo(
    () => getRingIntensity(hour, moodValence),
    [hour, moodValence]
  );

  const ringColor = useMemo(
    () => getRingColor(hour, moodValence),
    [hour, moodValence]
  );

  const lightIntensity = intensity * 0.15;

  // Light positions - elliptical arrangement matching ring shape
  const lightPositions: [number, number, number][] = useMemo(() => {
    const avgW = (innerWidth + outerWidth) / 4;
    const avgD = (innerDepth + outerDepth) / 4;
    return [
      [avgW, 1, 0],
      [-avgW, 1, 0],
      [0, 1, avgD],
      [0, 1, -avgD],
      [avgW * 0.7, 1, avgD * 0.7],
      [-avgW * 0.7, 1, avgD * 0.7],
      [avgW * 0.7, 1, -avgD * 0.7],
      [-avgW * 0.7, 1, -avgD * 0.7],
    ];
  }, [innerWidth, innerDepth, outerWidth, outerDepth]);

  return (
    <group>
      {/* Organic emissive ring - positioned ABOVE floor */}
      <mesh
        geometry={ringGeometry}
        position={[0, 0.02, 0]}
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

      {/* Point lights around perimeter */}
      {lightPositions.map((pos, i) => (
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
