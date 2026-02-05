import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';

/**
 * ProceduralSky - Authored sky dome that matches the toon-shaded aesthetic
 *
 * Based on Backdrop.tsx but with:
 * - Mood-based saturation and brightness adjustment
 * - Colors designed to feel warm and intentional, not default
 * - Integration with the overall "Observation Garden" aesthetic
 *
 * Time controls color temperature:
 * - Dawn: Warm peach/gold
 * - Day: Balanced blue/cream
 * - Dusk: Rich amber/purple
 * - Night: Cool indigo
 *
 * Mood controls quality:
 * - Negative (radiant): Vivid, bright colors
 * - Neutral: Balanced
 * - Positive (overcast): Desaturated, muted colors
 */

// Time-of-day color presets - warmer and more intentional than defaults
const TIME_COLORS = {
  night: {
    zenith: '#0d1020',   // Deep indigo-blue
    horizon: '#1a1825',  // Warm dark purple
  },
  dawn: {
    zenith: '#5c7090',   // Soft blue with warmth
    horizon: '#e8a078',  // Peach/coral
  },
  day: {
    zenith: '#5a9ac8',   // Warm sky blue
    horizon: '#efe8d8',  // Warm cream
  },
  dusk: {
    zenith: '#4a4a6c',   // Blue-purple
    horizon: '#e8885a',  // Rich amber/orange
  },
};

interface ProceduralSkyProps {
  hour: number;           // 0-24
  moodValence: number;    // -1 to 1
}

/**
 * Get interpolated colors based on hour
 */
function getTimeColors(hour: number): { zenith: THREE.Color; horizon: THREE.Color } {
  // Night (0-5, 21-24)
  if (hour < 5 || hour >= 21) {
    return {
      zenith: new THREE.Color(TIME_COLORS.night.zenith),
      horizon: new THREE.Color(TIME_COLORS.night.horizon),
    };
  }

  // Dawn (5-7)
  if (hour < 7) {
    const t = (hour - 5) / 2;
    return {
      zenith: new THREE.Color(TIME_COLORS.night.zenith).lerp(
        new THREE.Color(TIME_COLORS.dawn.zenith), t
      ),
      horizon: new THREE.Color(TIME_COLORS.night.horizon).lerp(
        new THREE.Color(TIME_COLORS.dawn.horizon), t
      ),
    };
  }

  // Morning transition (7-9)
  if (hour < 9) {
    const t = (hour - 7) / 2;
    return {
      zenith: new THREE.Color(TIME_COLORS.dawn.zenith).lerp(
        new THREE.Color(TIME_COLORS.day.zenith), t
      ),
      horizon: new THREE.Color(TIME_COLORS.dawn.horizon).lerp(
        new THREE.Color(TIME_COLORS.day.horizon), t
      ),
    };
  }

  // Day (9-17)
  if (hour < 17) {
    return {
      zenith: new THREE.Color(TIME_COLORS.day.zenith),
      horizon: new THREE.Color(TIME_COLORS.day.horizon),
    };
  }

  // Evening transition (17-19)
  if (hour < 19) {
    const t = (hour - 17) / 2;
    return {
      zenith: new THREE.Color(TIME_COLORS.day.zenith).lerp(
        new THREE.Color(TIME_COLORS.dusk.zenith), t
      ),
      horizon: new THREE.Color(TIME_COLORS.day.horizon).lerp(
        new THREE.Color(TIME_COLORS.dusk.horizon), t
      ),
    };
  }

  // Dusk to night (19-21)
  const t = (hour - 19) / 2;
  return {
    zenith: new THREE.Color(TIME_COLORS.dusk.zenith).lerp(
      new THREE.Color(TIME_COLORS.night.zenith), t
    ),
    horizon: new THREE.Color(TIME_COLORS.dusk.horizon).lerp(
      new THREE.Color(TIME_COLORS.night.horizon), t
    ),
  };
}

/**
 * Apply mood-based adjustments to a color
 * - Negative mood: more saturated, slightly brighter
 * - Positive mood: desaturated, slightly darker
 */
function applyMoodAdjustment(color: THREE.Color, moodValence: number): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);

  // Saturation: negative mood = boost, positive mood = reduce
  const saturationMod = 1.0 - moodValence * 0.3; // 0.7 to 1.3
  const newSaturation = Math.max(0, Math.min(1, hsl.s * saturationMod));

  // Lightness: negative mood = slightly brighter, positive mood = slightly darker
  const lightnessMod = moodValence * -0.08; // -0.08 to +0.08
  const newLightness = Math.max(0, Math.min(1, hsl.l + lightnessMod));

  const adjusted = new THREE.Color();
  adjusted.setHSL(hsl.h, newSaturation, newLightness);
  return adjusted;
}

/**
 * Custom shader for smooth gradient
 */
const skyVertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragmentShader = `
  uniform vec3 zenithColor;
  uniform vec3 horizonColor;
  varying vec3 vWorldPosition;

  void main() {
    // Normalize position to get direction from origin
    vec3 dir = normalize(vWorldPosition);

    // Use Y component for gradient (0 at horizon, 1 at top)
    // Softer curve for more natural gradient
    float t = pow(max(0.0, dir.y), 0.6);

    // Interpolate between horizon and zenith
    vec3 color = mix(horizonColor, zenithColor, t);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const ProceduralSky: React.FC<ProceduralSkyProps> = ({
  hour,
  moodValence,
}) => {
  // Calculate colors based on time and mood
  const { zenith, horizon } = useMemo(() => {
    const baseColors = getTimeColors(hour);

    // Apply mood adjustment
    return {
      zenith: applyMoodAdjustment(baseColors.zenith, moodValence),
      horizon: applyMoodAdjustment(baseColors.horizon, moodValence),
    };
  }, [hour, moodValence]);

  // Create shader material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        zenithColor: { value: zenith },
        horizonColor: { value: horizon },
      },
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, []);

  // Update uniforms when colors change
  useEffect(() => {
    material.uniforms.zenithColor.value = zenith;
    material.uniforms.horizonColor.value = horizon;
  }, [zenith, horizon, material]);

  return (
    <mesh material={material}>
      {/* Full sphere surrounding the scene - camera is inside */}
      <sphereGeometry args={[200, 32, 32]} />
    </mesh>
  );
};

export default ProceduralSky;
