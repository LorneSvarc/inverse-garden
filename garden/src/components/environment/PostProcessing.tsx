import React, { useMemo } from 'react';
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
  HueSaturation,
  GodRays,
} from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import * as THREE from 'three';

/**
 * PostProcessing v9 - The Observation Garden (Restrained)
 *
 * FIXES from v8:
 * - Bloom threshold raised to 0.5-0.6 (was 0.2 - caught too much)
 * - Vignette max reduced to 0.35 (was 0.6 - too gallery/oppressive)
 * - HueSaturation reduced to ±0.2 (was ±0.4 - too extreme)
 * - ChromaticAberration REMOVED (adds nothing to aesthetic)
 *
 * The key concept:
 * - Negative mood (-1): RADIANT - god rays (subtle), boosted saturation, bloom
 * - Neutral (0): Normal rendering
 * - Positive mood (+1): OVERCAST - no rays, desaturated, soft
 */

interface PostProcessingProps {
  bloomIntensity?: number;
  bloomThreshold?: number;
  bloomRadius?: number;
  vignetteStrength?: number;
  chromaticAberration?: boolean;
  moodValence?: number;  // -1 to 1, affects radiance vs gloom
  sunMesh?: THREE.Mesh | null;  // Reference to sun mesh for god rays
  godRaysEnabled?: boolean;
}

export const PostProcessing: React.FC<PostProcessingProps> = ({
  bloomIntensity = 1.0,       // Reduced from 1.5
  bloomThreshold = 0.4,      // Lowered so floor emissive (0.5 intensity) triggers bloom
  bloomRadius = 0.7,          // Slightly reduced
  vignetteStrength = 0.2,    // REDUCED from 0.3
  chromaticAberration = false, // DISABLED by default
  moodValence = 0,
  sunMesh = null,
  godRaysEnabled = true,
}) => {
  // Calculate mood-based adjustments - RESTRAINED values
  const moodEffects = useMemo(() => {
    // Negative mood = radiant, positive mood = gloomy
    const isRadiant = moodValence < -0.3; // Only activate for sufficiently negative

    // God rays: only for radiant days, REDUCED intensity
    const godRayIntensity = isRadiant ? Math.min(0.5, Math.abs(moodValence) * 0.5) : 0;

    // Saturation: ±0.2 (REDUCED from ±0.4)
    const saturationAdjust = -moodValence * 0.2; // -1 -> +0.2, +1 -> -0.2

    // Bloom: subtle variation
    const bloomMod = isRadiant
      ? 1.0 + Math.abs(moodValence) * 0.3  // up to 1.3x (was 1.5x)
      : 1.0 - Math.max(0, moodValence) * 0.3;  // down to 0.7x

    // Vignette: REDUCED max (0.5 to 1.5x of base, which is now 0.2)
    // So actual range is 0.1 to 0.35
    const vignetteMod = 1.0 + moodValence * 0.5;

    return {
      godRayIntensity,
      saturationAdjust,
      bloomMod,
      vignetteMod,
    };
  }, [moodValence]);

  const adjustedBloomIntensity = bloomIntensity * moodEffects.bloomMod;
  const adjustedVignette = vignetteStrength * moodEffects.vignetteMod;

  // God rays need the sun mesh reference
  const showGodRays = godRaysEnabled && sunMesh && moodEffects.godRayIntensity > 0.05;

  return (
    <EffectComposer>
      {/* God Rays - for RADIANT negative mood */}
      {showGodRays && sunMesh && (
        <GodRays
          sun={sunMesh}
          blendFunction={BlendFunction.SCREEN}
          samples={60}
          density={0.96}
          decay={0.92}
          weight={moodEffects.godRayIntensity}
          exposure={0.5}
          clampMax={1}
          kernelSize={KernelSize.SMALL}
        />
      )}

      {/* Bloom - enhanced for radiant, reduced for gloomy */}
      <Bloom
        intensity={adjustedBloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.95}
        radius={bloomRadius}
        blendFunction={BlendFunction.ADD}
      />

      {/* Saturation adjustment - key for weather feeling */}
      <HueSaturation
        saturation={moodEffects.saturationAdjust}
        hue={0}
        blendFunction={BlendFunction.NORMAL}
      />

      {/* Vignette - stronger for gloomy, lighter for radiant */}
      <Vignette
        offset={0.3}
        darkness={adjustedVignette}
        blendFunction={BlendFunction.NORMAL}
      />

      {/* Chromatic Aberration - subtle RGB split at edges */}
      {chromaticAberration && (
        <ChromaticAberration
          offset={[0.001, 0.001]}
          blendFunction={BlendFunction.NORMAL}
          radialModulation={true}
          modulationOffset={0.4}
        />
      )}
    </EffectComposer>
  );
};

export default PostProcessing;
