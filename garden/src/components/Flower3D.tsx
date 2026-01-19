import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshWobbleMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { FlowerDNA } from '../types';

interface Flower3DProps {
  dna: FlowerDNA;
  position?: [number, number, number];
  onPetalClick?: (index: number) => void;
}

const Petal: React.FC<{
  angle: number;
  row: number;
  dna: FlowerDNA;
  color: string;
  index: number;
  onClick?: () => void;
}> = ({ angle, row, dna, color, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null!);

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

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime() * dna.wobbleSpeed;
    meshRef.current.rotation.x = (Math.PI / 4) + (row * 0.2) + Math.sin(t + angle) * 0.1 * dna.petalCurvature;
  });

  return (
    <group rotation={[0, angle, 0]} position={[0, row * 0.15, 0]}>
      <mesh
        ref={meshRef}
        geometry={petalShape}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      >
        <MeshWobbleMaterial
          color={color}
          speed={dna.wobbleSpeed}
          factor={0.15}
          emissive={color}
          emissiveIntensity={dna.glowIntensity * 0.3}
          roughness={0.1}
          metalness={0.5}
        />
      </mesh>
    </group>
  );
};

const StemLeaf: React.FC<{
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
  dna: FlowerDNA;
  color: string;
}> = ({ position, rotation, scale, color }) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.2, 0.2, 0.2, 0.8, 0, 1);
    s.bezierCurveTo(-0.2, 0.8, -0.2, 0.2, 0, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
  }, []);

  return (
    <mesh position={position} rotation={rotation} geometry={shape} scale={[scale, scale, scale]}>
      <meshStandardMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  );
};

/**
 * Flower3D - Renders a procedurally generated flower based on DNA
 *
 * Modified from reference: removed ground plane and scene lights
 * since multiple flowers will share a single scene.
 */
const Flower3D: React.FC<Flower3DProps> = ({ dna, position = [0, 0, 0], onPetalClick }) => {
  const groupRef = useRef<THREE.Group>(null!);

  const stemCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -3.0, 0),
      new THREE.Vector3(dna.stemBend * 2, -1.5, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
  }, [dna.stemBend]);

  const leaves = useMemo(() => {
    const items: { position: THREE.Vector3; rotation: THREE.Euler; index: number; scale: number }[] = [];
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

      items.push({
        position: point,
        rotation: finalRot,
        index: i,
        scale: dna.leafSize || 1.0
      });
    }
    return items;
  }, [dna.leafCount, dna.leafSize, dna.leafOrientation, dna.leafAngle, stemCurve]);

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
      <group ref={groupRef} scale={[dna.scale, dna.scale, dna.scale]} position={[0, 0.5, 0]}>
        {/* Stem */}
        <mesh>
          <tubeGeometry args={[stemCurve, 20, 0.08, 8, false]} />
          <meshStandardMaterial color={dna.stemColors[0]} />
        </mesh>

        {/* Leaves on Stem */}
        {leaves.map((leaf, i) => {
          // GDD spec for association → leaf colors:
          // 1 association: all leaves = that color
          // 2 associations: all leaves = secondary color
          // 3 associations: leaf 1 = secondary, leaf 2 = tertiary
          let leafColor: string;
          if (dna.stemColors.length === 1) {
            leafColor = dna.stemColors[0];
          } else if (dna.stemColors.length === 2) {
            leafColor = dna.stemColors[1]; // All leaves use secondary
          } else {
            // 3+ associations: leaf index 0 gets secondary, leaf index 1 gets tertiary
            leafColor = dna.stemColors[Math.min(i + 1, dna.stemColors.length - 1)];
          }
          return (
            <StemLeaf
              key={i}
              position={leaf.position}
              rotation={leaf.rotation}
              scale={leaf.scale}
              dna={dna}
              color={leafColor}
            />
          );
        })}

        {/* Petals */}
        {petals.map((p, i) => (
          <Petal
            key={`${p.index}-${dna.name}`}
            angle={p.angle}
            row={p.row}
            dna={dna}
            color={dna.petalColors[i % dna.petalColors.length]}
            index={p.index}
            onClick={() => onPetalClick?.(p.index)}
          />
        ))}

        {/* Center / Pistil */}
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.4 * (dna.petalWidth / 2), 32, 32]} />
          <meshStandardMaterial
            color={dna.centerColor}
            emissive={dna.centerColor}
            emissiveIntensity={dna.glowIntensity}
          />
          <Sparkles count={20} scale={1} size={2} speed={dna.wobbleSpeed} color={dna.centerColor} />
        </mesh>
      </group>
    </group>
  );
};

export default Flower3D;
