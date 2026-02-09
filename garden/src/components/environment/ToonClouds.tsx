import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ToonClouds - Ghibli-style gradient clouds
 *
 * v10: Stylized gradient clouds with top/bottom coloring
 * - Top surface: bright/white (catching light)
 * - Bottom surface: darker (shadowed underside)
 * - Nice mood: lighter undersides
 * - Gloomy mood (positive valence): darker, heavier undersides
 *
 * Camera context: ~35 distance, ~0.43π polar, shifted down slightly
 * Clouds positioned to appear in upper portion of frame behind garden
 */

interface ToonCloudsProps {
  moodValence: number;  // -1 to 1, controls cloud density and darkness
  hour: number;         // 0-24, affects cloud color
  height?: number;      // How high above the garden
  spread?: number;      // How spread out the clouds are
}

// Cloud positions - closer to garden, visible in upper frame
// Camera at ~35 distance, 0.43π polar, looking at garden
const CLOUD_POSITIONS: Array<{
  x: number;
  z: number;
  scale: number;
  rotationY: number;
}> = [
  // Primary clouds - behind garden but not too far
  { x: 0, z: -20, scale: 1.6, rotationY: 0 },
  { x: -18, z: -25, scale: 1.4, rotationY: 0.3 },
  { x: 18, z: -22, scale: 1.5, rotationY: -0.2 },

  // Secondary layer
  { x: -30, z: -18, scale: 1.2, rotationY: 0.5 },
  { x: 30, z: -28, scale: 1.3, rotationY: -0.4 },
  { x: 8, z: -32, scale: 1.4, rotationY: 0.1 },
  { x: -12, z: -15, scale: 1.1, rotationY: -0.3 },

  // More clouds for heavy coverage
  { x: -25, z: -35, scale: 1.3, rotationY: 0.6 },
  { x: 25, z: -16, scale: 1.2, rotationY: -0.5 },
  { x: 0, z: -40, scale: 1.5, rotationY: 0 },
  { x: -38, z: -30, scale: 1.2, rotationY: 0.4 },
];

/**
 * Create a Ghibli-style cloud geometry with vertex colors for gradient
 * Top vertices are brighter, bottom vertices are darker
 */
function createGradientCloudGeometry(
  scale: number,
  topColor: THREE.Color,
  bottomColor: THREE.Color
): { geometry: THREE.BufferGeometry; positions: THREE.Vector3[] } {
  // Create merged geometry from multiple ellipsoids
  const puffCount = 5 + Math.floor(scale * 2);
  const geometries: THREE.BufferGeometry[] = [];
  const puffPositions: THREE.Vector3[] = [];

  // Cloud is wider than tall - Ghibli clouds are flat and puffy
  const cloudWidth = 12 * scale;
  const cloudHeight = 4 * scale;
  const cloudDepth = 8 * scale;

  for (let i = 0; i < puffCount; i++) {
    // Distribute puffs in a flattened ellipsoid pattern
    const angle = (i / puffCount) * Math.PI * 2;
    const radiusVariation = 0.6 + Math.random() * 0.4;

    const x = Math.cos(angle) * (cloudWidth * 0.4) * radiusVariation;
    const y = (Math.random() - 0.3) * cloudHeight * 0.5; // Slightly biased upward
    const z = Math.sin(angle) * (cloudDepth * 0.4) * radiusVariation;

    // Puff size varies - larger in center, smaller at edges
    const distFromCenter = Math.sqrt(x * x + z * z) / cloudWidth;
    const puffSize = (3 + Math.random() * 2) * scale * (1 - distFromCenter * 0.3);

    // Create ellipsoid (flattened sphere) for each puff
    const puffGeo = new THREE.SphereGeometry(puffSize, 12, 8);
    puffGeo.scale(1, 0.6, 0.8); // Flatten vertically

    // Translate to position
    puffGeo.translate(x, y, z);

    geometries.push(puffGeo);
    puffPositions.push(new THREE.Vector3(x, y, z));
  }

  // Add central large puff
  const centerPuff = new THREE.SphereGeometry(5 * scale, 16, 12);
  centerPuff.scale(1.2, 0.5, 1);
  geometries.push(centerPuff);
  puffPositions.push(new THREE.Vector3(0, 0, 0));

  // Merge all geometries
  const mergedGeo = mergeGeometries(geometries);

  // Apply vertex colors based on Y position (gradient from top to bottom)
  const positions = mergedGeo.attributes.position;
  const colors = new Float32Array(positions.count * 3);

  // Find Y bounds for normalization
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const yRange = maxY - minY || 1;

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    // Normalize Y to 0-1 (0 = bottom, 1 = top)
    const t = (y - minY) / yRange;

    // Interpolate color from bottom to top
    const color = bottomColor.clone().lerp(topColor, t);

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  mergedGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Clean up individual geometries
  geometries.forEach(g => g.dispose());

  return { geometry: mergedGeo, positions: puffPositions };
}

/**
 * Simple geometry merge function
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVertices = 0;
  let totalIndices = 0;

  geometries.forEach(geo => {
    totalVertices += geo.attributes.position.count;
    if (geo.index) {
      totalIndices += geo.index.count;
    } else {
      totalIndices += geo.attributes.position.count;
    }
  });

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const indices = new Uint32Array(totalIndices);

  let vertexOffset = 0;
  let indexOffset = 0;
  let indexVertexOffset = 0;

  geometries.forEach(geo => {
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;

    // Copy positions
    for (let i = 0; i < pos.count; i++) {
      positions[(vertexOffset + i) * 3] = pos.getX(i);
      positions[(vertexOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vertexOffset + i) * 3 + 2] = pos.getZ(i);

      if (norm) {
        normals[(vertexOffset + i) * 3] = norm.getX(i);
        normals[(vertexOffset + i) * 3 + 1] = norm.getY(i);
        normals[(vertexOffset + i) * 3 + 2] = norm.getZ(i);
      }
    }

    // Copy indices
    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) {
        indices[indexOffset + i] = geo.index.getX(i) + indexVertexOffset;
      }
      indexOffset += geo.index.count;
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices[indexOffset + i] = i + indexVertexOffset;
      }
      indexOffset += pos.count;
    }

    indexVertexOffset += pos.count;
    vertexOffset += pos.count;
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));

  return merged;
}

/**
 * Get cloud colors based on time and mood
 * Returns { top, bottom } colors
 *
 * KEY: At neutral/negative mood = white, wispy, light
 *      At positive mood = darker, heavier, gloomier
 */
function getCloudColors(hour: number, moodValence: number): { top: THREE.Color; bottom: THREE.Color } {
  const h = ((hour % 24) + 24) % 24;

  // Gloom factor: 0 at neutral/negative, 1 at max positive
  const gloomFactor = Math.max(0, moodValence);

  // Night (20-6)
  if (h < 6 || h >= 20) {
    // Night clouds: silvery white -> dark gray
    const topColor = new THREE.Color('#aaaacc').lerp(new THREE.Color('#666688'), gloomFactor);
    const bottomColor = new THREE.Color('#8888aa').lerp(new THREE.Color('#333344'), gloomFactor);
    return { top: topColor, bottom: bottomColor };
  }
  // Dawn (6-8)
  else if (h < 8) {
    // Dawn clouds: warm white -> muted warm gray
    const topColor = new THREE.Color('#fff8f0').lerp(new THREE.Color('#aa9080'), gloomFactor);
    const bottomColor = new THREE.Color('#ffeedd').lerp(new THREE.Color('#665544'), gloomFactor);
    return { top: topColor, bottom: bottomColor };
  }
  // Dusk (17-20)
  else if (h >= 17) {
    // Dusk clouds: peachy white -> muted warm gray
    const topColor = new THREE.Color('#fff0e8').lerp(new THREE.Color('#998070'), gloomFactor);
    const bottomColor = new THREE.Color('#ffddcc').lerp(new THREE.Color('#554433'), gloomFactor);
    return { top: topColor, bottom: bottomColor };
  }
  // Day (8-17)
  else {
    // Day clouds: bright white -> heavy gray
    const topColor = new THREE.Color('#ffffff').lerp(new THREE.Color('#888899'), gloomFactor);
    const bottomColor = new THREE.Color('#eeeeff').lerp(new THREE.Color('#445566'), gloomFactor);
    return { top: topColor, bottom: bottomColor };
  }
}

/**
 * Calculate cloud coverage based on mood
 */
function getCloudCoverage(moodValence: number): number {
  // Clouds start appearing at -0.2, full coverage at +1
  if (moodValence <= -0.2) return 0;
  const normalizedMood = (moodValence + 0.2) / 1.2;
  return Math.min(1, normalizedMood);
}

/**
 * Calculate cloud density/opacity based on mood
 * Wispy at neutral, heavy at positive
 */
function getCloudDensity(moodValence: number): number {
  // At neutral (0): wispy (0.4 opacity)
  // At max positive (1): heavy (1.0 opacity)
  const gloomFactor = Math.max(0, moodValence);
  return 0.4 + gloomFactor * 0.6;
}

/**
 * Calculate cloud scale multiplier based on mood
 * Smaller/thinner at neutral, bigger/puffier at positive
 */
function getCloudScaleMultiplier(moodValence: number): number {
  const gloomFactor = Math.max(0, moodValence);
  return 0.7 + gloomFactor * 0.5; // 0.7 at neutral, 1.2 at max positive
}

/**
 * Individual Ghibli-style cloud with gradient shading
 */
const GhibliCloud: React.FC<{
  position: [number, number, number];
  scale: number;
  rotationY: number;
  topColor: THREE.Color;
  bottomColor: THREE.Color;
  opacity: number;
  driftOffset: number;
}> = ({ position, scale, rotationY, topColor, bottomColor, opacity, driftOffset }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Create gradient geometry
  const { geometry } = useMemo(() => {
    return createGradientCloudGeometry(scale, topColor, bottomColor);
  }, [scale, topColor, bottomColor]);

  // Slow drift animation
  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime;
      meshRef.current.position.x = position[0] + Math.sin(t * 0.02 + driftOffset) * 2;
      meshRef.current.position.y = position[1] + Math.sin(t * 0.015 + driftOffset * 0.5) * 0.5;
    }
  });

  if (opacity <= 0) return null;

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={[0, rotationY, 0]}
      geometry={geometry}
    >
      <meshLambertMaterial
        vertexColors
        transparent
        opacity={opacity * 0.85}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export const ToonClouds: React.FC<ToonCloudsProps> = ({
  moodValence,
  hour,
  height = 18, // Lowered to be visible from starting camera POV
  spread = 1.0,
}) => {
  const { top: topColor, bottom: bottomColor } = useMemo(
    () => getCloudColors(hour, moodValence),
    [hour, moodValence]
  );

  const coverage = useMemo(() => getCloudCoverage(moodValence), [moodValence]);
  const density = useMemo(() => getCloudDensity(moodValence), [moodValence]);
  const scaleMultiplier = useMemo(() => getCloudScaleMultiplier(moodValence), [moodValence]);

  // Determine which clouds are visible based on coverage
  const visibleClouds = useMemo(() => {
    if (coverage <= 0) return [];

    const numClouds = Math.ceil(coverage * CLOUD_POSITIONS.length);

    return CLOUD_POSITIONS.slice(0, numClouds).map((cloud, i) => {
      // Base opacity from coverage progression
      const coverageOpacity = Math.min(1, (coverage - i / CLOUD_POSITIONS.length) * CLOUD_POSITIONS.length);
      // Final opacity combines coverage and density (wispiness)
      const finalOpacity = coverageOpacity * density;

      return {
        ...cloud,
        scale: cloud.scale * scaleMultiplier,
        opacity: finalOpacity,
      };
    });
  }, [coverage, density, scaleMultiplier]);

  if (visibleClouds.length === 0) {
    return null;
  }

  return (
    <group>
      {visibleClouds.map((cloud, i) => (
        <GhibliCloud
          key={i}
          position={[cloud.x * spread, height, cloud.z * spread]}
          scale={cloud.scale}
          rotationY={cloud.rotationY}
          topColor={topColor}
          bottomColor={bottomColor}
          opacity={cloud.opacity}
          driftOffset={i * 2.5}
        />
      ))}
    </group>
  );
};

export default ToonClouds;
