import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { LayoutDebugInfo } from '../utils/positionCalculator';
import { LAYOUT_CONFIG } from '../config/environmentConfig';

interface LayoutDebugOverlayProps {
  debugInfo: LayoutDebugInfo;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Debug visualization for the week-per-row positioning system.
 *
 * Renders:
 * - Translucent row bands for each week
 * - Small circles at each day slot center
 * - Labels with week date range and day slot info
 */
export default function PatchDebugOverlay({ debugInfo }: LayoutDebugOverlayProps) {
  const { weekRows, daySlots } = debugInfo;

  const rowHeight = LAYOUT_CONFIG.rowSpacing;
  const slotWidth = LAYOUT_CONFIG.daySlotWidth;
  const clusterRadius = LAYOUT_CONFIG.entryClusterRadius;

  // Day slots colored by entry count
  const coloredSlots = useMemo(() => {
    return daySlots.map((slot) => {
      let color: string;
      let opacity: number;

      if (slot.entryCount === 0) {
        color = '#4488ff';
        opacity = 0.08;
      } else if (slot.entryCount <= 2) {
        color = '#44cc44';
        opacity = 0.15;
      } else {
        color = '#cccc44';
        opacity = 0.2;
      }

      return { ...slot, color, opacity };
    });
  }, [daySlots]);

  return (
    <group>
      {/* Week row bands */}
      {weekRows.map((row) => (
        <group key={`week-${row.weekIndex}`} position={[0, 0.02, row.centerZ]}>
          {/* Row background band */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[slotWidth * 7, rowHeight * 0.9]} />
            <meshBasicMaterial
              color={row.weekIndex % 2 === 0 ? '#335577' : '#553377'}
              transparent
              opacity={0.08}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* Week label */}
          <Html
            position={[-slotWidth * 3.5 - 1.5, 0.5, 0]}
            center
            style={{
              fontSize: '9px',
              color: 'white',
              background: 'rgba(0,0,0,0.7)',
              padding: '2px 5px',
              borderRadius: '3px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            W{row.weekIndex} · {row.startDate.slice(5)}→{row.endDate.slice(5)} ({row.entryCount})
          </Html>
        </group>
      ))}

      {/* Day slot circles */}
      {coloredSlots.map((slot) => (
        <group key={`day-${slot.dateStr}`} position={[slot.center[0], 0.04, slot.center[1]]}>
          {/* Cluster radius circle */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[clusterRadius - 0.03, clusterRadius, 24]} />
            <meshBasicMaterial
              color={slot.color}
              transparent
              opacity={slot.opacity + 0.15}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* Filled circle */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[clusterRadius, 24]} />
            <meshBasicMaterial
              color={slot.color}
              transparent
              opacity={slot.opacity}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* Day label */}
          <Html
            position={[0, 0.5, 0]}
            center
            style={{
              fontSize: '9px',
              color: 'white',
              background: 'rgba(0,0,0,0.6)',
              padding: '1px 3px',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {DAY_LABELS[slot.dayIndex]} · {slot.dateStr.slice(5)}
            {slot.entryCount > 0 ? ` (${slot.entryCount})` : ''}
          </Html>
        </group>
      ))}
    </group>
  );
}
