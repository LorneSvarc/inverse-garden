import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshWobbleMaterial, Float, Sparkles, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { FlowerDNA } from '../types';

interface Flower3DProps {
  dna: FlowerDNA;
  onPetalClick?: (index: number) => void;
}

const Petal: React.FC<{
  angle: number;
  row: number;
  dna: FlowerDNA;
  color: string;
  index: number;
  onClick?: () => void;
}> = ({ angle, row, dna, color, index, onClick }) => {
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
    // Gentle sway
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
}> = ({ position, rotation, scale, dna, color }) => {
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

const Flower3D: React.FC<Flower3DProps> = ({ dna, onPetalClick }) => {
  const groupRef = useRef<THREE.Group>(null!);

  const stemCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -3.0, 0), // With group at y=0.5, reaches ground at y=-2.5 world
      new THREE.Vector3(dna.stemBend * 2, -1.5, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
  }, [dna.stemBend]);

  const leaves = useMemo(() => {
    const items = [];
    if (!dna.leafCount) return items;

    // Fixed positions for up to 3 leaves to prevent jumping
    // Adjusted to be safely above ground
    const positions = [0.4, 0.6, 0.8]; // Slightly higher up the stem

    for (let i = 0; i < dna.leafCount; i++) {
      // Use fixed t if within our predefined positions, otherwise interpolate (fallback for >3)
      const t = i < positions.length ? positions[i] : 0.2 + (i * 0.2);

      const point = stemCurve.getPointAt(t);
      const tangent = stemCurve.getTangentAt(t).normalize();

      // Define a stable "Up" vector to calculate the frame
      // Since stem bends in XY plane mostly, World Z is stable "Forward"
      const up = new THREE.Vector3(0, 0, 1);
      let right = new THREE.Vector3().crossVectors(tangent, up).normalize();

      if (right.lengthSq() < 0.01) {
        // Tangent is close to Z, use X as Up
        right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(1, 0, 0)).normalize();
      }

      // "Right" vector is effectively "Out" from the stem side (orthogonal to stem)
      // We want to rotate this "Right" vector around the Tangent to get the specific leaf direction.

      const alternateAngle = (i % 2) * Math.PI;
      const offsetAngle = (dna.leafOrientation || 0) * (Math.PI / 180);

      // outDir is the direction sticking OUT of the stem where the leaf base attaches
      const outDir = right.clone().applyAxisAngle(tangent, alternateAngle + offsetAngle);

      // Now calculate the direction the leaf itself points.
      // It points along outDir, but tilted towards (or away from) Tangent.
      // leafAngle: 0 = perpendicular (90 deg to stem), 1 = parallel (0 deg to stem)
      // Let's say default 0.5 is 45 degrees.
      // Tilt angle: rotate outDir around (outDir x Tangent) by some amount.
      const tilt = (dna.leafAngle === undefined ? 0.5 : dna.leafAngle) * (Math.PI / 2);

      const rotationAxis = new THREE.Vector3().crossVectors(outDir, tangent).normalize();

      // If leafAngle is near 1, it points along Tangent (Up). If 0, points along outDir.
      // We want to start at outDir and rotate TOWARDS tangent.
      const finalDirection = outDir.clone().applyAxisAngle(rotationAxis, tilt).normalize();

      // Construct Basis for the Leaf
      // Leaf Y axis aligns with finalDirection.
      // Leaf X axis aligns with rotationAxis (horizontal relative to leaf).
      // Leaf Z axis aligns with Cross(X, Y) -> Face of leaf.

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
    <>
      {/* Ground Plane - Outside scaled group */}
      <mesh position={[0, -2.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[25, 64]} />
        <meshStandardMaterial color="#8B7355" roughness={1} />
      </mesh>

      <group ref={groupRef} scale={[dna.scale, dna.scale, dna.scale]} position={[0, 0.5, 0]}>
        {/* Stem */}
        <mesh>
          <tubeGeometry args={[
            stemCurve,
            20, // segments
            0.08, // radius
            8, // radialSegments
            false // closed
          ]} />
          <meshStandardMaterial color={dna.stemColors[0]} />
        </mesh>

        {/* Leaves on Stem */}
        {leaves.map((leaf, i) => (
          <StemLeaf
            key={i}
            position={leaf.position}
            rotation={leaf.rotation}
            scale={leaf.scale}
            dna={dna}
            color={dna.stemColors[i % dna.stemColors.length]}
          />
        ))}

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

        <pointLight position={[10, 10, 10]} intensity={1.5} color={dna.petalColors[0]} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color={dna.centerColor} />
      </group>
      <ambientLight intensity={0.5} />
    </>
  );
};

export default Flower3D;
