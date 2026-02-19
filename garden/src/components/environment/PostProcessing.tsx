import React, { useMemo } from 'react';
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
  HueSaturation,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';

/**
 * PostProcessing v10 - The Observation Garden (Restrained)
 *
 * God rays removed (never functional — broken ref chain + mood threshold).
 *
 * The key concept:
 * - Negative mood (-1): RADIANT - boosted saturation, bloom
 * - Neutral (0): Normal rendering
 * - Positive mood (+1): OVERCAST - desaturated, soft
 */

interface PostProcessingProps {
  bloomIntensity?: number;
  bloomThreshold?: number;
  bloomRadius?: number;
  vignetteStrength?: number;
  chromaticAberration?: boolean;
  moodValence?: number;  // -1 to 1, affects radiance vs gloom
}

export const PostProcessing: React.FC<PostProcessingProps> = ({
  bloomIntensity = 1.0,
  bloomThreshold = 0.4,
  bloomRadius = 0.7,
  vignetteStrength = 0.2,
  chromaticAberration = false,
  moodValence = 0,
}) => {
  // Calculate mood-based adjustments - RESTRAINED values
  const moodEffects = useMemo(() => {
    // Negative mood = radiant, positive mood = gloomy
    const isRadiant = moodValence < -0.3;

    // Saturation: ±0.2 (REDUCED from ±0.4)
    const saturationAdjust = -moodValence * 0.2; // -1 -> +0.2, +1 -> -0.2

    // Bloom: subtle variation
    const bloomMod = isRadiant
      ? 1.0 + Math.abs(moodValence) * 0.3  // up to 1.3x
      : 1.0 - Math.max(0, moodValence) * 0.3;  // down to 0.7x

    // Vignette: REDUCED max (0.5 to 1.5x of base, which is now 0.2)
    const vignetteMod = 1.0 + moodValence * 0.5;

    return {
      saturationAdjust,
      bloomMod,
      vignetteMod,
    };
  }, [moodValence]);

  const adjustedBloomIntensity = bloomIntensity * moodEffects.bloomMod;
  const adjustedVignette = vignetteStrength * moodEffects.vignetteMod;

  return (
    <EffectComposer>
      {/* Bloom - DISABLED for diagnostic: testing if bloom causes plant white-out */}
      {/* <Bloom
        intensity={adjustedBloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.95}
        radius={bloomRadius}
        blendFunction={BlendFunction.ADD}
      /> */}

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
