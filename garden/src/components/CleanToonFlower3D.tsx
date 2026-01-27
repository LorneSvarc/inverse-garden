import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FlowerDNA } from '../types';
import { adjustColorSaturation } from '../utils/plantFading';
import { getToonGradient } from '../utils/toonGradient';

interface CleanToonFlower3DProps {
  dna: FlowerDNA;
  position?: [number, number, number];
  opacity?: number;
  saturation?: number;
}

/**
 * ToonPetal - Cel-shaded petal with subtle animation
 */
const ToonPetal: React.FC<{
  angle: number;
  row: number;
  dna: FlowerDNA;
  color: string;
  opacity: number;
  saturation: number;
}> = ({ angle, row, dna, color, opacity, saturation }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const gradientMap = useMemo(() => getToonGradient(), []);

  const petalShape = useMemo(() => {
    const shape = new THREE.Shape();
    const w = dna.petalWidth / 2;
    const l = dna.petalLength;
    shape.moveTo(0, 0);
    shape.bezierCurveTo(w, l * 0.3, w, l * 0.8, 0, l);
    shape.bezierCurveTo(-w, l * 0.8, -w, l * 0.3, 0, 0);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 3,
    });
  }, [dna.petalWidth, dna.petalLength]);

  const adjustedColor = useMemo(() => adjustColorSaturation(color, saturation), [color, saturation]);

  // Subtle petal animation
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime() * dna.wobbleSpeed * 0.5;
    meshRef.current.rotation.x = (Math.PI / 4) + (row * 0.2) + Math.sin(t + angle) * 0.05 * dna.petalCurvature;
  });

  return (
    <group rotation={[0, angle, 0]} position={[0, row * 0.15, 0]}>
      <mesh ref={meshRef} geometry={petalShape} castShadow>
        <meshToonMaterial
          color={adjustedColor}
          gradientMap={gradientMap}
          transparent
          opacity={opacity}
        />
      </mesh>
    </group>
  );
};

/**
 * ToonStemLeaf - Cel-shaded stem leaf
 */
const ToonStemLeaf: React.FC<{
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
  color: string;
  opacity: number;
  saturation: number;
}> = ({ position, rotation, scale, color, opacity, saturation }) => {
  const gradientMap = useMemo(() => getToonGradient(), []);

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.2, 0.2, 0.2, 0.8, 0, 1);
    s.bezierCurveTo(-0.2, 0.8, -0.2, 0.2, 0, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
  }, []);

  const adjustedColor = useMemo(() => adjustColorSaturation(color, saturation), [color, saturation]);

  return (
    <mesh position={position} rotation={rotation} geometry={shape} scale={[scale, scale, scale]} castShadow>
      <meshToonMaterial
        color={adjustedColor}
        gradientMap={gradientMap}
        side={THREE.DoubleSide}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
};

/**
 * CleanToonFlower3D - Cel-shaded flower with toon material
 *
 * Uses meshToonMaterial for soft cel-shaded look.
 * No MeshWobbleMaterial, no Sparkles, no emissive.
 * Keeps subtle petal animation.
 */
const CleanToonFlower3D: React.FC<CleanToonFlower3DProps> = ({
  dna,
  position = [0, 0, 0],
  opacity = 1,
  saturation = 1
}) => {
  const gradientMap = useMemo(() => getToonGradient(), []);

  const adjustedStemColor = useMemo(
    () => adjustColorSaturation(dna.stemColors[0], saturation),
    [dna.stemColors, saturation]
  );
  const adjustedCenterColor = useMemo(
    () => adjustColorSaturation(dna.centerColor, saturation),
    [dna.centerColor, saturation]
  );

  // Stem curve: base at Y=0 (ground level), flower head at Y=3
  const stemCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(dna.stemBend * 2, 1.5, 0),
      new THREE.Vector3(0, 3.0, 0)
    ]);
  }, [dna.stemBend]);

  const leaves = useMemo(() => {
    const items: { position: THREE.Vector3; rotation: THREE.Euler; index: number; scale: number; color: string }[] = [];
    if (!dna.leafCount) return items;

    const positions = [0.4, 0.6, 0.8];

    for (let i = 0; i < dna.leafCount; i++) {
      const t = i < positions.length ? positions[i] : 0.2 + (i * 0.2);

      const point = stemCurve.getPointAt(t);
      const tangent = stemCurve.getTangentAt(t).normalize();

      const up = new THREE.Vector3(0, 0, 1);
      let right = new THREE.Vector3().crossVectors(tangent, up).normalize();

      if (right.lengthSq() < 0.01) {
        right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(1, 0, 0)).normalize();
      }

      const alternateAngle = (i % 2) * Math.PI;
      const offsetAngle = (dna.leafOrientation || 0) * (Math.PI / 180);

      const outDir = right.clone().applyAxisAngle(tangent, alternateAngle + offsetAngle);

      const tilt = (dna.leafAngle === undefined ? 0.5 : dna.leafAngle) * (Math.PI / 2);

      const rotationAxis = new THREE.Vector3().crossVectors(outDir, tangent).normalize();

      const finalDirection = outDir.clone().applyAxisAngle(rotationAxis, tilt).normalize();

      const leafMatrix = new THREE.Matrix4().makeBasis(rotationAxis, finalDirection, new THREE.Vector3().crossVectors(rotationAxis, finalDirection));
      const finalRot = new THREE.Euler().setFromRotationMatrix(leafMatrix);

      // Leaf colors based on association count
      let leafColor: string;
      if (dna.stemColors.length === 1) {
        leafColor = dna.stemColors[0];
      } else if (dna.stemColors.length === 2) {
        leafColor = dna.stemColors[1];
      } else {
        leafColor = dna.stemColors[Math.min(i + 1, dna.stemColors.length - 1)];
      }

      items.push({
        position: point,
        rotation: finalRot,
        index: i,
        scale: dna.leafSize || 1.0,
        color: leafColor
      });
    }
    return items;
  }, [dna.leafCount, dna.leafSize, dna.leafOrientation, dna.leafAngle, dna.stemColors, stemCurve]);

  const petals = useMemo(() => {
    const items = [];
    for (let r = 0; r < dna.petalRows; r++) {
      const count = dna.petalCount - (r * 2);
      if (count <= 0) break;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (r * Math.PI / count);
        items.push({ angle, row: r, index: items.length });
      }
    }
    return items;
  }, [dna.petalCount, dna.petalRows]);

  return (
    <group position={position}>
      <group scale={[dna.scale, dna.scale, dna.scale]} rotation={[0, dna.rotation, 0]}>
        {/* Stem */}
        <mesh castShadow>
          <tubeGeometry args={[stemCurve, 20, 0.08, 8, false]} />
          <meshToonMaterial
            color={adjustedStemColor}
            gradientMap={gradientMap}
            transparent
            opacity={opacity}
          />
        </mesh>

        {/* Leaves on Stem */}
        {leaves.map((leaf, i) => (
          <ToonStemLeaf
            key={i}
            position={leaf.position}
            rotation={leaf.rotation}
            scale={leaf.scale}
            color={leaf.color}
            opacity={opacity}
            saturation={saturation}
          />
        ))}

        {/* Petals - positioned at top of stem (Y=3) */}
        <group position={[0, 3.0, 0]}>
          {petals.map((p, i) => (
            <ToonPetal
              key={`${p.index}-${dna.name}`}
              angle={p.angle}
              row={p.row}
              dna={dna}
              color={dna.petalColors[i % dna.petalColors.length]}
              opacity={opacity}
              saturation={saturation}
            />
          ))}

          {/* Center / Pistil */}
          <mesh position={[0, 0.2, 0]} castShadow>
            <sphereGeometry args={[0.4 * (dna.petalWidth / 2), 32, 32]} />
            <meshToonMaterial
              color={adjustedCenterColor}
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

export default CleanToonFlower3D;
