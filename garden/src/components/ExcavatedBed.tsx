import React, { useMemo } from 'react';
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
  floorVoid: '#0a0808',      // Near-black, absorbs light
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
 * Floor plane - the dark void surrounding the excavation
 */
const FloorVoid: React.FC = () => {
  const gradientMap = useMemo(() => getToonGradient(), []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshToonMaterial
        color={COLORS.floorVoid}
        gradientMap={gradientMap}
      />
    </mesh>
  );
};

/**
 * Excavation edge - beveled transition from floor to soil
 */
const ExcavationEdge: React.FC = () => {
  const gradientMap = useMemo(() => getToonGradient(), []);

  const geometry = useMemo(() => {
    // Generate organic outline
    const outerPoints = generateOrganicShape(
      GROUND_BOUNDS.width + 2,  // Slightly larger than soil
      GROUND_BOUNDS.depth + 2,
      0.08,  // Subtle wobble
      64,    // Smooth curve
      42     // Seed for consistency
    );

    const innerPoints = generateOrganicShape(
      GROUND_BOUNDS.width - 0.5,
      GROUND_BOUNDS.depth - 0.5,
      0.08,
      64,
      42  // Same seed so shapes align
    );

    // Create shape with hole
    const outerShape = new THREE.Shape(outerPoints);
    const innerPath = new THREE.Path(innerPoints);
    outerShape.holes.push(innerPath);

    // Extrude downward to create the bevel
    const extrudeSettings = {
      depth: 1.5,  // Depth of excavation edge
      bevelEnabled: true,
      bevelThickness: 0.3,
      bevelSize: 0.3,
      bevelSegments: 3,
    };

    const geo = new THREE.ExtrudeGeometry(outerShape, extrudeSettings);

    // Rotate to horizontal (shape is in XY, we want XZ)
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
 */
const SoilSurface: React.FC = () => {
  const gradientMap = useMemo(() => getToonGradient(), []);

  const geometry = useMemo(() => {
    // Generate organic soil shape (matches inner edge of excavation)
    const points = generateOrganicShape(
      GROUND_BOUNDS.width - 0.5,
      GROUND_BOUNDS.depth - 0.5,
      0.08,
      64,
      42  // Same seed as excavation edge
    );

    const shape = new THREE.Shape(points);
    const geo = new THREE.ShapeGeometry(shape, 32);

    // Rotate to horizontal
    geo.rotateX(-Math.PI / 2);

    // Apply procedural soil colors via vertex colors
    const count = geo.attributes.position.count;
    const colorArray = new Float32Array(count * 3);

    const color1 = new THREE.Color(COLORS.soilBase);
    const color2 = new THREE.Color(COLORS.soilHighlight);
    const color3 = new THREE.Color(COLORS.excavationLip);

    for (let i = 0; i < count; i++) {
      const x = geo.attributes.position.getX(i);
      const z = geo.attributes.position.getZ(i);

      // Multi-octave noise for natural patches
      const n1 = smoothNoise(x * 0.15, z * 0.15, 123);
      const n2 = smoothNoise(x * 0.4, z * 0.4, 456) * 0.3;
      const n = Math.min(1, Math.max(0, n1 + n2));

      // Blend between soil colors
      const c = new THREE.Color();
      if (n < 0.4) {
        c.lerpColors(color3, color1, n / 0.4);
      } else if (n < 0.7) {
        c.lerpColors(color1, color2, (n - 0.4) / 0.3);
      } else {
        c.copy(color2);
      }

      colorArray[i * 3] = c.r;
      colorArray[i * 3 + 1] = c.g;
      colorArray[i * 3 + 2] = c.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

    return geo;
  }, []);

  return (
    <mesh
      geometry={geometry}
      position={[0, -1.5, 0]}  // At bottom of excavation
      receiveShadow
    >
      <meshToonMaterial
        vertexColors
        gradientMap={gradientMap}
      />
    </mesh>
  );
};

/**
 * Main ExcavatedBed component
 * Composes floor, edge, and soil into a unified ground system
 */
export const ExcavatedBed: React.FC = () => {
  return (
    <group>
      <FloorVoid />
      <ExcavationEdge />
      <SoilSurface />
    </group>
  );
};

export default ExcavatedBed;
