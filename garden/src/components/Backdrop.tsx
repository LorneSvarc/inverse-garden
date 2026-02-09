import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';

/**
 * Backdrop - A curved atmospheric gradient behind the garden
 *
 * Replaces the ProceduralSky sphere with a more intimate, theatrical approach.
 * This is a cyclorama-style backdrop, not a literal sky - it suggests atmosphere
 * without trying to be realistic.
 *
 * The backdrop curves behind and above the garden, providing:
 * - Time-of-day color shifts (dawn/day/dusk/night)
 * - Weather/mood saturation adjustments
 * - A contained feeling (exhibit, not infinite space)
 */

// Time-of-day color presets
const TIME_COLORS = {
  night: {
    zenith: '#0a0a15',   // Deep blue-black
    horizon: '#1a1a2a',  // Slightly lighter navy
  },
  dawn: {
    zenith: '#5c7a9c',   // Soft blue
    horizon: '#e8a088',  // Warm peach/pink
  },
  day: {
    zenith: '#4a90c2',   // Clear sky blue
    horizon: '#e8e4d8',  // Warm cream
  },
  dusk: {
    zenith: '#6a5a8c',   // Purple
    horizon: '#e8a078',  // Orange
  },
};

interface BackdropProps {
  hour: number;              // 0-24
  saturation?: number;       // 0-1, for weather effects (default 1)
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
 * Apply saturation adjustment to a color
 */
function adjustSaturation(color: THREE.Color, saturation: number): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  const adjusted = new THREE.Color();
  adjusted.setHSL(hsl.h, hsl.s * saturation, hsl.l);
  return adjusted;
}

/**
 * Custom shader for smooth gradient
 */
const backdropVertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const backdropFragmentShader = `
  uniform vec3 zenithColor;
  uniform vec3 horizonColor;
  varying vec3 vWorldPosition;

  void main() {
    // Normalize position to get direction from origin
    vec3 dir = normalize(vWorldPosition);

    // Use Y component for gradient (0 at horizon, 1 at top)
    // Add slight curve for more natural feel
    float t = pow(max(0.0, dir.y), 0.7);

    // Interpolate between horizon and zenith
    vec3 color = mix(horizonColor, zenithColor, t);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const Backdrop: React.FC<BackdropProps> = ({
  hour,
  saturation = 1,
}) => {
  // Calculate colors based on time
  const { zenith, horizon } = useMemo(() => {
    const colors = getTimeColors(hour);

    // Apply saturation adjustment for weather
    return {
      zenith: adjustSaturation(colors.zenith, saturation),
      horizon: adjustSaturation(colors.horizon, saturation),
    };
  }, [hour, saturation]);

  // Create shader material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        zenithColor: { value: zenith },
        horizonColor: { value: horizon },
      },
      vertexShader: backdropVertexShader,
      fragmentShader: backdropFragmentShader,
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
      <sphereGeometry args={[300, 32, 32]} />
    </mesh>
  );
};

export default Backdrop;
