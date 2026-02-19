import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GROUND_BOUNDS } from '../config/environmentConfig';
import { getToonGradient } from '../utils/toonGradient';

/**
 * ExcavatedBed - An organic-edged depression in a dark floor
 *
 * Replaces RaisedBed + DirtSurface with a unified "excavation" concept.
 * The garden appears carved into the ground, like an archaeological site
 * or specimen tray, rather than sitting on top of a planter box.
 *
 * Structure:
 * - Dark floor plane (void) surrounding the excavation
 * - Beveled edge transitioning from floor down to soil
 * - Soil surface with procedural color variation
 */

// Color palette from design plan
const COLORS = {
  floorVoid: '#5a4a3d',      // Warm brown floor
  excavationLip: '#3d2817',  // Dark earth at edge
  soilBase: '#4a3520',       // Warm brown, desaturated
  soilHighlight: '#5c4632',  // Lighter patches
};

// Seeded random for consistent organic variation
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Generate organic shape points with wobble
function generateOrganicShape(
  width: number,
  depth: number,
  wobbleAmount: number,
  pointCount: number,
  seed: number
): THREE.Vector2[] {
  const rand = seededRandom(seed);
  const points: THREE.Vector2[] = [];

  const halfW = width / 2;
  const halfD = depth / 2;

  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;

    // Base ellipse
    const baseX = Math.cos(angle) * halfW;
    const baseZ = Math.sin(angle) * halfD;

    // Add organic wobble - varies with angle position
    const wobble = 1 + (rand() - 0.5) * wobbleAmount;
    const x = baseX * wobble;
    const z = baseZ * wobble;

    points.push(new THREE.Vector2(x, z));
  }

  return points;
}

// Smooth noise for soil color variation
function smoothNoise(x: number, y: number, seed: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fX = x - i;
  const fY = y - j;

  const a = seededRandom(seed + i * 1000 + j)();
  const b = seededRandom(seed + (i + 1) * 1000 + j)();
  const c = seededRandom(seed + i * 1000 + (j + 1))();
  const d = seededRandom(seed + (i + 1) * 1000 + (j + 1))();

  // Smooth interpolation
  const u = fX * fX * (3 - 2 * fX);
  const v = fY * fY * (3 - 2 * fY);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Floor plane - everything OUTSIDE the excavation (has a HOLE for the bed)
 * Large organic ellipse with emissive glow
 *
 * GLOW responds to mood:
 * - Negative: Sweet yellow-orange glow
 * - Neutral: Dim warm neutral light
 * - Positive: Dark musty grey-blue
 */
const FloorVoid: React.FC<{ moodValence: number }> = ({ moodValence }) => {
  const gradientMap = useMemo(() => getToonGradient(), []);
  const materialRef = useRef<THREE.MeshToonMaterial>(null);

  // Base color - dark so emissive glow is the main color
  const floorColor = useMemo(() => {
    return new THREE.Color('#222018');
  }, []);

  // Persistent Color ref for emissive — mutated in-place to avoid creating new objects
  const emissiveColorRef = useRef(new THREE.Color('#996633'));

  // Emissive intensity
  const emissiveIntensity = useMemo(() => {
    if (moodValence < 0) {
      return 0.5 + Math.abs(moodValence) * 0.2;
    } else {
      return 0.5;
    }
  }, [moodValence]);

  // Update emissive color via ref mutation instead of creating new THREE.Color objects
  useEffect(() => {
    const neutral = new THREE.Color('#996633');
    if (moodValence < 0) {
      const warm = new THREE.Color('#ff9922');
      emissiveColorRef.current.copy(neutral).lerp(warm, Math.abs(moodValence));
    } else {
      const cool = new THREE.Color('#334466');
      emissiveColorRef.current.copy(neutral).lerp(cool, moodValence);
    }
    if (materialRef.current) {
      materialRef.current.emissive.copy(emissiveColorRef.current);
    }
  }, [moodValence]);

  const geometry = useMemo(() => {
    // Outer shape: large organic ellipse
    const outerPoints = generateOrganicShape(
      80, 70,   // Large ellipse
      0.05,     // Subtle wobble
      64,       // Smooth curve
      123       // Different seed from excavation
    );

    // Inner hole: matches the excavation edge outer boundary
    const holePoints = generateOrganicShape(
      GROUND_BOUNDS.width + 2,  // Same as excavation edge outer
      GROUND_BOUNDS.depth + 2,
      0.08,
      64,
      42  // Same seed as excavation for alignment
    );

    // Create shape with hole
    const outerShape = new THREE.Shape(outerPoints);
    const holePath = new THREE.Path(holePoints);
    outerShape.holes.push(holePath);

    const geo = new THREE.ShapeGeometry(outerShape, 48);
    geo.rotateX(-Math.PI / 2);

    return geo;
  }, []);

  return (
    <mesh geometry={geometry} position={[0, -0.01, 0]} receiveShadow>
      <meshToonMaterial
        ref={materialRef}
        color={floorColor}
        emissive={emissiveColorRef.current}
        emissiveIntensity={emissiveIntensity}
        gradientMap={gradientMap}
        toneMapped={false}
      />
    </mesh>
  );
};

/**
 * BedWall - Raised wall around the bed edge
 * Extrudes UPWARD from ground level to create a lip around the soil
 */
const BedWall: React.FC = () => {
  const gradientMap = useMemo(() => getToonGradient(), []);

  const geometry = useMemo(() => {
    // Outer edge: matches floor hole
    const outerPoints = generateOrganicShape(
      GROUND_BOUNDS.width + 2,
      GROUND_BOUNDS.depth + 2,
      0.08,
      64,
      42
    );

    // Inner edge: matches soil
    const innerPoints = generateOrganicShape(
      GROUND_BOUNDS.width - 0.5,
      GROUND_BOUNDS.depth - 0.5,
      0.08,
      64,
      42
    );

    // Create ring shape
    const outerShape = new THREE.Shape(outerPoints);
    const innerPath = new THREE.Path(innerPoints);
    outerShape.holes.push(innerPath);

    // Extrude UPWARD to create the raised wall
    const extrudeSettings = {
      depth: 1.2,  // Wall height
      bevelEnabled: true,
      bevelThickness: 0.2,
      bevelSize: 0.2,
      bevelSegments: 2,
    };

    const geo = new THREE.ExtrudeGeometry(outerShape, extrudeSettings);

    // Rotate to horizontal (shape is in XY, we want XZ)
    // After rotation, extrusion goes in -Y direction, so we position it to go up
    geo.rotateX(-Math.PI / 2);

    return geo;
  }, []);

  return (
    <mesh geometry={geometry} position={[0, 0, 0]} receiveShadow castShadow>
      <meshToonMaterial
        color={COLORS.excavationLip}
        gradientMap={gradientMap}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

/**
 * Soil surface - the bottom of the excavation where plants grow
 * Static brown with texture variation - NO mood response
 */
const SoilSurface: React.FC = () => {
  // Create geometry with static brown vertex colors (no mood response)
  const geometry = useMemo(() => {
    const points = generateOrganicShape(
      GROUND_BOUNDS.width - 0.5,
      GROUND_BOUNDS.depth - 0.5,
      0.08,
      64,
      42  // Same seed as excavation edge
    );

    const shape = new THREE.Shape(points);
    const geo = new THREE.ShapeGeometry(shape, 32);
    geo.rotateX(-Math.PI / 2);

    // Add vertex colors - static brown palette with texture variation
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);

    // Static brown palette
    const soilColors = [
      new THREE.Color('#4a3520'),
      new THREE.Color('#5a4530'),
      new THREE.Color('#6a5540'),
    ];

    for (let i = 0; i < count; i++) {
      const x = geo.attributes.position.getX(i);
      const z = geo.attributes.position.getZ(i);

      // Noise for patches
      const n = smoothNoise(x * 0.3, z * 0.3, 42);

      // Pick color from palette based on noise
      let finalColor: THREE.Color;
      if (n < 0.4) {
        finalColor = new THREE.Color().lerpColors(soilColors[0], soilColors[1], n / 0.4);
      } else {
        finalColor = new THREE.Color().lerpColors(soilColors[1], soilColors[2], (n - 0.4) / 0.6);
      }

      colors[i * 3] = finalColor.r;
      colors[i * 3 + 1] = finalColor.g;
      colors[i * 3 + 2] = finalColor.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []); // Static - no dependencies

  return (
    <mesh
      geometry={geometry}
      position={[0, 0, 0]}  // At ground level where plants are
      receiveShadow
    >
      <meshLambertMaterial vertexColors />
    </mesh>
  );
};

interface ExcavatedBedProps {
  moodValence?: number;
}

/**
 * Main ExcavatedBed component
 * Composes floor, edge, and soil into a unified ground system
 * Floor and soil both respond to mood (wet vs dry)
 */
export const ExcavatedBed: React.FC<ExcavatedBedProps> = ({
  moodValence = 0,
}) => {
  return (
    <group>
      <FloorVoid moodValence={moodValence} />
      <BedWall />
      <SoilSurface />
    </group>
  );
};

export default ExcavatedBed;
