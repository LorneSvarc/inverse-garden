import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * EmissiveGround v6 - Time-Responsive Glowing Surface
 *
 * The ground glows, but now coordinates with time-of-day lighting.
 * During DAY: Emissive fades to subtle underlighting (sun is hero)
 * During NIGHT: Emissive rises to become the primary light source
 *
 * Colors are desaturated to avoid competing with plant hues.
 */

interface EmissiveGroundProps {
  moodValence?: number;  // -1 = warm, +1 = cool
  hour?: number;         // 0-24, controls emissive intensity
  radius?: number;
}

// Desaturated colors that don't compete with plants
const COLORS = {
  warm: '#e8c8a8',    // Warm cream (was #ff6600)
  cool: '#c8d8e8',    // Cool mist (was #00ccff)
};

/**
 * Calculate emissive intensity based on time of day and mood
 * - Night: high emissive (ground is the light source)
 * - Day: low emissive (sun is the light source)
 * - Mood affects intensity slightly (overcast = more emissive)
 */
function getEmissiveIntensity(hour: number, moodValence: number): number {
  const atmosphereClarity = (-moodValence + 1) / 2; // 1 = clear, 0 = overcast

  let base: number;

  // Night (0-5, 21-24): High emissive - ground is the hero
  if (hour < 5 || hour >= 21) {
    base = 0.9;
  }
  // Dawn (5-7): Emissive fading as sun rises
  else if (hour < 7) {
    const t = (hour - 5) / 2;
    base = 0.9 - t * 0.65; // 0.9 → 0.25
  }
  // Day (7-17): Low emissive - sun dominates
  else if (hour < 17) {
    base = 0.2;
  }
  // Pre-dusk (17-19): Emissive beginning to rise
  else if (hour < 19) {
    const t = (hour - 17) / 2;
    base = 0.2 + t * 0.35; // 0.2 → 0.55
  }
  // Evening (19-21): Emissive rising as sun sets
  else {
    const t = (hour - 19) / 2;
    base = 0.55 + t * 0.35; // 0.55 → 0.9
  }

  // Mood modifier: overcast (positive mood) = more emissive
  const moodMod = 0.8 + (1 - atmosphereClarity) * 0.4;

  return base * moodMod;
}

function getMoodColor(moodValence: number): THREE.Color {
  const t = (moodValence + 1) / 2; // 0 to 1
  const warm = new THREE.Color(COLORS.warm);
  const cool = new THREE.Color(COLORS.cool);
  return warm.lerp(cool, t);
}

function getDarkerVariant(color: THREE.Color): THREE.Color {
  const darker = color.clone();
  darker.multiplyScalar(0.7); // Slightly brighter dark variant
  return darker;
}

export const EmissiveGround: React.FC<EmissiveGroundProps> = ({
  moodValence = 0,
  hour = 12,  // Default to noon
  radius = 50,
}) => {
  // Calculate time-responsive intensity
  const intensity = useMemo(
    () => getEmissiveIntensity(hour, moodValence),
    [hour, moodValence]
  );

  const primaryColor = useMemo(() => getMoodColor(moodValence), [moodValence]);
  const secondaryColor = useMemo(() => getDarkerVariant(primaryColor), [primaryColor]);

  return (
    <group>
      {/* PRIMARY EMISSIVE GROUND - This is the main light source */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[radius, 64]} />
        <meshStandardMaterial
          color={primaryColor}
          emissive={primaryColor}
          emissiveIntensity={intensity}
          toneMapped={false}  // CRITICAL: allows HDR values for bloom
          roughness={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* SECONDARY LAYER - Creates depth, color gradient */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -3, 0]}
      >
        <circleGeometry args={[radius * 1.3, 64]} />
        <meshStandardMaterial
          color={secondaryColor}
          emissive={secondaryColor}
          emissiveIntensity={intensity * 0.6}
          toneMapped={false}
          roughness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* OUTER GLOW - Extends the color further */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -5, 0]}
      >
        <circleGeometry args={[radius * 1.8, 64]} />
        <meshStandardMaterial
          color={secondaryColor}
          emissive={secondaryColor}
          emissiveIntensity={intensity * 0.3}
          toneMapped={false}
          transparent
          opacity={0.7}
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

export default EmissiveGround;
