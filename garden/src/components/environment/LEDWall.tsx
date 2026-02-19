import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { stringToPixels, centerText } from '../../utils/bitmapFont';

/**
 * LEDWall - The dominant light source for the scene
 *
 * The wall doesn't just display text - it FILLS the scene with color.
 * A PointLight casts the LED color onto the garden.
 *
 * v11 — InstancedMesh rewrite:
 * Previously 2,494 individual <mesh> components (58×43 grid), each with its own
 * geometry + material = ~2,500 draw calls. Now uses TWO InstancedMesh instances
 * (one for lit bricks, one for unlit bricks), reducing draw calls to ~3 total.
 *
 * Colors are SATURATED:
 * - Negative mood: #ff8844 (saturated amber)
 * - Positive mood: #6699cc (actual blue, not gray)
 */

interface LEDWallProps {
  text: string;
  width?: number;
  height?: number;
  position?: [number, number, number];
  glowColor?: string;
  glowIntensity?: number;
  moodValence?: number;
  hour?: number;  // For time-responsive emissive
  wallEmissiveEnabled?: boolean;
  wallEmissiveStrength?: number;
}

const BRICK_WIDTH = 0.8;
const BRICK_HEIGHT = 0.35;
const MORTAR_GAP = 0.06;

// SATURATED colors - not muted
const COLORS = {
  brick: '#9a8570',       // Lighter brick, more visible
  mortar: '#6a5a4a',      // Warmer mortar
  ledWarm: '#ff8844',     // SATURATED amber (was #ff9955)
  ledCool: '#6699cc',     // ACTUAL blue (was #8899bb)
};

function getLEDColor(moodValence: number): THREE.Color {
  const t = (moodValence + 1) / 2;
  const warm = new THREE.Color(COLORS.ledWarm);
  const cool = new THREE.Color(COLORS.ledCool);
  return warm.lerp(cool, t);
}

function getLEDIntensity(baseIntensity: number, moodValence: number): number {
  const moodFactor = 1 - moodValence * 0.3;
  return baseIntensity * moodFactor;
}

const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Shared brick geometry — created once, reused by both InstancedMeshes.
 */
const UNLIT_BRICK_GEO = new THREE.BoxGeometry(BRICK_WIDTH, BRICK_HEIGHT, 0.1);
const LIT_BRICK_GEO = new THREE.BoxGeometry(BRICK_WIDTH, BRICK_HEIGHT, 0.12);

/**
 * UnlitBricksInstanced — single InstancedMesh for all unlit bricks
 */
const UnlitBricksInstanced: React.FC<{
  bricks: { position: [number, number, number]; scale: [number, number, number]; rotationZ: number }[];
  hour: number;
  wallEmissiveEnabled: boolean;
  wallEmissiveStrength: number;
}> = ({ bricks, hour, wallEmissiveEnabled, wallEmissiveStrength }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Build instance matrices once (brick positions are stable for a given text)
  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D();
    const result = new Float32Array(bricks.length * 16);
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      dummy.position.set(b.position[0], b.position[1], 0.05);
      dummy.scale.set(b.scale[0], b.scale[1], b.scale[2]);
      dummy.rotation.set(0, 0, b.rotationZ);
      dummy.updateMatrix();
      dummy.matrix.toArray(result, i * 16);
    }
    return result;
  }, [bricks]);

  // Apply matrices to instanced mesh
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const mat4 = new THREE.Matrix4();
    for (let i = 0; i < bricks.length; i++) {
      mat4.fromArray(matrices, i * 16);
      mesh.setMatrixAt(i, mat4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices, bricks.length]);

  // Update emissive intensity + color based on hour
  const unlitEmissiveIntensity = useMemo(() => {
    if (!wallEmissiveEnabled) return 0;
    let baseIntensity: number;
    if (hour < 5 || hour >= 21) baseIntensity = 0;
    else if (hour < 7 || hour >= 19) baseIntensity = 0.15;
    else baseIntensity = 0.25;
    return baseIntensity * wallEmissiveStrength;
  }, [hour, wallEmissiveEnabled, wallEmissiveStrength]);

  const unlitEmissiveColor = useMemo(() => {
    if (hour < 7 || hour >= 19) return '#ffddbb';
    return '#fffaf5';
  }, [hour]);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.emissive.set(unlitEmissiveColor);
      materialRef.current.emissiveIntensity = unlitEmissiveIntensity;
    }
  }, [unlitEmissiveColor, unlitEmissiveIntensity]);

  if (bricks.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[UNLIT_BRICK_GEO, undefined, bricks.length]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        ref={materialRef}
        color={COLORS.brick}
        emissive={unlitEmissiveColor}
        emissiveIntensity={unlitEmissiveIntensity}
        roughness={0.75}
      />
    </instancedMesh>
  );
};

/**
 * LitBricksInstanced — single InstancedMesh for all lit bricks
 */
const LitBricksInstanced: React.FC<{
  bricks: { position: [number, number, number]; scale: [number, number, number]; rotationZ: number }[];
  ledColor: THREE.Color;
  ledIntensity: number;
}> = ({ bricks, ledColor, ledIntensity }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Build instance matrices
  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D();
    const result = new Float32Array(bricks.length * 16);
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      dummy.position.set(b.position[0], b.position[1], 0.08);
      dummy.scale.set(b.scale[0], b.scale[1], b.scale[2]);
      dummy.rotation.set(0, 0, b.rotationZ);
      dummy.updateMatrix();
      dummy.matrix.toArray(result, i * 16);
    }
    return result;
  }, [bricks]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const mat4 = new THREE.Matrix4();
    for (let i = 0; i < bricks.length; i++) {
      mat4.fromArray(matrices, i * 16);
      mesh.setMatrixAt(i, mat4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices, bricks.length]);

  // Update material color + emissive when ledColor or intensity changes
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.color.copy(ledColor);
      materialRef.current.emissive.copy(ledColor);
      materialRef.current.emissiveIntensity = Math.min(2.0, ledIntensity * 1.2);
    }
  }, [ledColor, ledIntensity]);

  if (bricks.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[LIT_BRICK_GEO, undefined, bricks.length]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        ref={materialRef}
        color={ledColor}
        emissive={ledColor}
        emissiveIntensity={Math.min(2.0, ledIntensity * 1.2)}
        roughness={0.1}
        toneMapped={false}
      />
    </instancedMesh>
  );
};

export const LEDWall: React.FC<LEDWallProps> = ({
  text,
  width = 50,
  height = 18,
  position = [0, 8, -20],
  glowColor,
  glowIntensity = 2.0,
  moodValence = 0,
  hour = 12,
  wallEmissiveEnabled = true,
  wallEmissiveStrength = 1.0,
}) => {
  const bricksX = Math.floor(width / (BRICK_WIDTH + MORTAR_GAP));
  const bricksY = Math.floor(height / (BRICK_HEIGHT + MORTAR_GAP));

  const litBricks = useMemo(() => {
    const pixels = stringToPixels(text);
    const xOffset = centerText(text, bricksX);
    const textHeight = 7;
    const yOffset = Math.floor((bricksY - textHeight) / 2);

    return new Set(
      pixels.map(([px, py]) => {
        const bx = xOffset + px;
        const by = yOffset + (textHeight - 1 - py);
        return `${bx},${by}`;
      })
    );
  }, [text, bricksX, bricksY]);

  // Persistent Color ref — mutated in place
  const ledColorRef = useRef(new THREE.Color(COLORS.ledWarm));

  useEffect(() => {
    if (glowColor) {
      ledColorRef.current.set(glowColor);
    } else {
      ledColorRef.current.copy(getLEDColor(moodValence));
    }
  }, [glowColor, moodValence]);

  const ledIntensity = useMemo(() => {
    return getLEDIntensity(glowIntensity, moodValence);
  }, [glowIntensity, moodValence]);

  // Separate lit and unlit brick data (stable unless text changes)
  const { litBrickData, unlitBrickData } = useMemo(() => {
    const lit: { position: [number, number, number]; scale: [number, number, number]; rotationZ: number }[] = [];
    const unlit: { position: [number, number, number]; scale: [number, number, number]; rotationZ: number }[] = [];

    for (let y = 0; y < bricksY; y++) {
      const rowOffset = (y % 2) * (BRICK_WIDTH + MORTAR_GAP) / 2;

      for (let x = 0; x < bricksX; x++) {
        const seed = x * 1000 + y;
        const brickX = x * (BRICK_WIDTH + MORTAR_GAP) + rowOffset - width / 2 + BRICK_WIDTH / 2;
        const brickY = y * (BRICK_HEIGHT + MORTAR_GAP) - height / 2 + BRICK_HEIGHT / 2;

        const posJitterX = (seededRandom(seed) - 0.5) * 0.03;
        const posJitterY = (seededRandom(seed + 1) - 0.5) * 0.02;
        const scaleVar = 0.97 + seededRandom(seed + 2) * 0.06;
        const rotVar = (seededRandom(seed + 3) - 0.5) * 0.02;

        const brick = {
          position: [brickX + posJitterX, brickY + posJitterY, 0] as [number, number, number],
          scale: [scaleVar, scaleVar + (seededRandom(seed + 4) - 0.5) * 0.02, 1] as [number, number, number],
          rotationZ: rotVar,
        };

        if (litBricks.has(`${x},${y}`)) {
          lit.push(brick);
        } else {
          unlit.push(brick);
        }
      }
    }

    return { litBrickData: lit, unlitBrickData: unlit };
  }, [bricksX, bricksY, width, height, litBricks]);

  return (
    <group position={position}>
      {/* Mortar/background - warmer */}
      <mesh>
        <planeGeometry args={[width + 2, height + 2]} />
        <meshStandardMaterial
          color={COLORS.mortar}
          roughness={0.9}
        />
      </mesh>

      {/* Unlit bricks — single InstancedMesh */}
      <UnlitBricksInstanced
        bricks={unlitBrickData}
        hour={hour}
        wallEmissiveEnabled={wallEmissiveEnabled}
        wallEmissiveStrength={wallEmissiveStrength}
      />

      {/* Lit bricks — single InstancedMesh */}
      <LitBricksInstanced
        bricks={litBrickData}
        ledColor={ledColorRef.current}
        ledIntensity={ledIntensity}
      />

      {/* Point light to cast colored light onto the garden */}
      {litBrickData.length > 0 && (
        <pointLight
          position={[0, -5, 20]}
          color={ledColorRef.current}
          intensity={ledIntensity * 4 * Math.PI}
          distance={60}
          decay={2}
        />
      )}
    </group>
  );
};

export default LEDWall;
