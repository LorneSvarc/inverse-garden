import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshWobbleMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { SproutDNA } from '../types';

interface Sprout3DProps {
  dna: SproutDNA;
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

  // Simple oval shape (flattened sphere)
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
      scale={[1.2, 0.4, 0.8]} // Flattened sphere into an oval
    >
      <meshStandardMaterial
        color={color}
        roughness={0.6}
        metalness={0.1}
      />
    </mesh>
  );
};

const Sprout3D: React.FC<Sprout3DProps> = ({ dna }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const budRef = useRef<THREE.Group>(null!);

  // Stem curve - 30% the height of the flower (0.9 vs 3.0)
  const stemCurve = useMemo(() => {
    const height = -0.9 * dna.stemHeight;
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, height, 0),
      new THREE.Vector3(dna.stemCurve * 0.2, height * 0.5, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
  }, [dna.stemCurve, dna.stemHeight]);

  // Cotyledon positions - simple ovals attached to the stem
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

  // Gentle sway
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * dna.swaySpeed;
    groupRef.current.rotation.z = Math.sin(t * 0.7) * dna.swayAmount * 0.2;
    groupRef.current.rotation.x = Math.cos(t * 0.5) * dna.swayAmount * 0.1;

    // Subtle bud orientation adjustments
    if (budRef.current) {
      budRef.current.rotation.z = Math.sin(t * 1.1) * dna.swayAmount * 0.05;
    }
  });

  const stemRadius = 0.026 * dna.stemThickness;
  const budRadius = 0.154 * dna.budSize;
  const budHeight = 0.231 * dna.budSize;

  // Calculate the bottom point in local space
  const stemBottomLocalY = -0.9 * dna.stemHeight;
  // Calculate group position so the bottom reaches slightly below ground (y = -2.5)
  // groupY + (stemBottomLocalY * dna.scale) = -2.55 (slightly in ground)
  const groupY = -2.55 - (stemBottomLocalY * dna.scale);

  return (
    <>
      {/* Ground Plane */}
      <mesh position={[0, -2.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[25, 64]} />
        <meshStandardMaterial color="#8B7355" roughness={1} />
      </mesh>

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

        {/* Pod Glow - Subtle radiance around the pod center */}
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

        {/* Bud - pod shape with vertical stripes */}
        <group ref={budRef} position={stemTop}>
          {/* Main bud body - Pod shape using Lathe */}
          <mesh position={[0, 0, 0]}>
            <latheGeometry args={[
              useMemo(() => {
                const points = [];
                for (let i = 0; i <= 10; i++) {
                  const t = i / 10;
                  // Organic pod shape: narrow at bottom, wide at middle, pointy at top
                  // x is the radius at height y
                  const x = budRadius * Math.sin(t * Math.PI) * (1 - (dna.budPointiness * 0.5 * t));
                  const y = t * budHeight * 2;
                  points.push(new THREE.Vector2(x, y));
                }
                return points;
              }, [budRadius, budHeight, dna.budPointiness]),
              32
            ]} />
            <meshStandardMaterial
              color={dna.budColor}
              roughness={0.3}
              metalness={0.2}
            />
          </mesh>

          {/* Vertical Stripe 1 - Secondary Emotion */}
          <mesh rotation={[0, 0, 0]}>
            <latheGeometry args={[
              useMemo(() => {
                const points = [];
                for (let i = 0; i <= 10; i++) {
                  const t = i / 10;
                  const x = (budRadius + 0.005) * Math.sin(t * Math.PI) * (1 - (dna.budPointiness * 0.5 * t));
                  const y = t * budHeight * 2;
                  points.push(new THREE.Vector2(x, y));
                }
                return points;
              }, [budRadius, budHeight, dna.budPointiness]),
              32,
              0, // start angle
              Math.PI * 0.1 // phi length
            ]} />
            <meshStandardMaterial
              color={dna.budStripe2Color}
              roughness={0.35}
              metalness={0.15}
            />
          </mesh>

          {/* Vertical Stripe 1 (Mirror) */}
          <mesh rotation={[0, Math.PI, 0]}>
            <latheGeometry args={[
              useMemo(() => {
                const points = [];
                for (let i = 0; i <= 10; i++) {
                  const t = i / 10;
                  const x = (budRadius + 0.005) * Math.sin(t * Math.PI) * (1 - (dna.budPointiness * 0.5 * t));
                  const y = t * budHeight * 2;
                  points.push(new THREE.Vector2(x, y));
                }
                return points;
              }, [budRadius, budHeight, dna.budPointiness]),
              32,
              0,
              Math.PI * 0.1
            ]} />
            <meshStandardMaterial
              color={dna.budStripe2Color}
              roughness={0.35}
              metalness={0.15}
            />
          </mesh>

          {/* Vertical Stripe 2 - Tertiary Emotion */}
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <latheGeometry args={[
              useMemo(() => {
                const points = [];
                for (let i = 0; i <= 10; i++) {
                  const t = i / 10;
                  const x = (budRadius + 0.006) * Math.sin(t * Math.PI) * (1 - (dna.budPointiness * 0.5 * t));
                  const y = t * budHeight * 2;
                  points.push(new THREE.Vector2(x, y));
                }
                return points;
              }, [budRadius, budHeight, dna.budPointiness]),
              32,
              0,
              Math.PI * 0.08
            ]} />
            <meshStandardMaterial
              color={dna.budStripe3Color}
              roughness={0.35}
              metalness={0.15}
            />
          </mesh>

          {/* Vertical Stripe 2 (Mirror) */}
          <mesh rotation={[0, -Math.PI / 2, 0]}>
            <latheGeometry args={[
              useMemo(() => {
                const points = [];
                for (let i = 0; i <= 10; i++) {
                  const t = i / 10;
                  const x = (budRadius + 0.006) * Math.sin(t * Math.PI) * (1 - (dna.budPointiness * 0.5 * t));
                  const y = t * budHeight * 2;
                  points.push(new THREE.Vector2(x, y));
                }
                return points;
              }, [budRadius, budHeight, dna.budPointiness]),
              32,
              0,
              Math.PI * 0.08
            ]} />
            <meshStandardMaterial
              color={dna.budStripe3Color}
              roughness={0.35}
              metalness={0.15}
            />
          </mesh>
        </group>
      </group>

      <ambientLight intensity={0.5} />
    </>
  );
};

export default Sprout3D;
