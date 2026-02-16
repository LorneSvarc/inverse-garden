import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SproutDNA } from '../types';
import { adjustColorSaturation } from '../utils/plantFading';
import { getToonGradient } from '../utils/toonGradient';

interface CleanToonSprout3DProps {
  dna: SproutDNA;
  position?: [number, number, number];
  opacity?: number;
  saturation?: number;
  onClick?: (e: any) => void;
}

/**
 * ToonCotyledon - Cel-shaded cotyledon with gentle sway
 */
const ToonCotyledon: React.FC<{
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
  color: string;
  swaySpeed: number;
  swayAmount: number;
  index: number;
  opacity: number;
  saturation: number;
}> = ({ position, rotation, scale, color, swaySpeed, swayAmount, index, opacity, saturation }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const gradientMap = useMemo(() => getToonGradient(), []);

  const shape = useMemo(() => {
    return new THREE.SphereGeometry(0.077, 24, 16);
  }, []);

  const adjustedColor = useMemo(() => adjustColorSaturation(color, saturation), [color, saturation]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime() * swaySpeed * 0.5;
    const phase = index * Math.PI;
    meshRef.current.rotation.z = rotation.z + Math.sin(t * 0.8 + phase) * swayAmount * 0.1;
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      geometry={shape}
      scale={[1.2 * scale, 0.4 * scale, 0.8 * scale]}
      castShadow
    >
      <meshToonMaterial
        color={adjustedColor}
        gradientMap={gradientMap}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
};

/**
 * CleanToonSprout3D - Cel-shaded sprout with toon material
 *
 * Uses meshToonMaterial for soft cel-shaded look.
 * RESTORED: Bud stripes for secondary/tertiary emotion encoding.
 * No MeshWobbleMaterial, no Sparkles.
 * Keeps gentle sway animation.
 */
const CleanToonSprout3D: React.FC<CleanToonSprout3DProps> = ({
  dna,
  position = [0, 0, 0],
  opacity = 1,
  saturation = 1,
  onClick,
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const budRef = useRef<THREE.Group>(null!);
  const gradientMap = useMemo(() => getToonGradient(), []);

  // Apply saturation to colors
  const adjustedStemColor = useMemo(
    () => adjustColorSaturation(dna.stemColor, saturation),
    [dna.stemColor, saturation]
  );
  const adjustedBudColor = useMemo(
    () => adjustColorSaturation(dna.budColor, saturation),
    [dna.budColor, saturation]
  );
  // RESTORED: Stripe colors for secondary/tertiary emotion encoding
  const adjustedBudStripe2Color = useMemo(
    () => adjustColorSaturation(dna.budStripe2Color, saturation),
    [dna.budStripe2Color, saturation]
  );
  const adjustedBudStripe3Color = useMemo(
    () => adjustColorSaturation(dna.budStripe3Color, saturation),
    [dna.budStripe3Color, saturation]
  );

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

  // Gentle sway animation
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * dna.swaySpeed * 0.5;
    groupRef.current.rotation.z = Math.sin(t * 0.7) * dna.swayAmount * 0.1;
    groupRef.current.rotation.x = Math.cos(t * 0.5) * dna.swayAmount * 0.05;

    if (budRef.current) {
      budRef.current.rotation.z = Math.sin(t * 1.1) * dna.swayAmount * 0.025;
    }
  });

  const stemRadius = 0.026 * dna.stemThickness;
  const budRadius = 0.154 * dna.budSize;
  const budHeight = 0.231 * dna.budSize;

  // Calculate positioning so the stem reaches the ground
  const stemBottomLocalY = -0.9 * dna.stemHeight;
  const groupY = 0 - (stemBottomLocalY * dna.scale);

  // Bud shape points
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

  // RESTORED: Stripe points (slightly larger to show on surface)
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
    <group position={position} onClick={onClick}>
      <group ref={groupRef} scale={[dna.scale, dna.scale, dna.scale]} position={[0, groupY, 0]}>
        {/* Stem */}
        <mesh castShadow>
          <tubeGeometry args={[stemCurve, 32, stemRadius, 12, false]} />
          <meshToonMaterial
            color={adjustedStemColor}
            gradientMap={gradientMap}
            transparent
            opacity={opacity}
          />
        </mesh>

        {/* Cotyledons */}
        {cotyledons.map((cot, i) => (
          <ToonCotyledon
            key={i}
            position={cot.position}
            rotation={cot.rotation}
            scale={cot.scale}
            color={cot.color}
            swaySpeed={dna.swaySpeed}
            swayAmount={dna.swayAmount}
            index={i}
            opacity={opacity}
            saturation={saturation}
          />
        ))}

        {/* Bud with RESTORED stripes (secondary/tertiary emotion encoding) */}
        <group ref={budRef} position={stemTop}>
          {/* Main bud body */}
          <mesh position={[0, 0, 0]} castShadow>
            <latheGeometry args={[budShapePoints, 32]} />
            <meshToonMaterial
              color={adjustedBudColor}
              gradientMap={gradientMap}
              transparent
              opacity={opacity}
            />
          </mesh>

          {/* RESTORED: Stripe 1 - Secondary Emotion */}
          <mesh rotation={[0, 0, 0]}>
            <latheGeometry args={[stripe2Points, 32, 0, Math.PI * 0.1]} />
            <meshToonMaterial
              color={adjustedBudStripe2Color}
              gradientMap={gradientMap}
              transparent
              opacity={opacity}
            />
          </mesh>

          {/* Stripe 1 Mirror */}
          <mesh rotation={[0, Math.PI, 0]}>
            <latheGeometry args={[stripe2Points, 32, 0, Math.PI * 0.1]} />
            <meshToonMaterial
              color={adjustedBudStripe2Color}
              gradientMap={gradientMap}
              transparent
              opacity={opacity}
            />
          </mesh>

          {/* RESTORED: Stripe 2 - Tertiary Emotion */}
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <latheGeometry args={[stripe3Points, 32, 0, Math.PI * 0.08]} />
            <meshToonMaterial
              color={adjustedBudStripe3Color}
              gradientMap={gradientMap}
              transparent
              opacity={opacity}
            />
          </mesh>

          {/* Stripe 2 Mirror */}
          <mesh rotation={[0, -Math.PI / 2, 0]}>
            <latheGeometry args={[stripe3Points, 32, 0, Math.PI * 0.08]} />
            <meshToonMaterial
              color={adjustedBudStripe3Color}
              gradientMap={gradientMap}
              transparent
              opacity={opacity}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
};

export default CleanToonSprout3D;
