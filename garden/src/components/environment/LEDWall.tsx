import React, { useMemo } from 'react';
import * as THREE from 'three';
import { stringToPixels, centerText } from '../../utils/bitmapFont';

/**
 * LEDWall - The dominant light source for the scene
 *
 * The wall doesn't just display text - it FILLS the scene with color.
 * A RectAreaLight casts the LED color onto the garden.
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

export const LEDWall: React.FC<LEDWallProps> = ({
  text,
  width = 50,
  height = 18,
  position = [0, 8, -20],
  glowColor,
  glowIntensity = 2.0,  // DOUBLED from 1.0
  moodValence = 0,
}) => {
  const bricksX = Math.floor(width / (BRICK_WIDTH + MORTAR_GAP));
  const bricksY = Math.floor(height / (BRICK_HEIGHT + MORTAR_GAP));

  const litBricks = useMemo(() => {
    const pixels = stringToPixels(text);
    const xOffset = centerText(text, bricksX);
    const yOffset = Math.floor(bricksY * 0.3);

    return new Set(
      pixels.map(([px, py]) => {
        const bx = xOffset + px;
        const by = yOffset + py;
        return `${bx},${by}`;
      })
    );
  }, [text, bricksX, bricksY]);

  const ledColor = useMemo(() => {
    if (glowColor) return new THREE.Color(glowColor);
    return getLEDColor(moodValence);
  }, [glowColor, moodValence]);

  const ledIntensity = useMemo(() => {
    return getLEDIntensity(glowIntensity, moodValence);
  }, [glowIntensity, moodValence]);

  const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const bricks = useMemo(() => {
    const result: {
      position: [number, number, number];
      isLit: boolean;
      scale: [number, number, number];
      rotationZ: number;
    }[] = [];

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

        result.push({
          position: [brickX + posJitterX, brickY + posJitterY, 0],
          isLit: litBricks.has(`${x},${y}`),
          scale: [scaleVar, scaleVar + (seededRandom(seed + 4) - 0.5) * 0.02, 1],
          rotationZ: rotVar,
        });
      }
    }

    return result;
  }, [bricksX, bricksY, width, height, litBricks]);

  const litBrickPositions = bricks.filter(b => b.isLit);
  const unlitBrickPositions = bricks.filter(b => !b.isLit);

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

      {/* Unlit bricks - lighter, more visible */}
      {unlitBrickPositions.map((brick, i) => (
        <mesh
          key={`unlit-${i}`}
          position={[brick.position[0], brick.position[1], 0.05]}
          scale={brick.scale}
          rotation={[0, 0, brick.rotationZ]}
        >
          <boxGeometry args={[BRICK_WIDTH, BRICK_HEIGHT, 0.1]} />
          <meshStandardMaterial
            color={COLORS.brick}
            roughness={0.75}
          />
        </mesh>
      ))}

      {/* Lit bricks - emissive CAPPED at 2.0 to prevent HDR blowout */}
      {litBrickPositions.map((brick, i) => (
        <mesh
          key={`lit-${i}`}
          position={[brick.position[0], brick.position[1], 0.08]}
          scale={brick.scale}
          rotation={[0, 0, brick.rotationZ]}
        >
          <boxGeometry args={[BRICK_WIDTH, BRICK_HEIGHT, 0.12]} />
          <meshStandardMaterial
            color={ledColor}
            emissive={ledColor}
            emissiveIntensity={Math.min(2.0, ledIntensity * 1.2)}  // CAPPED (was *5)
            roughness={0.1}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Point lights to cast color onto the scene (RectAreaLight not available in drei) */}
      {litBrickPositions.length > 0 && (
        <pointLight
          position={[0, 0, 5]}
          color={ledColor}
          intensity={ledIntensity * 2}
          distance={40}
          decay={2}
        />
      )}
    </group>
  );
};

export default LEDWall;
