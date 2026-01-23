import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshWobbleMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { SproutDNA } from '../types';

interface Sprout3DProps {
  dna: SproutDNA;
  position?: [number, number, number];
}

/**
 * Cotyledon - Round seed leaf
 * Paired, round, simple - the first leaves that emerge from a seed
 */
const Cotyledon: React.FC<{
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
  color: string;
  swaySpeed: number;
  swayAmount: number;
  index: number;
}> = ({ position, rotation, scale, color, swaySpeed, swayAmount, index }) => {
  const meshRef = useRef<THREE.Mesh>(null!);

  const shape = useMemo(() => {
    return new THREE.SphereGeometry(0.077, 24, 16);
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime() * swaySpeed;
    const phase = index * Math.PI;
    meshRef.current.rotation.z = rotation.z + Math.sin(t * 0.8 + phase) * swayAmount * 0.2;
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      geometry={shape}
      scale={[1.2 * scale, 0.4 * scale, 0.8 * scale]}
    >
      <meshStandardMaterial
        color={color}
        roughness={0.6}
        metalness={0.1}
      />
    </mesh>
  );
};

/**
 * Sprout3D - Renders a procedurally generated sprout based on DNA
 *
 * Modified from reference: removed ground plane and scene lights
 * since multiple sprouts will share a single scene.
 */
const Sprout3D: React.FC<Sprout3DProps> = ({ dna, position = [0, 0, 0] }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const budRef = useRef<THREE.Group>(null!);

  const stemCurve = useMemo(() => {
    const height = -0.9 * dna.stemHeight;
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, height, 0),
      new THREE.Vector3(dna.stemCurve * 0.2, height * 0.5, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
  }, [dna.stemCurve, dna.stemHeight]);

  const cotyledons = useMemo(() => {
    const t = 0.45;
    const point = stemCurve.getPointAt(t);
    const scale = dna.cotyledonSize * 1.54;

    return [
      {
        position: new THREE.Vector3(point.x + 0.051, point.y, point.z),
        rotation: new THREE.Euler(0, 0, -0.4),
        color: dna.cotyledon1Color,
        scale
      },
      {
        position: new THREE.Vector3(point.x - 0.051, point.y, point.z),
        rotation: new THREE.Euler(0, 0, 0.4),
        color: dna.cotyledon2Color,
        scale
      },
    ];
  }, [stemCurve, dna.cotyledon1Color, dna.cotyledon2Color, dna.cotyledonSize]);

  const stemTop = useMemo(() => stemCurve.getPointAt(1), [stemCurve]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * dna.swaySpeed;
    groupRef.current.rotation.z = Math.sin(t * 0.7) * dna.swayAmount * 0.2;
    groupRef.current.rotation.x = Math.cos(t * 0.5) * dna.swayAmount * 0.1;

    if (budRef.current) {
      budRef.current.rotation.z = Math.sin(t * 1.1) * dna.swayAmount * 0.05;
    }
  });

  const stemRadius = 0.026 * dna.stemThickness;
  const budRadius = 0.154 * dna.budSize;
  const budHeight = 0.231 * dna.budSize;

  // Calculate positioning so the stem reaches the ground (ground is at Y=0)
  const stemBottomLocalY = -0.9 * dna.stemHeight;
  const groupY = 0 - (stemBottomLocalY * dna.scale);

  // Memoize bud shape points to avoid recreating on every render
  const budShapePoints = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = budRadius * Math.sin(t * Math.PI) * (1 - (dna.budPointiness * 0.5 * t));
      const y = t * budHeight * 2;
      points.push(new THREE.Vector2(x, y));
    }
    return points;
  }, [budRadius, budHeight, dna.budPointiness]);

  const stripe2Points = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = (budRadius + 0.005) * Math.sin(t * Math.PI) * (1 - (dna.budPointiness * 0.5 * t));
      const y = t * budHeight * 2;
      points.push(new THREE.Vector2(x, y));
    }
    return points;
  }, [budRadius, budHeight, dna.budPointiness]);

  const stripe3Points = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = (budRadius + 0.006) * Math.sin(t * Math.PI) * (1 - (dna.budPointiness * 0.5 * t));
      const y = t * budHeight * 2;
      points.push(new THREE.Vector2(x, y));
    }
    return points;
  }, [budRadius, budHeight, dna.budPointiness]);

  return (
    <group position={position}>
      <group ref={groupRef} scale={[dna.scale, dna.scale, dna.scale]} position={[0, groupY, 0]}>
        {/* Stem */}
        <mesh>
          <tubeGeometry args={[stemCurve, 32, stemRadius, 12, false]} />
          <MeshWobbleMaterial
            color={dna.stemColor}
            speed={dna.swaySpeed * 0.4}
            factor={0.03}
            roughness={0.7}
            metalness={0.02}
          />
        </mesh>

        {/* Pod Glow */}
        <Sparkles
          position={stemTop.clone().add(new THREE.Vector3(0, budHeight, 0))}
          count={15}
          scale={budRadius * 2}
          size={1.5}
          speed={dna.swaySpeed * 0.5}
          color={dna.budColor}
        />

        {/* Cotyledons */}
        {cotyledons.map((cot, i) => (
          <Cotyledon
            key={i}
            position={cot.position}
            rotation={cot.rotation}
            scale={cot.scale}
            color={cot.color}
            swaySpeed={dna.swaySpeed}
            swayAmount={dna.swayAmount}
            index={i}
          />
        ))}

        {/* Bud */}
        <group ref={budRef} position={stemTop}>
          {/* Main bud body */}
          <mesh position={[0, 0, 0]}>
            <latheGeometry args={[budShapePoints, 32]} />
            <meshStandardMaterial
              color={dna.budColor}
              roughness={0.3}
              metalness={0.2}
            />
          </mesh>

          {/* Stripe 1 - Secondary Emotion */}
          <mesh rotation={[0, 0, 0]}>
            <latheGeometry args={[stripe2Points, 32, 0, Math.PI * 0.1]} />
            <meshStandardMaterial
              color={dna.budStripe2Color}
              roughness={0.35}
              metalness={0.15}
            />
          </mesh>

          {/* Stripe 1 Mirror */}
          <mesh rotation={[0, Math.PI, 0]}>
            <latheGeometry args={[stripe2Points, 32, 0, Math.PI * 0.1]} />
            <meshStandardMaterial
              color={dna.budStripe2Color}
              roughness={0.35}
              metalness={0.15}
            />
          </mesh>

          {/* Stripe 2 - Tertiary Emotion */}
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <latheGeometry args={[stripe3Points, 32, 0, Math.PI * 0.08]} />
            <meshStandardMaterial
              color={dna.budStripe3Color}
              roughness={0.35}
              metalness={0.15}
            />
          </mesh>

          {/* Stripe 2 Mirror */}
          <mesh rotation={[0, -Math.PI / 2, 0]}>
            <latheGeometry args={[stripe3Points, 32, 0, Math.PI * 0.08]} />
            <meshStandardMaterial
              color={dna.budStripe3Color}
              roughness={0.35}
              metalness={0.15}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
};

export default Sprout3D;
