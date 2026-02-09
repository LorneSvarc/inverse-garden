import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

/**
 * SceneLighting - Unified lighting system for the garden
 *
 * Combines directional (sun), hemisphere (fill), and ambient lights
 * into a single component that responds to time of day.
 *
 * Shadow modes are configurable for prototyping different approaches.
 */

export type ShadowMode = 'none' | 'soft' | 'sharp' | 'blob';

interface SceneLightingProps {
  hour: number;                    // 0-24
  shadowMode?: ShadowMode;         // Shadow rendering approach
  debugMode?: boolean;             // Show light positions
}

// Sun position calculation (same arc as before)
function getSunPosition(hour: number, distance: number = 50): [number, number, number] {
  // Sun rises at 6, peaks at 12, sets at 18
  const dayProgress = (hour - 6) / 12; // 0 at 6am, 1 at 6pm
  const angle = dayProgress * Math.PI;
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;
  return [x, Math.max(y, -10), 0];
}

// Light intensity and color based on time
function getSunProperties(hour: number): { intensity: number; color: string } {
  // Night (before 6am, after 8pm)
  if (hour < 6 || hour >= 20) {
    return { intensity: 0.1, color: '#aabbff' }; // Moonlight
  }

  // Dawn (6-8am)
  if (hour < 8) {
    const t = (hour - 6) / 2;
    return {
      intensity: 0.3 + t * 0.7,
      color: '#fff5e0', // Warm
    };
  }

  // Day (8am-5pm)
  if (hour < 17) {
    return { intensity: 1.2, color: '#ffffff' };
  }

  // Dusk (5-8pm)
  if (hour < 20) {
    const t = (hour - 17) / 3;
    return {
      intensity: 1.2 - t * 1.0,
      color: t < 0.5 ? '#ffcc88' : '#ff9955',
    };
  }

  return { intensity: 0.1, color: '#aabbff' };
}

// Hemisphere light colors based on time
function getHemisphereColors(hour: number): { sky: string; ground: string } {
  // Night
  if (hour < 6 || hour >= 20) {
    return { sky: '#1a1a2a', ground: '#1a1008' };
  }

  // Dawn/Dusk
  if (hour < 8 || hour >= 17) {
    return { sky: '#8a7a9a', ground: '#362312' };
  }

  // Day
  return { sky: '#87CEEB', ground: '#362312' };
}

export const SceneLighting: React.FC<SceneLightingProps> = ({
  hour,
  shadowMode = 'soft',
  debugMode = false,
}) => {
  const directionalRef = useRef<THREE.DirectionalLight>(null);

  // Calculate all light properties
  const sunPosition = useMemo(() => getSunPosition(hour), [hour]);
  const sunProps = useMemo(() => getSunProperties(hour), [hour]);
  const hemiColors = useMemo(() => getHemisphereColors(hour), [hour]);

  // Shadow settings based on mode
  const shadowSettings = useMemo(() => {
    switch (shadowMode) {
      case 'none':
        return { enabled: false, radius: 0, bias: 0 };
      case 'sharp':
        return { enabled: true, radius: 1, bias: -0.0001 };
      case 'soft':
        return { enabled: true, radius: 4, bias: -0.0001 };
      default:
        return { enabled: false, radius: 0, bias: 0 };
    }
  }, [shadowMode]);

  // Update shadow properties imperatively
  useEffect(() => {
    if (directionalRef.current) {
      directionalRef.current.castShadow = shadowSettings.enabled;
      if (shadowSettings.enabled) {
        directionalRef.current.shadow.radius = shadowSettings.radius;
        directionalRef.current.shadow.bias = shadowSettings.bias;
        directionalRef.current.shadow.needsUpdate = true;
      }
    }
  }, [shadowSettings]);

  // Ambient intensity varies with time (brighter at night to fill shadows)
  const ambientIntensity = useMemo(() => {
    if (hour < 6 || hour >= 20) return 0.4; // Night - more ambient
    if (hour < 8 || hour >= 17) return 0.3; // Dawn/Dusk
    return 0.25; // Day - let sun do the work
  }, [hour]);

  return (
    <>
      {/* Main directional light (sun) */}
      <directionalLight
        ref={directionalRef}
        position={sunPosition}
        intensity={sunProps.intensity * Math.PI}
        color={sunProps.color}
        castShadow={shadowSettings.enabled}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={150}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />

      {/* Hemisphere light for natural fill */}
      <hemisphereLight
        args={[hemiColors.sky, hemiColors.ground, 0.4]}
      />

      {/* Ambient for base fill */}
      <ambientLight intensity={ambientIntensity} />

      {/* Debug: show sun position */}
      {debugMode && (
        <mesh position={sunPosition}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color={sunProps.color} />
        </mesh>
      )}
    </>
  );
};

export default SceneLighting;
