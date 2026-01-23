import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { FlowerDNA } from '../types';
import Flower3D from './Flower3D';

/**
 * Ground plane for the test scene
 * Uses DoubleSide to prevent disappearing at certain camera angles
 */
function Ground() {
  return (
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[30, 64]} />
      <meshStandardMaterial color="#8B7355" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

/**
 * Scene lighting (same as main scene)
 */
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />
    </>
  );
}

/**
 * Create a test flower DNA with a specific scale
 * Uses the updated smaller flower dimensions
 */
function createTestFlower(name: string, scale: number, color: string, rotation: number = 0): FlowerDNA {
  return {
    name,
    description: `Test flower at scale ${scale}`,
    petalCount: 8,
    petalRows: 2,
    petalLength: 1.2,   // Updated to match new smaller size
    petalWidth: 0.6,    // Updated to match new smaller size
    petalCurvature: 0.5,
    petalColors: [color],
    centerColor: '#FFD700',
    stemColors: ['#9DC183'],
    glowIntensity: 1.5,
    wobbleSpeed: 0.8,
    scale,
    stemBend: 0.3,      // More visible bend
    leafCount: 2,
    leafSize: 1.0,
    leafOrientation: 0,
    leafAngle: 0.5,
    rotation,           // Y-axis rotation
  };
}

/**
 * Test scene for calibrating plant sizes and spacing
 *
 * Access via ?test=true URL parameter
 *
 * Shows:
 * - 5 flowers in a row at different scales (0.4, 0.8, 1.2, 1.6, 1.8)
 * - 3 flowers clustered together to visualize "same day" clustering
 */
export default function TestScene() {
  // Row of flowers at different scales (each with different rotation for variety)
  const scaleTestFlowers: Array<{ dna: FlowerDNA; position: [number, number, number] }> = [
    { dna: createTestFlower('scale-0.4', 0.4, '#00FFEF', 0), position: [0, 0, 0] },
    { dna: createTestFlower('scale-0.8', 0.8, '#2563EB', Math.PI * 0.5), position: [3, 0, 0] },
    { dna: createTestFlower('scale-1.2', 1.2, '#EF4444', Math.PI), position: [6, 0, 0] },
    { dna: createTestFlower('scale-1.6', 1.6, '#EC4899', Math.PI * 1.5), position: [9, 0, 0] },
    { dna: createTestFlower('scale-1.8', 1.8, '#FF5F1F', Math.PI * 0.25), position: [12, 0, 0] },
  ];

  // Cluster of flowers to test spacing (different rotations help petals interleave)
  const clusterFlowers: Array<{ dna: FlowerDNA; position: [number, number, number] }> = [
    { dna: createTestFlower('cluster-1', 1.0, '#4CBB17', 0), position: [-5, 0, 0] },
    { dna: createTestFlower('cluster-2', 1.0, '#4CBB17', Math.PI * 0.66), position: [-5, 0, 1.5] },
    { dna: createTestFlower('cluster-3', 1.0, '#4CBB17', Math.PI * 1.33), position: [-4, 0, 0.5] },
  ];

  const allFlowers = [...scaleTestFlowers, ...clusterFlowers];

  return (
    <div className="app">
      <div className="info-panel open">
        <div className="panel-header">
          <h1>Test Mode: Size & Spacing Calibration</h1>
        </div>
        <div className="panel-content">
          <p><strong>Scale Test Row (right side):</strong></p>
          <ul>
            <li>Teal (0,0,0): scale 0.4</li>
            <li>Blue (3,0,0): scale 0.8</li>
            <li>Red (6,0,0): scale 1.2</li>
            <li>Pink (9,0,0): scale 1.6</li>
            <li>Orange (12,0,0): scale 1.8</li>
          </ul>
          <p><strong>Cluster Test (left side):</strong></p>
          <ul>
            <li>3 green flowers at scale 1.0</li>
            <li>Positions: (-5,0,0), (-5,0,1.5), (-4,0,0.5)</li>
            <li>Tests "same day" clustering visibility</li>
          </ul>
          <p style={{ marginTop: '16px', color: '#888' }}>
            Remove ?test=true from URL to return to main garden
          </p>
        </div>
      </div>

      <Canvas
        camera={{ position: [5, 10, 20], fov: 60 }}
        style={{ background: '#1a1a2e' }}
      >
        <Lighting />
        <Ground />

        {allFlowers.map(({ dna, position }) => (
          <Flower3D key={dna.name} dna={dna} position={position} />
        ))}

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={100}
        />
      </Canvas>
    </div>
  );
}
