import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { PatchDebugInfo } from '../utils/positionCalculator';

interface PatchDebugOverlayProps {
  patches: PatchDebugInfo[];
  currentTime: Date | null;
}

/**
 * Debug visualization for the patch-based positioning system.
 *
 * Renders translucent circles at each patch center showing:
 * - Green: assigned with live plants
 * - Grey: freed / available for reuse
 * - Blue outline: unassigned (never used)
 * - Small label with patch ID and assigned day
 */
export default function PatchDebugOverlay({ patches, currentTime }: PatchDebugOverlayProps) {
  const currentTimeMs = currentTime?.getTime() ?? 0;

  const circles = useMemo(() => {
    return patches.map((patch) => {
      let color: string;
      let opacity: number;

      if (!patch.assignedDay) {
        // Unassigned — never used
        color = '#4488ff';
        opacity = 0.15;
      } else if (patch.freedAtMs > 0 && patch.freedAtMs < currentTimeMs) {
        // Freed — plants have fully faded
        color = '#888888';
        opacity = 0.1;
      } else {
        // Active — has live plants
        color = '#44cc44';
        opacity = 0.2;
      }

      return { ...patch, color, opacity };
    });
  }, [patches, currentTimeMs]);

  return (
    <group>
      {circles.map((patch) => (
        <group key={patch.id} position={[patch.center[0], 0.05, patch.center[1]]}>
          {/* Circle outline */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[patch.radius - 0.05, patch.radius, 32]} />
            <meshBasicMaterial
              color={patch.color}
              transparent
              opacity={patch.opacity + 0.2}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* Filled circle */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[patch.radius, 32]} />
            <meshBasicMaterial
              color={patch.color}
              transparent
              opacity={patch.opacity}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* Label */}
          <Html
            position={[0, 0.5, 0]}
            center
            style={{
              fontSize: '10px',
              color: 'white',
              background: 'rgba(0,0,0,0.6)',
              padding: '2px 4px',
              borderRadius: '3px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            #{patch.id}
            {patch.assignedDay ? ` · ${patch.assignedDay.slice(5)}` : ''}
            {patch.plantCount > 0 ? ` (${patch.plantCount})` : ''}
          </Html>
        </group>
      ))}
    </group>
  );
}
