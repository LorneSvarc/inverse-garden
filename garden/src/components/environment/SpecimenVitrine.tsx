import React, { useMemo, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ProceduralSky } from './ProceduralSky';
import { LEDWall } from './LEDWall';
import { TheatricalLighting } from './TheatricalLighting';
import { SunMesh } from './SunMesh';
import { ExcavatedBed } from '../ExcavatedBed';
import { ToonClouds } from './ToonClouds';

/**
 * SpecimenVitrine v9 - The Observation Garden
 *
 * Redesigned to extend the authored quality of ExcavatedBed + plants to everything:
 * - ExcavatedBed: Organic wobble edges, beveled transition, procedural soil
 * - Consistent toon-shaded aesthetic throughout
 * - Dynamic lighting that follows sun arc (shadows move with time)
 * - Capped intensities to prevent HDR blowout
 *
 * Mood inversion:
 * - Very Negative (-1): RADIANT - god rays, warm light, sharp shadows
 * - Neutral (0): Balanced
 * - Very Positive (+1): OVERCAST - clouds, cool light, soft shadows
 */

/**
 * AtmosphericFog - Catches the glow, adds depth
 */
const AtmosphericFog: React.FC<{ density?: number; color?: string }> = ({
  density = 0.008,
  color = '#1a1515',
}) => {
  const { scene } = useThree();

  useMemo(() => {
    scene.fog = new THREE.FogExp2(color, density);
    return () => {
      scene.fog = null;
    };
  }, [scene, color, density]);

  return null;
};

interface SpecimenVitrineProps {
  hour?: number;
  moodValence?: number;
  valenceText?: string;
  showRim?: boolean;
  shadowsEnabled?: boolean;
  fogDensity?: number;
  cloudsEnabled?: boolean;
  wallEmissiveEnabled?: boolean;
  wallEmissiveStrength?: number;
  onSunMeshReady?: (mesh: THREE.Mesh | null) => void;  // Callback to pass sun mesh to parent
}

export const SpecimenVitrine: React.FC<SpecimenVitrineProps> = ({
  hour = 12,
  moodValence = 0,
  valenceText = 'NEUTRAL',
  shadowsEnabled = true,
  fogDensity: fogDensityProp,
  cloudsEnabled = true,
  wallEmissiveEnabled = true,
  wallEmissiveStrength = 1.0,
  onSunMeshReady,
}) => {
  const sunRef = useRef<THREE.Mesh>(null);

  // Pass the sun mesh reference to parent when it's ready
  const handleSunRef = useCallback((mesh: THREE.Mesh | null) => {
    if (onSunMeshReady) {
      onSunMeshReady(mesh);
    }
  }, [onSunMeshReady]);

  // Atmosphere clarity: negative mood = clear, positive = overcast
  const atmosphereClarity = (-moodValence + 1) / 2;

  // Fog responds to mood:
  // - Negative (radiant): Less fog, warmer tint
  // - Positive (overcast): More fog, cooler tint
  const fogColor = useMemo(() => {
    if (moodValence < 0) {
      // Radiant: warm, clear
      return '#1a1512';
    } else {
      // Overcast: cool, hazy
      return '#101215';
    }
  }, [moodValence]);

  const fogDensity = useMemo(() => {
    if (fogDensityProp !== undefined) return fogDensityProp;
    // Base fog + mood adjustment
    // Negative: clearer (less fog)
    // Positive: hazier (more fog)
    const baseFog = 0.006;
    const moodFog = moodValence > 0 ? moodValence * 0.006 : 0;
    return baseFog + moodFog;
  }, [fogDensityProp, moodValence]);

  // Shadow softness: sharper when clear (negative), softer when overcast (positive)
  const shadowSoftness = useMemo(() => {
    // Negative mood: sharp shadows (1-2)
    // Positive mood: soft shadows (3-5)
    return 1 + (1 - atmosphereClarity) * 4;
  }, [atmosphereClarity]);

  return (
    <group>
      {/* Fog to catch the glow and add depth */}
      <AtmosphericFog density={fogDensity} color={fogColor} />

      {/* Authored procedural sky - time and mood responsive */}
      <ProceduralSky hour={hour} moodValence={moodValence} />

      {/* Toon clouds - coverage increases with positive mood (overcast) */}
      {cloudsEnabled && (
        <ToonClouds
          moodValence={moodValence}
          hour={hour}
          height={28}
        />
      )}

      {/* Sun mesh - visible for radiant days, source for god rays */}
      <SunMesh
        ref={(mesh) => {
          // Store locally and pass to parent
          (sunRef as React.MutableRefObject<THREE.Mesh | null>).current = mesh;
          handleSunRef(mesh);
        }}
        hour={hour}
        moodValence={moodValence}
        size={8}
        distance={60}
      />

      {/* ExcavatedBed - soil inside (no glow), floor outside (subtle glow) */}
      <ExcavatedBed moodValence={moodValence} />

      {/* LED wall - displays the valence text */}
      {/* Wall center at y=9.5, height=18: bottom at y=0.5, with 1.0 base footer reaching y=-0.5 */}
      <LEDWall
        text={valenceText}
        width={50}
        height={18}
        position={[0, 10, -30]}
        moodValence={moodValence}
        glowIntensity={2.0}
        hour={hour}
        wallEmissiveEnabled={wallEmissiveEnabled}
        wallEmissiveStrength={wallEmissiveStrength}
      />

      {/* Time-of-day lighting */}
      <TheatricalLighting
        hour={hour}
        moodValence={moodValence}
        shadowsEnabled={shadowsEnabled}
        shadowSoftness={shadowSoftness}
      />
    </group>
  );
};

export default SpecimenVitrine;
