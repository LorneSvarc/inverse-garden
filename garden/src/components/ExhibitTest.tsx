import { useState, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { FlowerDNA } from '../types';
import { CAMERA_LIMITS } from '../config/environmentConfig';
import { getToonGradient } from '../utils/toonGradient';
import CleanToonFlower3D from './CleanToonFlower3D';
import { RaisedBed } from './RaisedBed';
import { DirtSurface } from './DirtSurface';

// =============================================================================
// SUN POSITION & LIGHTING
// =============================================================================

function getSunPosition(hour: number): [number, number, number] {
  const dayProgress = (hour - 6) / 12; // 0 at 6am, 1 at 6pm
  const angle = dayProgress * Math.PI;
  const x = Math.cos(angle) * 50;
  const y = Math.sin(angle) * 50;
  const z = 0; // Sun moves directly across the sky (east to west)
  return [x, Math.max(y, -10), z];
}

function getSunIntensityAndColor(hour: number): { intensity: number; color: string } {
  if (hour >= 6 && hour < 8) {
    return { intensity: Math.PI * 0.8, color: '#fff5e0' };
  } else if (hour >= 8 && hour < 17) {
    return { intensity: Math.PI * 1.5, color: '#ffffff' };
  } else if (hour >= 17 && hour < 19) {
    return { intensity: Math.PI * 1.2, color: '#ffcc88' };
  } else if (hour >= 19 && hour < 20) {
    return { intensity: Math.PI * 0.5, color: '#ff9955' };
  } else {
    return { intensity: Math.PI * 0.1, color: '#aabbff' };
  }
}

// =============================================================================
// SUN LIGHT
// =============================================================================

function SunLight({
  sunPosition,
  intensity,
  color,
}: {
  sunPosition: [number, number, number];
  intensity: number;
  color: string;
}) {
  const lightRef = useRef<THREE.DirectionalLight>(null!);

  return (
    <directionalLight
      ref={lightRef}
      position={sunPosition}
      intensity={intensity}
      color={color}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-near={0.5}
      shadow-camera-far={300}
      shadow-camera-left={-40}
      shadow-camera-right={40}
      shadow-camera-top={40}
      shadow-camera-bottom={-40}
      shadow-bias={-0.0001}
    />
  );
}

// =============================================================================
// SHADOW FLOOR - Dark, unlit floor to catch shadows
// =============================================================================

function ShadowFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial
        color="#1a1a1a"
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

// =============================================================================
// BACK WALL - Asymmetrically positioned
// =============================================================================

function createBrickTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Mortar base
  ctx.fillStyle = '#8a7d6f';
  ctx.fillRect(0, 0, 512, 512);

  const brickColors = ['#b08060', '#a07050', '#c09070', '#9a6848', '#b87a58', '#a86a50'];
  const brickWidth = 64;
  const brickHeight = 28;
  const mortarGap = 4;
  const rows = Math.ceil(512 / (brickHeight + mortarGap));
  const cols = Math.ceil(512 / (brickWidth + mortarGap)) + 1;

  // Simple seeded random for consistent variation
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let row = 0; row < rows; row++) {
    const y = row * (brickHeight + mortarGap);
    const offset = row % 2 === 0 ? 0 : -(brickWidth + mortarGap) / 2;

    for (let col = -1; col < cols; col++) {
      const x = col * (brickWidth + mortarGap) + offset;

      // Pick a brick color with slight random variation
      const baseColor = brickColors[Math.floor(rand() * brickColors.length)];
      ctx.fillStyle = baseColor;

      // Slight size variation
      const w = brickWidth - Math.floor(rand() * 3);
      const h = brickHeight - Math.floor(rand() * 2);
      ctx.fillRect(x + mortarGap / 2, y + mortarGap / 2, w, h);

      // Subtle shading on each brick — darker at bottom
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, 'rgba(255,255,255,0.06)');
      grad.addColorStop(1, 'rgba(0,0,0,0.1)');
      ctx.fillStyle = grad;
      ctx.fillRect(x + mortarGap / 2, y + mortarGap / 2, w, h);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 3);
  return texture;
}

function BackWall() {
  const gradientMap = useMemo(() => getToonGradient(), []);
  const brickMap = useMemo(() => createBrickTexture(), []);

  return (
    <mesh position={[-8, 15, -18]} receiveShadow castShadow>  {/* asymmetric position */}
      <planeGeometry args={[60, 30]} />
      <meshToonMaterial map={brickMap} gradientMap={gradientMap} />
    </mesh>
  );
}

// =============================================================================
// HARDCODED TEST FLOWERS
// =============================================================================

const TEST_FLOWERS: { dna: FlowerDNA; position: [number, number, number] }[] = [
  {
    position: [-3, 0, 4],  // Near center
    dna: {
      name: 'Test Flower 1',
      description: 'Red/orange flower',
      petalCount: 8,
      petalRows: 2,
      petalLength: 1.2,
      petalWidth: 0.8,
      petalCurvature: 0.5,
      petalColors: ['#e63946', '#f4a261', '#e63946', '#f4a261', '#e63946', '#f4a261', '#e63946', '#f4a261'],
      centerColor: '#ffbe0b',
      stemColors: ['#2d6a4f', '#40916c'],
      glowIntensity: 0.1,
      wobbleSpeed: 0.8,
      scale: 1.0,
      stemBend: 0.3,
      leafCount: 2,
      leafSize: 1.0,
      leafOrientation: 45,
      leafAngle: 0.5,
      rotation: 0,
    },
  },
  {
    position: [-14, 0, -8],  // Far left back
    dna: {
      name: 'Test Flower 2',
      description: 'Blue/purple flower',
      petalCount: 6,
      petalRows: 2,
      petalLength: 1.0,
      petalWidth: 0.9,
      petalCurvature: 0.7,
      petalColors: ['#7209b7', '#3a0ca3', '#4361ee', '#7209b7', '#3a0ca3', '#4361ee'],
      centerColor: '#f72585',
      stemColors: ['#2d6a4f'],
      glowIntensity: 0.15,
      wobbleSpeed: 0.6,
      scale: 0.9,
      stemBend: -0.2,
      leafCount: 1,
      leafSize: 0.8,
      leafOrientation: 0,
      leafAngle: 0.4,
      rotation: 1.2,
    },
  },
  {
    position: [12, 0, 8],  // Right front
    dna: {
      name: 'Test Flower 3',
      description: 'Yellow/gold flower',
      petalCount: 10,
      petalRows: 3,
      petalLength: 0.9,
      petalWidth: 0.6,
      petalCurvature: 0.3,
      petalColors: ['#ffbe0b', '#fb5607', '#ffbe0b', '#fb5607', '#ffbe0b', '#fb5607', '#ffbe0b', '#fb5607', '#ffbe0b', '#fb5607'],
      centerColor: '#3a0ca3',
      stemColors: ['#40916c', '#52b788'],
      glowIntensity: 0.2,
      wobbleSpeed: 1.0,
      scale: 1.1,
      stemBend: 0.1,
      leafCount: 3,
      leafSize: 1.2,
      leafOrientation: 30,
      leafAngle: 0.6,
      rotation: 2.5,
    },
  },
  {
    position: [-10, 0, 10],  // Left front
    dna: {
      name: 'Test Flower 4',
      description: 'Pink/white flower',
      petalCount: 7,
      petalRows: 2,
      petalLength: 1.3,
      petalWidth: 0.7,
      petalCurvature: 0.6,
      petalColors: ['#ff006e', '#ffb3d9', '#ff006e', '#ffb3d9', '#ff006e', '#ffb3d9', '#ff006e'],
      centerColor: '#ffbe0b',
      stemColors: ['#2d6a4f', '#52b788'],
      glowIntensity: 0.1,
      wobbleSpeed: 0.7,
      scale: 0.85,
      stemBend: -0.4,
      leafCount: 2,
      leafSize: 0.9,
      leafOrientation: -30,
      leafAngle: 0.5,
      rotation: 4.0,
    },
  },
  {
    position: [15, 0, -10],  // Far right back
    dna: {
      name: 'Test Flower 5',
      description: 'Teal/green flower',
      petalCount: 5,
      petalRows: 1,
      petalLength: 1.1,
      petalWidth: 1.0,
      petalCurvature: 0.4,
      petalColors: ['#06d6a0', '#118ab2', '#06d6a0', '#118ab2', '#06d6a0'],
      centerColor: '#ef476f',
      stemColors: ['#1b4332'],
      glowIntensity: 0.12,
      wobbleSpeed: 0.9,
      scale: 1.0,
      stemBend: 0.2,
      leafCount: 2,
      leafSize: 1.1,
      leafOrientation: 60,
      leafAngle: 0.3,
      rotation: 5.5,
    },
  },
  // Additional flowers to fill the larger space
  {
    position: [14, 0, 12],  // Right front corner
    dna: {
      name: 'Test Flower 6',
      description: 'Coral/salmon flower',
      petalCount: 9,
      petalRows: 2,
      petalLength: 1.1,
      petalWidth: 0.75,
      petalCurvature: 0.55,
      petalColors: ['#ff7f50', '#ffa07a', '#ff7f50', '#ffa07a', '#ff7f50', '#ffa07a', '#ff7f50', '#ffa07a', '#ff7f50'],
      centerColor: '#8b4513',
      stemColors: ['#2d6a4f', '#40916c'],
      glowIntensity: 0.1,
      wobbleSpeed: 0.75,
      scale: 0.95,
      stemBend: 0.25,
      leafCount: 2,
      leafSize: 1.0,
      leafOrientation: 20,
      leafAngle: 0.45,
      rotation: 1.8,
    },
  },
  {
    position: [-15, 0, -12],  // Far left back corner
    dna: {
      name: 'Test Flower 7',
      description: 'Lavender flower',
      petalCount: 8,
      petalRows: 2,
      petalLength: 1.0,
      petalWidth: 0.85,
      petalCurvature: 0.6,
      petalColors: ['#9370db', '#ba55d3', '#9370db', '#ba55d3', '#9370db', '#ba55d3', '#9370db', '#ba55d3'],
      centerColor: '#dda0dd',
      stemColors: ['#2d6a4f'],
      glowIntensity: 0.12,
      wobbleSpeed: 0.65,
      scale: 0.9,
      stemBend: -0.15,
      leafCount: 2,
      leafSize: 0.85,
      leafOrientation: -45,
      leafAngle: 0.4,
      rotation: 3.2,
    },
  },
  {
    position: [0, 0, -12],  // Center back
    dna: {
      name: 'Test Flower 8',
      description: 'Magenta/deep pink flower',
      petalCount: 6,
      petalRows: 2,
      petalLength: 1.15,
      petalWidth: 0.9,
      petalCurvature: 0.65,
      petalColors: ['#c71585', '#db7093', '#c71585', '#db7093', '#c71585', '#db7093'],
      centerColor: '#ffd700',
      stemColors: ['#1b4332', '#2d6a4f'],
      glowIntensity: 0.15,
      wobbleSpeed: 0.7,
      scale: 1.05,
      stemBend: 0.1,
      leafCount: 3,
      leafSize: 1.1,
      leafOrientation: 15,
      leafAngle: 0.5,
      rotation: 5.0,
    },
  },
];

// =============================================================================
// MAIN EXHIBIT TEST COMPONENT
// =============================================================================

// Slider row component for camera controls
function CameraSlider({
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
  displayValue: string;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '11px' }}>
      <span style={{ width: '100px', flexShrink: 0 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, minWidth: '80px' }}
      />
      <span style={{ width: '50px', textAlign: 'right', flexShrink: 0 }}>{displayValue}</span>
    </label>
  );
}

export default function ExhibitTest() {
  const [hour, setHour] = useState(12);
  const [panelOpen, setPanelOpen] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);

  // Camera limit state - starting from current CAMERA_LIMITS values
  const [minDistance, setMinDistance] = useState(CAMERA_LIMITS.minDistance);
  const [maxDistance, setMaxDistance] = useState(CAMERA_LIMITS.maxDistance);
  const [minPolar, setMinPolar] = useState(CAMERA_LIMITS.minPolarAngle);
  const [maxPolar, setMaxPolar] = useState(CAMERA_LIMITS.maxPolarAngle);
  const [minAzimuth, setMinAzimuth] = useState(CAMERA_LIMITS.minAzimuthAngle);
  const [maxAzimuth, setMaxAzimuth] = useState(CAMERA_LIMITS.maxAzimuthAngle);

  const sunPosition = useMemo(() => getSunPosition(hour), [hour]);
  const { intensity: sunIntensity, color: sunColor } = useMemo(
    () => getSunIntensityAndColor(hour),
    [hour]
  );

  // Format radians as degrees for display
  const toDeg = (rad: number) => `${(rad * 180 / Math.PI).toFixed(0)}°`;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#1a1a1a' }}>
      {/* Control Panel */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '13px',
          minWidth: panelOpen ? '280px' : 'auto',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
        }}
      >
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <h3 style={{ margin: 0, fontSize: '14px' }}>Exhibit Test</h3>
          <span style={{ marginLeft: '12px' }}>{panelOpen ? '−' : '+'}</span>
        </div>

        {panelOpen && (
          <>
            {/* Time slider */}
            <label style={{ display: 'block', marginTop: '12px', marginBottom: '8px' }}>
              <span>Time of Day: {hour.toFixed(1)}h</span>
              <input
                type="range"
                min="0"
                max="24"
                step="0.5"
                value={hour}
                onChange={(e) => setHour(parseFloat(e.target.value))}
                style={{ width: '100%', marginTop: '4px' }}
              />
            </label>

            {/* Debug info */}
            <div style={{ fontSize: '11px', color: '#888', marginTop: '8px', borderTop: '1px solid #333', paddingTop: '8px' }}>
              <div>Sun X: {sunPosition[0].toFixed(1)}</div>
              <div>Sun Y: {sunPosition[1].toFixed(1)}</div>
              <div>Sun Z: {sunPosition[2].toFixed(1)}</div>
              <div>Intensity: {sunIntensity.toFixed(2)}</div>
              <div>Color: {sunColor}</div>
            </div>

            {/* Camera Limits */}
            <div style={{ marginTop: '12px', borderTop: '1px solid #333', paddingTop: '8px' }}>
              <div
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => setCameraOpen(!cameraOpen)}
              >
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Camera Limits</span>
                <span>{cameraOpen ? '−' : '+'}</span>
              </div>

              {cameraOpen && (
                <div style={{ marginTop: '8px' }}>
                  <CameraSlider
                    label="Min Distance"
                    value={minDistance}
                    min={1}
                    max={40}
                    step={1}
                    onChange={setMinDistance}
                    displayValue={minDistance.toFixed(0)}
                  />
                  <CameraSlider
                    label="Max Distance"
                    value={maxDistance}
                    min={10}
                    max={150}
                    step={1}
                    onChange={setMaxDistance}
                    displayValue={maxDistance.toFixed(0)}
                  />

                  <div style={{ height: '6px' }} />

                  <CameraSlider
                    label="Min Polar (up)"
                    value={minPolar}
                    min={0}
                    max={Math.PI * 0.5}
                    step={0.01}
                    onChange={setMinPolar}
                    displayValue={toDeg(minPolar)}
                  />
                  <CameraSlider
                    label="Max Polar (down)"
                    value={maxPolar}
                    min={Math.PI * 0.1}
                    max={Math.PI * 0.9}
                    step={0.01}
                    onChange={setMaxPolar}
                    displayValue={toDeg(maxPolar)}
                  />

                  <div style={{ height: '6px' }} />

                  <CameraSlider
                    label="Min Azimuth (L)"
                    value={minAzimuth}
                    min={-Math.PI}
                    max={0}
                    step={0.01}
                    onChange={setMinAzimuth}
                    displayValue={toDeg(minAzimuth)}
                  />
                  <CameraSlider
                    label="Max Azimuth (R)"
                    value={maxAzimuth}
                    min={0}
                    max={Math.PI}
                    step={0.01}
                    onChange={setMaxAzimuth}
                    displayValue={toDeg(maxAzimuth)}
                  />

                  <div style={{ marginTop: '8px', fontSize: '10px', color: '#666' }}>
                    <div>Polar: 0° = top-down, 90° = horizon</div>
                    <div>Azimuth: -180° = full left, +180° = full right</div>
                  </div>

                  <button
                    style={{
                      marginTop: '8px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      background: '#333',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setMinDistance(CAMERA_LIMITS.minDistance);
                      setMaxDistance(CAMERA_LIMITS.maxDistance);
                      setMinPolar(CAMERA_LIMITS.minPolarAngle);
                      setMaxPolar(CAMERA_LIMITS.maxPolarAngle);
                      setMinAzimuth(CAMERA_LIMITS.minAzimuthAngle);
                      setMaxAzimuth(CAMERA_LIMITS.maxAzimuthAngle);
                    }}
                  >
                    Reset to defaults
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 25, 35], fov: 50 }}
        gl={{ clearColor: '#1a1a1a' }}
      >
        {/* Dark background matching floor */}
        <color attach="background" args={['#1a1a1a']} />

        {/* Ambient fill - reduced for exhibit feel */}
        <hemisphereLight args={['#87CEEB', '#362312', 0.4]} />

        {/* Sun light with shadows */}
        <SunLight
          sunPosition={sunPosition}
          intensity={sunIntensity}
          color={sunColor}
        />

        {/* Dark shadow floor */}
        <ShadowFloor />

        {/* Back wall - asymmetric position */}
        <BackWall />

        {/* Garden bed */}
        <RaisedBed />
        <DirtSurface />

        {/* Test flowers */}
        {TEST_FLOWERS.map((flower, i) => (
          <CleanToonFlower3D
            key={i}
            dna={flower.dna}
            position={flower.position}
            saturation={1}
          />
        ))}

        {/* Camera controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={minDistance}
          maxDistance={maxDistance}
          minPolarAngle={minPolar}
          maxPolarAngle={maxPolar}
          minAzimuthAngle={minAzimuth}
          maxAzimuthAngle={maxAzimuth}
        />
      </Canvas>
    </div>
  );
}
