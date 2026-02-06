import { useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import { SpecimenVitrine } from './environment/SpecimenVitrine';
import { PostProcessing } from './environment/PostProcessing';
import CleanToonFlower3D from './CleanToonFlower3D';
import CleanToonSprout3D from './CleanToonSprout3D';
import CleanToonDecay3D from './CleanToonDecay3D';
import type { FlowerDNA, SproutDNA, DecayDNA } from '../types';

/**
 * VitrineTest - Test scene for the Full Spectrum Weather + Radiance environment
 *
 * v8 features:
 * - SunMesh: Visible sun for god rays on radiant (negative mood) days
 * - ToonClouds: Toon-shaded clouds for overcast (positive mood) days
 * - EmissivePerimeter: Mirrors sky state (warm/bright vs cool/dim)
 * - God Rays: Post-processing effect for radiant days
 * - Saturation/Bloom: Enhanced for radiant, reduced for overcast
 */

// Sample test plants - spread across the garden
const TEST_FLOWERS: { dna: FlowerDNA; position: [number, number, number] }[] = [
  {
    position: [0, 0, 0],
    dna: {
      name: 'Center Flower',
      description: 'Anxious',
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
    position: [-10, 0, 6],
    dna: {
      name: 'Left Front',
      description: 'Sad',
      petalCount: 6,
      petalRows: 2,
      petalLength: 1.0,
      petalWidth: 0.9,
      petalCurvature: 0.6,
      petalColors: ['#2563EB', '#38BDF8', '#2563EB', '#38BDF8', '#2563EB', '#38BDF8'],
      centerColor: '#BFDBFE',
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
    position: [12, 0, -4],
    dna: {
      name: 'Right Back',
      description: 'Stressed',
      petalCount: 10,
      petalRows: 2,
      petalLength: 0.9,
      petalWidth: 0.7,
      petalCurvature: 0.4,
      petalColors: ['#EF4444', '#BE123C', '#EF4444', '#BE123C', '#EF4444', '#BE123C', '#EF4444', '#BE123C', '#EF4444', '#BE123C'],
      centerColor: '#FFBF00',
      stemColors: ['#DAA520', '#708090'],
      glowIntensity: 0.1,
      wobbleSpeed: 0.7,
      scale: 1.1,
      stemBend: 0.25,
      leafCount: 3,
      leafSize: 1.0,
      leafOrientation: 30,
      leafAngle: 0.5,
      rotation: -0.3,
    },
  },
  {
    position: [-6, 0, -10],
    dna: {
      name: 'Left Back',
      description: 'Overwhelmed',
      petalCount: 7,
      petalRows: 2,
      petalLength: 1.1,
      petalWidth: 0.85,
      petalCurvature: 0.55,
      petalColors: ['#00F5A0', '#4CBB17', '#00F5A0', '#4CBB17', '#00F5A0', '#4CBB17', '#00F5A0'],
      centerColor: '#015F63',
      stemColors: ['#FF69B4'],
      glowIntensity: 0.1,
      wobbleSpeed: 0.75,
      scale: 0.9,
      stemBend: 0.1,
      leafCount: 2,
      leafSize: 1.1,
      leafOrientation: -20,
      leafAngle: 0.45,
      rotation: 2.0,
    },
  },
  {
    position: [8, 0, 10],
    dna: {
      name: 'Right Front',
      description: 'Frustrated',
      petalCount: 5,
      petalRows: 1,
      petalLength: 1.3,
      petalWidth: 1.0,
      petalCurvature: 0.5,
      petalColors: ['#FBCFE8', '#EC4899', '#FBCFE8', '#EC4899', '#FBCFE8'],
      centerColor: '#BE123C',
      stemColors: ['#00FF7F'],
      glowIntensity: 0.1,
      wobbleSpeed: 0.85,
      scale: 0.95,
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
  description: 'Neutral - Indifferent',
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
  description: 'Happy - Positive',
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

// Valence text options
const VALENCE_TEXTS = [
  'VERY UNPLEASANT',
  'UNPLEASANT',
  'SLIGHTLY UNPLEASANT',
  'NEUTRAL',
  'SLIGHTLY PLEASANT',
  'PLEASANT',
  'VERY PLEASANT',
];

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
      <span style={{ width: '60px', textAlign: 'right' }}>{displayValue ?? value.toFixed(1)}</span>
    </label>
  );
}

export default function VitrineTest() {
  const [hour, setHour] = useState(12);
  const [moodValence, setMoodValence] = useState(0);
  const [valenceIndex, setValenceIndex] = useState(3);  // Start at NEUTRAL
  const [panelOpen, setPanelOpen] = useState(true);
  const [shadowsEnabled, setShadowsEnabled] = useState(true);

  // Post-processing controls - v8: full spectrum weather
  const [bloomIntensity, setBloomIntensity] = useState(1.5);
  const [bloomThreshold, setBloomThreshold] = useState(0.2);
  const [vignetteStrength, setVignetteStrength] = useState(0.3);
  const [fogDensity, setFogDensity] = useState(0.008);
  const [godRaysEnabled, setGodRaysEnabled] = useState(true);
  const [cloudsEnabled, setCloudsEnabled] = useState(true);

  // Sun mesh reference for god rays
  const [sunMesh, setSunMesh] = useState<THREE.Mesh | null>(null);

  const handleSunMeshReady = useCallback((mesh: THREE.Mesh | null) => {
    setSunMesh(mesh);
  }, []);

  const valenceText = VALENCE_TEXTS[valenceIndex];

  // Plants sit on soil surface at y=0
  const plantY = 0;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      {/* Control Panel */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.9)',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          minWidth: panelOpen ? '320px' : 'auto',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
        }}
      >
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <h3 style={{ margin: 0, fontSize: '14px' }}>Specimen Vitrine Test</h3>
          <span>{panelOpen ? '−' : '+'}</span>
        </div>

        {panelOpen && (
          <>
            {/* Time of Day */}
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
              <div style={{ fontSize: '10px', color: '#888' }}>
                Affects lighting color temperature
              </div>
            </div>

            {/* Daily Mood */}
            <div style={{ marginTop: '12px', borderTop: '1px solid #333', paddingTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Daily Mood (Weather)</div>
              <Slider
                label="Mood Valence"
                value={moodValence}
                min={-1}
                max={1}
                step={0.1}
                onChange={setMoodValence}
              />
              <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                -1 = Negative (warm/bright), +1 = Positive (cool/dim)
              </div>
            </div>

            {/* LED Wall Text */}
            <div style={{ marginTop: '12px', borderTop: '1px solid #333', paddingTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>LED Wall Text</div>
              <Slider
                label="Valence"
                value={valenceIndex}
                min={0}
                max={6}
                step={1}
                onChange={(v) => setValenceIndex(Math.round(v))}
                displayValue={valenceText}
              />
            </div>

            {/* Shadows Toggle */}
            <div style={{ marginTop: '12px', borderTop: '1px solid #333', paddingTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={shadowsEnabled}
                  onChange={(e) => setShadowsEnabled(e.target.checked)}
                />
                <span>Shadows Enabled</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={godRaysEnabled}
                  onChange={(e) => setGodRaysEnabled(e.target.checked)}
                />
                <span>God Rays (for radiant days)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={cloudsEnabled}
                  onChange={(e) => setCloudsEnabled(e.target.checked)}
                />
                <span>Clouds (appear with positive mood)</span>
              </label>
            </div>

            {/* Post-Processing Controls */}
            <div style={{ marginTop: '12px', borderTop: '1px solid #333', paddingTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Atmosphere</div>
              <Slider
                label="Bloom Intensity"
                value={bloomIntensity}
                min={0}
                max={5}
                step={0.1}
                onChange={setBloomIntensity}
              />
              <Slider
                label="Bloom Threshold"
                value={bloomThreshold}
                min={0}
                max={1}
                step={0.05}
                onChange={setBloomThreshold}
              />
              <Slider
                label="Vignette"
                value={vignetteStrength}
                min={0}
                max={1}
                step={0.05}
                onChange={setVignetteStrength}
              />
              <Slider
                label="Fog Density"
                value={fogDensity}
                min={0}
                max={0.03}
                step={0.001}
                onChange={setFogDensity}
                displayValue={fogDensity.toFixed(3)}
              />
            </div>

            {/* Info */}
            <div style={{ marginTop: '12px', borderTop: '1px solid #333', paddingTop: '12px', fontSize: '10px', color: '#666' }}>
              <div>v8: Full Spectrum Weather + Radiance</div>
              <div>Negative mood = radiant (god rays, warm ring)</div>
              <div>Positive mood = overcast (clouds, dim ring)</div>
              <div style={{ marginTop: '4px' }}>5 flowers + 1 sprout + 1 decay</div>
            </div>
          </>
        )}
      </div>

      {/* 3D Canvas - with tone mapping for exposure control */}
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        camera={{ position: [0, 25, 45], fov: 45 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.9, // Slightly reduced to prevent blowout
        }}
      >
        {/* The complete vitrine environment */}
        <SpecimenVitrine
          hour={hour}
          moodValence={moodValence}
          valenceText={valenceText}
          shadowsEnabled={shadowsEnabled}
          fogDensity={fogDensity}
          cloudsEnabled={cloudsEnabled}
          onSunMeshReady={handleSunMeshReady}
        />

        {/* Test plants */}
        {TEST_FLOWERS.map((flower, i) => (
          <CleanToonFlower3D
            key={`flower-${i}`}
            dna={flower.dna}
            position={[flower.position[0], plantY, flower.position[2]]}
            saturation={1}
          />
        ))}

        <CleanToonSprout3D
          dna={TEST_SPROUT}
          position={[14, plantY, 6]}
          saturation={1}
        />

        <CleanToonDecay3D
          dna={TEST_DECAY}
          position={[-12, plantY, 10]}
          saturation={1}
        />

        {/* Post-processing effects - CRITICAL for atmosphere */}
        <PostProcessing
          bloomIntensity={bloomIntensity}
          bloomThreshold={bloomThreshold}
          bloomRadius={0.9}
          vignetteStrength={vignetteStrength}
          chromaticAberration={true}
          moodValence={moodValence}
          sunMesh={sunMesh}
          godRaysEnabled={godRaysEnabled}
        />

        {/* Camera controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={20}
          maxDistance={80}
          minPolarAngle={Math.PI * 0.1}
          maxPolarAngle={Math.PI * 0.45}
          target={[0, 2, 0]}
        />
      </Canvas>
    </div>
  );
}
