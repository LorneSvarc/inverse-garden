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
    // Center text vertically
    const textHeight = 7; // CHAR_HEIGHT from bitmapFont
    const yOffset = Math.floor((bricksY - textHeight) / 2);

    return new Set(
      pixels.map(([px, py]) => {
        const bx = xOffset + px;
        // Flip Y: py=0 is top of character, but brick y=0 is bottom of wall
        // So we need to invert: top of text (py=0) should map to higher brick Y
        const by = yOffset + (textHeight - 1 - py);
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

  // Unlit brick emissive - makes wall visible during day without external light
  const unlitEmissiveIntensity = useMemo(() => {
    if (!wallEmissiveEnabled) return 0;

    let baseIntensity: number;
    // Night: no emissive
    if (hour < 5 || hour >= 21) baseIntensity = 0;
    // Dawn/dusk: subtle
    else if (hour < 7 || hour >= 19) baseIntensity = 0.15;
    // Day: visible
    else baseIntensity = 0.25;

    return baseIntensity * wallEmissiveStrength;
  }, [hour, wallEmissiveEnabled, wallEmissiveStrength]);

  const unlitEmissiveColor = useMemo(() => {
    if (hour < 7 || hour >= 19) return '#ffddbb';  // Warm golden
    return '#fffaf5';  // Neutral white
  }, [hour]);

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

      {/* Unlit bricks - time-based emissive for visibility */}
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
            emissive={unlitEmissiveColor}
            emissiveIntensity={unlitEmissiveIntensity}
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

      {/* Point light to cast colored light onto the garden */}
      {/* Position: forward of wall (z=15 relative = world z=-15), lower to hit ground */}
      {litBrickPositions.length > 0 && (
        <pointLight
          position={[0, -5, 20]}
          color={ledColor}
          intensity={ledIntensity * 4 * Math.PI}
          distance={60}
          decay={2}
        />
      )}

    </group>
  );
};

export default LEDWall;
