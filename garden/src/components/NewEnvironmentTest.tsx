import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import { ExcavatedBed } from './ExcavatedBed';
import { Backdrop } from './Backdrop';
import { SceneLighting, type ShadowMode } from './SceneLighting';
import CleanToonFlower3D from './CleanToonFlower3D';
import CleanToonSprout3D from './CleanToonSprout3D';
import CleanToonDecay3D from './CleanToonDecay3D';
import type { FlowerDNA, SproutDNA, DecayDNA } from '../types';

/**
 * NewEnvironmentTest - Test scene for the redesigned environment
 *
 * This scene tests the new components:
 * - ExcavatedBed (ground system)
 * - Backdrop (sky/atmosphere)
 * - SceneLighting (unified lights)
 *
 * Includes controls for time, shadow mode, and weather saturation.
 */

// Sample test plants
const TEST_FLOWERS: { dna: FlowerDNA; position: [number, number, number] }[] = [
  {
    position: [0, 0, 0],
    dna: {
      name: 'Center Flower',
      description: 'Test',
      petalCount: 8,
      petalRows: 2,
      petalLength: 1.2,
      petalWidth: 0.8,
      petalCurvature: 0.5,
      petalColors: ['#00FFEF', '#2563EB', '#00FFEF', '#2563EB', '#00FFEF', '#2563EB', '#00FFEF', '#2563EB'],
      centerColor: '#EF4444',
      stemColors: ['#9DC183'],
      glowIntensity: 0.1,
      wobbleSpeed: 0.8,
      scale: 1.2,
      stemBend: 0.2,
      leafCount: 2,
      leafSize: 1.0,
      leafOrientation: 45,
      leafAngle: 0.5,
      rotation: 0,
    },
  },
  {
    position: [-8, 0, 5],
    dna: {
      name: 'Left Front',
      description: 'Test',
      petalCount: 6,
      petalRows: 2,
      petalLength: 1.0,
      petalWidth: 0.9,
      petalCurvature: 0.6,
      petalColors: ['#EC4899', '#FBCFE8', '#EC4899', '#FBCFE8', '#EC4899', '#FBCFE8'],
      centerColor: '#FFBF00',
      stemColors: ['#A0522D'],
      glowIntensity: 0.1,
      wobbleSpeed: 0.6,
      scale: 1.0,
      stemBend: -0.15,
      leafCount: 2,
      leafSize: 0.9,
      leafOrientation: 0,
      leafAngle: 0.4,
      rotation: 0.5,
    },
  },
  {
    position: [10, 0, -3],
    dna: {
      name: 'Right Back',
      description: 'Test',
      petalCount: 10,
      petalRows: 2,
      petalLength: 0.9,
      petalWidth: 0.7,
      petalCurvature: 0.4,
      petalColors: ['#FFEA00', '#FF5F1F', '#FFEA00', '#FF5F1F', '#FFEA00', '#FF5F1F', '#FFEA00', '#FF5F1F', '#FFEA00', '#FF5F1F'],
      centerColor: '#312E81',
      stemColors: ['#DAA520', '#708090'],
      glowIntensity: 0.1,
      wobbleSpeed: 0.7,
      scale: 0.9,
      stemBend: 0.25,
      leafCount: 3,
      leafSize: 1.0,
      leafOrientation: 30,
      leafAngle: 0.5,
      rotation: -0.3,
    },
  },
  {
    position: [-5, 0, -8],
    dna: {
      name: 'Left Back',
      description: 'Test',
      petalCount: 7,
      petalRows: 2,
      petalLength: 1.1,
      petalWidth: 0.85,
      petalCurvature: 0.55,
      petalColors: ['#38BDF8', '#015F63', '#38BDF8', '#015F63', '#38BDF8', '#015F63', '#38BDF8'],
      centerColor: '#00F5A0',
      stemColors: ['#FF69B4'],
      glowIntensity: 0.1,
      wobbleSpeed: 0.75,
      scale: 1.1,
      stemBend: 0.1,
      leafCount: 2,
      leafSize: 1.1,
      leafOrientation: -20,
      leafAngle: 0.45,
      rotation: 2.0,
    },
  },
  {
    position: [6, 0, 8],
    dna: {
      name: 'Right Front',
      description: 'Test',
      petalCount: 5,
      petalRows: 1,
      petalLength: 1.3,
      petalWidth: 1.0,
      petalCurvature: 0.5,
      petalColors: ['#BE123C', '#EF4444', '#BE123C', '#EF4444', '#BE123C'],
      centerColor: '#BFDBFE',
      stemColors: ['#00FF7F'],
      glowIntensity: 0.1,
      wobbleSpeed: 0.85,
      scale: 0.85,
      stemBend: -0.2,
      leafCount: 1,
      leafSize: 0.8,
      leafOrientation: 60,
      leafAngle: 0.35,
      rotation: 4.0,
    },
  },
];

const TEST_SPROUT: SproutDNA = {
  name: 'Test Sprout',
  description: 'Neutral entry',
  budColor: '#DFFF00',
  budStripe2Color: '#DFFF00',
  budStripe3Color: '#DFFF00',
  budSize: 1.0,
  budPointiness: 0.5,
  stemColor: '#9DC183',
  stemHeight: 1.0,
  stemCurve: 0.2,
  stemThickness: 0.8,
  cotyledon1Color: '#A0522D',
  cotyledon2Color: '#DAA520',
  cotyledonSize: 1.0,
  swaySpeed: 0.8,
  swayAmount: 0.3,
  scale: 0.9,
};

const TEST_DECAY: DecayDNA = {
  name: 'Test Decay',
  description: 'Positive entry',
  size: 1.5,
  aspectRatio: 1.1,
  edgeWobble: 0.3,
  layer1Color: '#4B5563',
  layer2Color: '#64748B',
  layer3Color: '#9CA3AF',
  crackCount: 8,
  crackWobble: 0.4,
  crack1Color: '#708090',
  crack2Color: '#808000',
  crack3Color: '#78350F',
};

// Slider component
function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  displayValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  displayValue?: string;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '12px' }}>
      <span style={{ width: '100px', flexShrink: 0 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1 }}
      />
      <span style={{ width: '50px', textAlign: 'right' }}>{displayValue ?? value.toFixed(1)}</span>
    </label>
  );
}

export default function NewEnvironmentTest() {
  const [hour, setHour] = useState(12);
  const [shadowMode, setShadowMode] = useState<ShadowMode>('soft');
  const [saturation, setSaturation] = useState(1);
  const [showDebug, setShowDebug] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  // Y offset for plants (matches soil depth)
  const plantYOffset = -1.5;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      {/* Control Panel */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.85)',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          minWidth: panelOpen ? '300px' : 'auto',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
        }}
      >
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <h3 style={{ margin: 0, fontSize: '14px' }}>New Environment Test</h3>
          <span>{panelOpen ? '−' : '+'}</span>
        </div>

        {panelOpen && (
          <>
            {/* Time Control */}
            <div style={{ marginTop: '16px', borderTop: '1px solid #333', paddingTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Time of Day</div>
              <Slider
                label="Hour"
                value={hour}
                min={0}
                max={24}
                step={0.5}
                onChange={setHour}
                displayValue={`${hour.toFixed(1)}h`}
              />
            </div>

            {/* Shadow Mode */}
            <div style={{ marginTop: '12px', borderTop: '1px solid #333', paddingTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Shadow Mode</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(['none', 'soft', 'sharp'] as ShadowMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setShadowMode(mode)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '11px',
                      background: shadowMode === mode ? '#4a9' : '#333',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Weather/Saturation */}
            <div style={{ marginTop: '12px', borderTop: '1px solid #333', paddingTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Weather (Saturation)</div>
              <Slider
                label="Saturation"
                value={saturation}
                min={0.3}
                max={1}
                step={0.05}
                onChange={setSaturation}
              />
              <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                1.0 = Clear (negative mood), 0.3 = Overcast (positive mood)
              </div>
            </div>

            {/* Debug Toggle */}
            <div style={{ marginTop: '12px', borderTop: '1px solid #333', paddingTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showDebug}
                  onChange={(e) => setShowDebug(e.target.checked)}
                />
                <span>Show Debug (sun position)</span>
              </label>
            </div>

            {/* Info */}
            <div style={{ marginTop: '12px', borderTop: '1px solid #333', paddingTop: '12px', fontSize: '10px', color: '#666' }}>
              <div>Testing: ExcavatedBed, Backdrop, SceneLighting</div>
              <div>5 flowers + 1 sprout + 1 decay</div>
            </div>
          </>
        )}
      </div>

      {/* 3D Canvas */}
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        camera={{ position: [0, 25, 40], fov: 45 }}
        gl={{ antialias: true }}
        style={{ background: '#1a1a2e' }}
      >
        {/* Fallback lighting in case new components fail */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} intensity={1} />

        {/* New environment components */}
        <Backdrop hour={hour} saturation={saturation} />
        <SceneLighting hour={hour} shadowMode={shadowMode} debugMode={showDebug} />
        <ExcavatedBed />

        {/* Test plants */}
        {TEST_FLOWERS.map((flower, i) => (
          <CleanToonFlower3D
            key={`flower-${i}`}
            dna={flower.dna}
            position={[flower.position[0], plantYOffset, flower.position[2]]}
            saturation={1}
          />
        ))}

        <CleanToonSprout3D
          dna={TEST_SPROUT}
          position={[12, plantYOffset, 5]}
          saturation={1}
        />

        <CleanToonDecay3D
          dna={TEST_DECAY}
          position={[-10, plantYOffset, 8]}
          saturation={1}
        />

        {/* Camera controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={15}
          maxDistance={60}
          minPolarAngle={Math.PI * 0.15}
          maxPolarAngle={Math.PI * 0.45}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
