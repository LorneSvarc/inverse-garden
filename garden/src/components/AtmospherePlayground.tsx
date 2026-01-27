import { useState, useEffect, useMemo, useLayoutEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, useHelper } from '@react-three/drei';
import { EffectComposer, BrightnessContrast, Bloom, Sepia } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import type { MoodEntryWithPercentile, PlantDNA, FlowerDNA, SproutDNA, DecayDNA } from '../types';
import { parseCSVWithPercentiles } from '../utils/csvParser';
import { entryToDNA } from '../utils/dnaMapper';
import { calculatePositions, getLayoutConfig } from '../utils/positionCalculator';
import { adjustColorSaturation } from '../utils/plantFading';
import Flower3D from './Flower3D';
import Sprout3D from './Sprout3D';
import Decay3D from './Decay3D';
import CleanFlower3D from './CleanFlower3D';
import CleanSprout3D from './CleanSprout3D';
import CleanDecay3D from './CleanDecay3D';
import './AtmospherePlayground.css';

// Rendering mode type
type RenderMode = 'normal' | 'toon' | 'clean' | 'clean-toon';

// =============================================================================
// TOON SHADING - Gradient texture for cel shading effect
// =============================================================================

function createToonGradientTexture(): THREE.DataTexture {
  const colors = new Uint8Array([
    64, 64, 64, 255,    // Dark band
    128, 128, 128, 255, // Mid band
    200, 200, 200, 255, // Light band
    255, 255, 255, 255, // Highlight band
  ]);
  const texture = new THREE.DataTexture(colors, 4, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

// Singleton gradient texture for all toon materials
let toonGradientTexture: THREE.DataTexture | null = null;
function getToonGradient(): THREE.DataTexture {
  if (!toonGradientTexture) {
    toonGradientTexture = createToonGradientTexture();
  }
  return toonGradientTexture;
}

// =============================================================================
// TOON FLOWER - Cel-shaded version (no wobble, no emissive)
// =============================================================================

const ToonPetal: React.FC<{
  angle: number;
  row: number;
  dna: FlowerDNA;
  color: string;
  saturation: number;
}> = ({ angle, row, dna, color, saturation }) => {
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

  // Simple animation without wobble material
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime() * dna.wobbleSpeed * 0.5;
    meshRef.current.rotation.x = (Math.PI / 4) + (row * 0.2) + Math.sin(t + angle) * 0.05 * dna.petalCurvature;
  });

  return (
    <group rotation={[0, angle, 0]} position={[0, row * 0.15, 0]}>
      <mesh ref={meshRef} geometry={petalShape} castShadow>
        <meshToonMaterial color={adjustedColor} gradientMap={gradientMap} />
      </mesh>
    </group>
  );
};

const ToonFlower3D: React.FC<{
  dna: FlowerDNA;
  position: [number, number, number];
  saturation?: number;
}> = ({ dna, position, saturation = 1 }) => {
  const gradientMap = useMemo(() => getToonGradient(), []);

  const adjustedStemColor = useMemo(
    () => adjustColorSaturation(dna.stemColors[0], saturation),
    [dna.stemColors, saturation]
  );
  const adjustedCenterColor = useMemo(
    () => adjustColorSaturation(dna.centerColor, saturation),
    [dna.centerColor, saturation]
  );

  const stemCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(dna.stemBend * 2, 1.5, 0),
      new THREE.Vector3(0, 3.0, 0)
    ]);
  }, [dna.stemBend]);

  const leaves = useMemo(() => {
    const items: { position: THREE.Vector3; rotation: THREE.Euler; scale: number; color: string }[] = [];
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
      let leafColor: string;
      if (dna.stemColors.length === 1) leafColor = dna.stemColors[0];
      else if (dna.stemColors.length === 2) leafColor = dna.stemColors[1];
      else leafColor = dna.stemColors[Math.min(i + 1, dna.stemColors.length - 1)];
      items.push({ position: point, rotation: finalRot, scale: dna.leafSize || 1.0, color: leafColor });
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

  const leafShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.2, 0.2, 0.2, 0.8, 0, 1);
    s.bezierCurveTo(-0.2, 0.8, -0.2, 0.2, 0, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
  }, []);

  return (
    <group position={position}>
      <group scale={[dna.scale, dna.scale, dna.scale]} rotation={[0, dna.rotation, 0]}>
        {/* Stem */}
        <mesh castShadow>
          <tubeGeometry args={[stemCurve, 20, 0.08, 8, false]} />
          <meshToonMaterial color={adjustedStemColor} gradientMap={gradientMap} />
        </mesh>

        {/* Leaves */}
        {leaves.map((leaf, i) => (
          <mesh
            key={i}
            position={leaf.position}
            rotation={leaf.rotation}
            geometry={leafShape}
            scale={[leaf.scale, leaf.scale, leaf.scale]}
            castShadow
          >
            <meshToonMaterial
              color={adjustColorSaturation(leaf.color, saturation)}
              gradientMap={gradientMap}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}

        {/* Petals */}
        <group position={[0, 3.0, 0]}>
          {petals.map((p) => (
            <ToonPetal
              key={p.index}
              angle={p.angle}
              row={p.row}
              dna={dna}
              color={dna.petalColors[p.index % dna.petalColors.length]}
              saturation={saturation}
            />
          ))}

          {/* Center */}
          <mesh position={[0, 0.2, 0]} castShadow>
            <sphereGeometry args={[0.4 * (dna.petalWidth / 2), 32, 32]} />
            <meshToonMaterial color={adjustedCenterColor} gradientMap={gradientMap} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

// =============================================================================
// TOON SPROUT - Cel-shaded version (no wobble, no sparkles)
// =============================================================================

const ToonSprout3D: React.FC<{
  dna: SproutDNA;
  position: [number, number, number];
  saturation?: number;
}> = ({ dna, position, saturation = 1 }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const gradientMap = useMemo(() => getToonGradient(), []);

  const adjustedStemColor = useMemo(
    () => adjustColorSaturation(dna.stemColor, saturation),
    [dna.stemColor, saturation]
  );
  const adjustedBudColor = useMemo(
    () => adjustColorSaturation(dna.budColor, saturation),
    [dna.budColor, saturation]
  );

  const stemCurve = useMemo(() => {
    const height = -0.9 * dna.stemHeight;
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, height, 0),
      new THREE.Vector3(dna.stemCurve * 0.2, height * 0.5, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
  }, [dna.stemCurve, dna.stemHeight]);

  const stemTop = useMemo(() => stemCurve.getPointAt(1), [stemCurve]);
  const stemRadius = 0.026 * dna.stemThickness;
  const budRadius = 0.154 * dna.budSize;
  const budHeight = 0.231 * dna.budSize;
  const stemBottomLocalY = -0.9 * dna.stemHeight;
  const groupY = 0 - (stemBottomLocalY * dna.scale);

  const cotyledons = useMemo(() => {
    const t = 0.45;
    const point = stemCurve.getPointAt(t);
    const scale = dna.cotyledonSize * 1.54;
    return [
      { position: new THREE.Vector3(point.x + 0.051, point.y, point.z), rotation: new THREE.Euler(0, 0, -0.4), color: dna.cotyledon1Color, scale },
      { position: new THREE.Vector3(point.x - 0.051, point.y, point.z), rotation: new THREE.Euler(0, 0, 0.4), color: dna.cotyledon2Color, scale },
    ];
  }, [stemCurve, dna.cotyledon1Color, dna.cotyledon2Color, dna.cotyledonSize]);

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

  // Gentle sway animation
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * dna.swaySpeed * 0.5;
    groupRef.current.rotation.z = Math.sin(t * 0.7) * dna.swayAmount * 0.1;
  });

  return (
    <group position={position}>
      <group ref={groupRef} scale={[dna.scale, dna.scale, dna.scale]} position={[0, groupY, 0]}>
        {/* Stem */}
        <mesh castShadow>
          <tubeGeometry args={[stemCurve, 32, stemRadius, 12, false]} />
          <meshToonMaterial color={adjustedStemColor} gradientMap={gradientMap} />
        </mesh>

        {/* Cotyledons */}
        {cotyledons.map((cot, i) => (
          <mesh
            key={i}
            position={cot.position}
            rotation={cot.rotation}
            scale={[1.2 * cot.scale, 0.4 * cot.scale, 0.8 * cot.scale]}
            castShadow
          >
            <sphereGeometry args={[0.077, 24, 16]} />
            <meshToonMaterial
              color={adjustColorSaturation(cot.color, saturation)}
              gradientMap={gradientMap}
            />
          </mesh>
        ))}

        {/* Bud */}
        <group position={stemTop}>
          <mesh castShadow>
            <latheGeometry args={[budShapePoints, 32]} />
            <meshToonMaterial color={adjustedBudColor} gradientMap={gradientMap} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

// =============================================================================
// TOON DECAY - Cel-shaded version (flat shaded ground scar)
// =============================================================================

const ToonDecay3D: React.FC<{
  dna: DecayDNA;
  position: [number, number, number];
  saturation?: number;
}> = ({ dna, position, saturation = 1 }) => {
  const gradientMap = useMemo(() => getToonGradient(), []);

  const adjustedLayer1Color = useMemo(
    () => adjustColorSaturation(dna.layer1Color, saturation),
    [dna.layer1Color, saturation]
  );
  const adjustedLayer2Color = useMemo(
    () => adjustColorSaturation(dna.layer2Color, saturation),
    [dna.layer2Color, saturation]
  );
  const adjustedLayer3Color = useMemo(
    () => adjustColorSaturation(dna.layer3Color, saturation),
    [dna.layer3Color, saturation]
  );

  const createLayerShape = (baseRadius: number, wobbleAmount: number, aspectRatio: number, seed: number): THREE.Shape => {
    const shape = new THREE.Shape();
    const points = 64;
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const xRadius = baseRadius * aspectRatio;
      const yRadius = baseRadius;
      const wobble1 = Math.sin(angle * 2 + seed) * 0.15;
      const wobble2 = Math.sin(angle * 3 + seed * 1.7) * 0.1;
      const wobble3 = Math.cos(angle * 5 + seed * 2.3) * 0.05;
      const totalWobble = 1 + (wobble1 + wobble2 + wobble3) * wobbleAmount;
      const squareness = Math.min((aspectRatio - 1) * 0.3, 0.4);
      const cornerSoftness = 1 - squareness * Math.pow(Math.abs(Math.sin(2 * angle)), 0.5) * 0.15;
      const x = Math.cos(angle) * xRadius * totalWobble * cornerSoftness;
      const y = Math.sin(angle) * yRadius * totalWobble * cornerSoftness;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  };

  const layer3Geometry = useMemo(() => {
    const shape = createLayerShape(dna.size, dna.edgeWobble, dna.aspectRatio, 1.0);
    return new THREE.ShapeGeometry(shape);
  }, [dna.size, dna.edgeWobble, dna.aspectRatio]);

  const layer2Geometry = useMemo(() => {
    const shape = createLayerShape(dna.size * 0.7, dna.edgeWobble, dna.aspectRatio, 2.5);
    return new THREE.ShapeGeometry(shape);
  }, [dna.size, dna.edgeWobble, dna.aspectRatio]);

  const layer1Geometry = useMemo(() => {
    const shape = createLayerShape(dna.size * 0.45, dna.edgeWobble, dna.aspectRatio, 4.2);
    return new THREE.ShapeGeometry(shape);
  }, [dna.size, dna.edgeWobble, dna.aspectRatio]);

  return (
    <group position={position}>
      <group position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh position={[0, 0, 0.001]} geometry={layer3Geometry}>
          <meshToonMaterial color={adjustedLayer3Color} gradientMap={gradientMap} />
        </mesh>
        <mesh position={[0, 0, 0.015]} geometry={layer2Geometry}>
          <meshToonMaterial color={adjustedLayer2Color} gradientMap={gradientMap} />
        </mesh>
        <mesh position={[0, 0, 0.028]} geometry={layer1Geometry}>
          <meshToonMaterial color={adjustedLayer1Color} gradientMap={gradientMap} />
        </mesh>
      </group>
    </group>
  );
};

// =============================================================================
// CLEAN TOON DECAY - Toon shading WITH cracks (data encoding restored)
// =============================================================================

const CleanToonDecay3D: React.FC<{
  dna: DecayDNA;
  position: [number, number, number];
  saturation?: number;
}> = ({ dna, position, saturation = 1 }) => {
  const gradientMap = useMemo(() => getToonGradient(), []);

  const adjustedLayer1Color = useMemo(
    () => adjustColorSaturation(dna.layer1Color, saturation),
    [dna.layer1Color, saturation]
  );
  const adjustedLayer2Color = useMemo(
    () => adjustColorSaturation(dna.layer2Color, saturation),
    [dna.layer2Color, saturation]
  );
  const adjustedLayer3Color = useMemo(
    () => adjustColorSaturation(dna.layer3Color, saturation),
    [dna.layer3Color, saturation]
  );

  const createLayerShape = (baseRadius: number, wobbleAmount: number, aspectRatio: number, seed: number): THREE.Shape => {
    const shape = new THREE.Shape();
    const points = 64;
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const xRadius = baseRadius * aspectRatio;
      const yRadius = baseRadius;
      const wobble1 = Math.sin(angle * 2 + seed) * 0.15;
      const wobble2 = Math.sin(angle * 3 + seed * 1.7) * 0.1;
      const wobble3 = Math.cos(angle * 5 + seed * 2.3) * 0.05;
      const totalWobble = 1 + (wobble1 + wobble2 + wobble3) * wobbleAmount;
      const squareness = Math.min((aspectRatio - 1) * 0.3, 0.4);
      const cornerSoftness = 1 - squareness * Math.pow(Math.abs(Math.sin(2 * angle)), 0.5) * 0.15;
      const x = Math.cos(angle) * xRadius * totalWobble * cornerSoftness;
      const y = Math.sin(angle) * yRadius * totalWobble * cornerSoftness;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  };

  const layer3Geometry = useMemo(() => {
    const shape = createLayerShape(dna.size, dna.edgeWobble, dna.aspectRatio, 1.0);
    return new THREE.ShapeGeometry(shape);
  }, [dna.size, dna.edgeWobble, dna.aspectRatio]);

  const layer2Geometry = useMemo(() => {
    const shape = createLayerShape(dna.size * 0.7, dna.edgeWobble, dna.aspectRatio, 2.5);
    return new THREE.ShapeGeometry(shape);
  }, [dna.size, dna.edgeWobble, dna.aspectRatio]);

  const layer1Geometry = useMemo(() => {
    const shape = createLayerShape(dna.size * 0.45, dna.edgeWobble, dna.aspectRatio, 4.2);
    return new THREE.ShapeGeometry(shape);
  }, [dna.size, dna.edgeWobble, dna.aspectRatio]);

  // RESTORED: Cracks from original Decay3D - these encode association colors
  const cracks = useMemo(() => {
    const crackList: { geometry: THREE.ShapeGeometry; colorIndex: number }[] = [];
    const count = Math.max(4, Math.min(12, dna.crackCount));
    const maxLength = dna.size * 0.95;
    const baseWidth = dna.size * 0.06;

    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2;
      const angleOffset = (Math.sin(i * 7.3) * 0.5 - 0.25) * 0.26;
      const startAngle = baseAngle + angleOffset;

      const segments = 8;
      const segmentLength = maxLength / segments;
      const points: { x: number; y: number }[] = [{ x: 0, y: 0 }];

      let currentAngle = startAngle;
      let cx = 0;
      let cy = 0;

      for (let j = 1; j <= segments; j++) {
        const zigzag = Math.sin(j * 2.5 + i * 1.3) * dna.crackWobble * 0.4;
        currentAngle = startAngle + zigzag;
        cx += Math.cos(currentAngle) * segmentLength;
        cy += Math.sin(currentAngle) * segmentLength;
        points.push({ x: cx, y: cy });
      }

      const crackShape = new THREE.Shape();
      for (let j = 0; j < points.length; j++) {
        const p = points[j];
        const progress = j / (points.length - 1);
        const width = baseWidth * (1 - progress * 0.7);
        const nextP = points[Math.min(j + 1, points.length - 1)];
        const dx = nextP.x - p.x;
        const dy = nextP.y - p.y;
        const perpAngle = Math.atan2(dy, dx) + Math.PI / 2;
        const offsetX = Math.cos(perpAngle) * width;
        const offsetY = Math.sin(perpAngle) * width;
        if (j === 0) crackShape.moveTo(p.x + offsetX, p.y + offsetY);
        else crackShape.lineTo(p.x + offsetX, p.y + offsetY);
      }
      for (let j = points.length - 1; j >= 0; j--) {
        const p = points[j];
        const progress = j / (points.length - 1);
        const width = baseWidth * (1 - progress * 0.7);
        const nextP = points[Math.min(j + 1, points.length - 1)];
        const dx = nextP.x - p.x;
        const dy = nextP.y - p.y;
        const perpAngle = Math.atan2(dy, dx) - Math.PI / 2;
        const offsetX = Math.cos(perpAngle) * width;
        const offsetY = Math.sin(perpAngle) * width;
        crackShape.lineTo(p.x + offsetX, p.y + offsetY);
      }
      crackShape.closePath();
      crackList.push({ geometry: new THREE.ShapeGeometry(crackShape), colorIndex: i % 3 });
    }
    return crackList;
  }, [dna.size, dna.crackCount, dna.crackWobble]);

  const getCrackColor = (colorIndex: number): string => {
    let baseColor: string;
    if (colorIndex === 0) baseColor = dna.crack1Color;
    else if (colorIndex === 1) baseColor = dna.crack2Color || dna.crack1Color;
    else baseColor = dna.crack3Color || dna.crack1Color;
    return adjustColorSaturation(baseColor, saturation);
  };

  return (
    <group position={position}>
      <group position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh position={[0, 0, 0.001]} geometry={layer3Geometry}>
          <meshToonMaterial color={adjustedLayer3Color} gradientMap={gradientMap} />
        </mesh>
        <mesh position={[0, 0, 0.015]} geometry={layer2Geometry}>
          <meshToonMaterial color={adjustedLayer2Color} gradientMap={gradientMap} />
        </mesh>
        <mesh position={[0, 0, 0.028]} geometry={layer1Geometry}>
          <meshToonMaterial color={adjustedLayer1Color} gradientMap={gradientMap} />
        </mesh>
        {/* RESTORED: Cracks with toon material */}
        {cracks.map((crack, idx) => (
          <mesh key={`crack-${idx}`} position={[0, 0, 0.035]} geometry={crack.geometry}>
            <meshToonMaterial color={getCrackColor(crack.colorIndex)} gradientMap={gradientMap} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// =============================================================================
// BARREN DECAY - Experimental "barren patch" style
// Goal: Feel like depleted/barren ground rather than abstract graphic disc
// =============================================================================

// Helper to blend a color toward brown/earth tone
function blendTowardEarth(hexColor: string, amount: number): string {
  const earthColor = { r: 0x3d, g: 0x28, b: 0x17 }; // #3d2817 - ground color

  // Parse hex
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Blend toward earth
  const newR = Math.round(r + (earthColor.r - r) * amount);
  const newG = Math.round(g + (earthColor.g - g) * amount);
  const newB = Math.round(b + (earthColor.b - b) * amount);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

const BarrenDecay3D: React.FC<{
  dna: DecayDNA;
  position: [number, number, number];
  saturation?: number;
}> = ({ dna, position, saturation = 1 }) => {
  const gradientMap = useMemo(() => getToonGradient(), []);

  // EXPERIMENTAL: Heavy desaturation (30%) + blend toward earth tone
  const barrenSaturation = saturation * 0.3;
  const earthBlend = 0.4; // 40% blend toward ground color

  const adjustedLayer1Color = useMemo(() => {
    const desaturated = adjustColorSaturation(dna.layer1Color, barrenSaturation);
    return blendTowardEarth(desaturated, earthBlend);
  }, [dna.layer1Color, barrenSaturation]);

  const adjustedLayer2Color = useMemo(() => {
    const desaturated = adjustColorSaturation(dna.layer2Color, barrenSaturation);
    return blendTowardEarth(desaturated, earthBlend);
  }, [dna.layer2Color, barrenSaturation]);

  const adjustedLayer3Color = useMemo(() => {
    const desaturated = adjustColorSaturation(dna.layer3Color, barrenSaturation);
    return blendTowardEarth(desaturated, earthBlend);
  }, [dna.layer3Color, barrenSaturation]);

  // EXPERIMENTAL: Much stronger edge wobble (3x) for very irregular boundaries
  const amplifiedEdgeWobble = Math.min(dna.edgeWobble * 3.0, 1.2);

  // EXPERIMENTAL: Stronger crack wobble (2x) for organic variation
  const amplifiedCrackWobble = Math.min(dna.crackWobble * 2.0, 1.0);

  const createLayerShape = (baseRadius: number, wobbleAmount: number, aspectRatio: number, seed: number): THREE.Shape => {
    const shape = new THREE.Shape();
    const points = 64;
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const xRadius = baseRadius * aspectRatio;
      const yRadius = baseRadius;
      // VERY AGGRESSIVE wobble for obviously irregular boundaries
      const wobble1 = Math.sin(angle * 2 + seed) * 0.25;
      const wobble2 = Math.sin(angle * 3 + seed * 1.7) * 0.2;
      const wobble3 = Math.cos(angle * 5 + seed * 2.3) * 0.15;
      const wobble4 = Math.sin(angle * 7 + seed * 3.1) * 0.1;
      const wobble5 = Math.cos(angle * 11 + seed * 4.7) * 0.08; // Extra high-frequency noise
      const totalWobble = 1 + (wobble1 + wobble2 + wobble3 + wobble4 + wobble5) * wobbleAmount;
      // Remove squareness/cornerSoftness for more organic shape
      const x = Math.cos(angle) * xRadius * totalWobble;
      const y = Math.sin(angle) * yRadius * totalWobble;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  };

  const layer3Geometry = useMemo(() => {
    const shape = createLayerShape(dna.size, amplifiedEdgeWobble, dna.aspectRatio, 1.0);
    return new THREE.ShapeGeometry(shape);
  }, [dna.size, amplifiedEdgeWobble, dna.aspectRatio]);

  const layer2Geometry = useMemo(() => {
    const shape = createLayerShape(dna.size * 0.7, amplifiedEdgeWobble, dna.aspectRatio, 2.5);
    return new THREE.ShapeGeometry(shape);
  }, [dna.size, amplifiedEdgeWobble, dna.aspectRatio]);

  const layer1Geometry = useMemo(() => {
    const shape = createLayerShape(dna.size * 0.45, amplifiedEdgeWobble, dna.aspectRatio, 4.2);
    return new THREE.ShapeGeometry(shape);
  }, [dna.size, amplifiedEdgeWobble, dna.aspectRatio]);

  // Cracks with amplified wobble for more organic variation
  const cracks = useMemo(() => {
    const crackList: { geometry: THREE.ShapeGeometry; colorIndex: number }[] = [];
    const count = Math.max(4, Math.min(12, dna.crackCount));
    const maxLength = dna.size * 0.95;
    const baseWidth = dna.size * 0.06;

    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2;
      // More variation in crack angle offset
      const angleOffset = (Math.sin(i * 7.3) * 0.5 - 0.25) * 0.35;
      const startAngle = baseAngle + angleOffset;

      const segments = 8;
      const segmentLength = maxLength / segments;
      const points: { x: number; y: number }[] = [{ x: 0, y: 0 }];

      let currentAngle = startAngle;
      let cx = 0;
      let cy = 0;

      for (let j = 1; j <= segments; j++) {
        // AMPLIFIED: More zigzag using amplifiedCrackWobble
        const zigzag = Math.sin(j * 2.5 + i * 1.3) * amplifiedCrackWobble * 0.6;
        currentAngle = startAngle + zigzag;
        cx += Math.cos(currentAngle) * segmentLength;
        cy += Math.sin(currentAngle) * segmentLength;
        points.push({ x: cx, y: cy });
      }

      const crackShape = new THREE.Shape();
      for (let j = 0; j < points.length; j++) {
        const p = points[j];
        const progress = j / (points.length - 1);
        const width = baseWidth * (1 - progress * 0.7);
        const nextP = points[Math.min(j + 1, points.length - 1)];
        const dx = nextP.x - p.x;
        const dy = nextP.y - p.y;
        const perpAngle = Math.atan2(dy, dx) + Math.PI / 2;
        const offsetX = Math.cos(perpAngle) * width;
        const offsetY = Math.sin(perpAngle) * width;
        if (j === 0) crackShape.moveTo(p.x + offsetX, p.y + offsetY);
        else crackShape.lineTo(p.x + offsetX, p.y + offsetY);
      }
      for (let j = points.length - 1; j >= 0; j--) {
        const p = points[j];
        const progress = j / (points.length - 1);
        const width = baseWidth * (1 - progress * 0.7);
        const nextP = points[Math.min(j + 1, points.length - 1)];
        const dx = nextP.x - p.x;
        const dy = nextP.y - p.y;
        const perpAngle = Math.atan2(dy, dx) - Math.PI / 2;
        const offsetX = Math.cos(perpAngle) * width;
        const offsetY = Math.sin(perpAngle) * width;
        crackShape.lineTo(p.x + offsetX, p.y + offsetY);
      }
      crackShape.closePath();
      crackList.push({ geometry: new THREE.ShapeGeometry(crackShape), colorIndex: i % 3 });
    }
    return crackList;
  }, [dna.size, dna.crackCount, amplifiedCrackWobble]);

  // Crack colors also get barren treatment (desaturate + earth blend)
  const getCrackColor = (colorIndex: number): string => {
    let baseColor: string;
    if (colorIndex === 0) baseColor = dna.crack1Color;
    else if (colorIndex === 1) baseColor = dna.crack2Color || dna.crack1Color;
    else baseColor = dna.crack3Color || dna.crack1Color;
    const desaturated = adjustColorSaturation(baseColor, barrenSaturation);
    return blendTowardEarth(desaturated, earthBlend * 0.5); // Less earth blend on cracks so they're still visible
  };

  // Position decay below ground plane as requested (y = -0.05)
  const baseY = -0.05;
  const layer3Height = 0.001;
  const layer2Height = 0.015;
  const layer1Height = 0.028;
  const crackHeight = 0.035;

  return (
    <group position={position}>
      {/* Decay layers positioned below ground */}
      <group position={[0, baseY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* Layer 3 - Outermost/Bottom */}
        <mesh position={[0, 0, layer3Height]} geometry={layer3Geometry} receiveShadow>
          <meshToonMaterial color={adjustedLayer3Color} gradientMap={gradientMap} />
        </mesh>
        {/* Layer 2 - Middle */}
        <mesh position={[0, 0, layer2Height]} geometry={layer2Geometry} receiveShadow>
          <meshToonMaterial color={adjustedLayer2Color} gradientMap={gradientMap} />
        </mesh>
        {/* Layer 1 - Innermost/Top */}
        <mesh position={[0, 0, layer1Height]} geometry={layer1Geometry} receiveShadow>
          <meshToonMaterial color={adjustedLayer1Color} gradientMap={gradientMap} />
        </mesh>
        {/* Cracks - with castShadow for subtle grooves */}
        {cracks.map((crack, idx) => (
          <mesh key={`crack-${idx}`} position={[0, 0, crackHeight]} geometry={crack.geometry} castShadow receiveShadow>
            <meshToonMaterial color={getCrackColor(crack.colorIndex)} gradientMap={gradientMap} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// =============================================================================
// CLEAN TOON SPROUT - Toon shading WITH bud stripes (data encoding restored)
// =============================================================================

const CleanToonSprout3D: React.FC<{
  dna: SproutDNA;
  position: [number, number, number];
  saturation?: number;
}> = ({ dna, position, saturation = 1 }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const budRef = useRef<THREE.Group>(null!);
  const gradientMap = useMemo(() => getToonGradient(), []);

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

  const stemTop = useMemo(() => stemCurve.getPointAt(1), [stemCurve]);
  const stemRadius = 0.026 * dna.stemThickness;
  const budRadius = 0.154 * dna.budSize;
  const budHeight = 0.231 * dna.budSize;
  const stemBottomLocalY = -0.9 * dna.stemHeight;
  const groupY = 0 - (stemBottomLocalY * dna.scale);

  const cotyledons = useMemo(() => {
    const t = 0.45;
    const point = stemCurve.getPointAt(t);
    const scale = dna.cotyledonSize * 1.54;
    return [
      { position: new THREE.Vector3(point.x + 0.051, point.y, point.z), rotation: new THREE.Euler(0, 0, -0.4), color: dna.cotyledon1Color, scale },
      { position: new THREE.Vector3(point.x - 0.051, point.y, point.z), rotation: new THREE.Euler(0, 0, 0.4), color: dna.cotyledon2Color, scale },
    ];
  }, [stemCurve, dna.cotyledon1Color, dna.cotyledon2Color, dna.cotyledonSize]);

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

  // RESTORED: Stripe geometry points
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

  // Gentle sway animation
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime() * dna.swaySpeed * 0.5;
    groupRef.current.rotation.z = Math.sin(t * 0.7) * dna.swayAmount * 0.1;
    if (budRef.current) {
      budRef.current.rotation.z = Math.sin(t * 1.1) * dna.swayAmount * 0.025;
    }
  });

  return (
    <group position={position}>
      <group ref={groupRef} scale={[dna.scale, dna.scale, dna.scale]} position={[0, groupY, 0]}>
        {/* Stem */}
        <mesh castShadow>
          <tubeGeometry args={[stemCurve, 32, stemRadius, 12, false]} />
          <meshToonMaterial color={adjustedStemColor} gradientMap={gradientMap} />
        </mesh>

        {/* Cotyledons */}
        {cotyledons.map((cot, i) => (
          <mesh
            key={i}
            position={cot.position}
            rotation={cot.rotation}
            scale={[1.2 * cot.scale, 0.4 * cot.scale, 0.8 * cot.scale]}
            castShadow
          >
            <sphereGeometry args={[0.077, 24, 16]} />
            <meshToonMaterial color={adjustColorSaturation(cot.color, saturation)} gradientMap={gradientMap} />
          </mesh>
        ))}

        {/* Bud with RESTORED stripes */}
        <group ref={budRef} position={stemTop}>
          {/* Main bud body */}
          <mesh castShadow>
            <latheGeometry args={[budShapePoints, 32]} />
            <meshToonMaterial color={adjustedBudColor} gradientMap={gradientMap} />
          </mesh>

          {/* RESTORED: Stripe 1 - Secondary Emotion */}
          <mesh rotation={[0, 0, 0]}>
            <latheGeometry args={[stripe2Points, 32, 0, Math.PI * 0.1]} />
            <meshToonMaterial color={adjustedBudStripe2Color} gradientMap={gradientMap} />
          </mesh>
          <mesh rotation={[0, Math.PI, 0]}>
            <latheGeometry args={[stripe2Points, 32, 0, Math.PI * 0.1]} />
            <meshToonMaterial color={adjustedBudStripe2Color} gradientMap={gradientMap} />
          </mesh>

          {/* RESTORED: Stripe 2 - Tertiary Emotion */}
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <latheGeometry args={[stripe3Points, 32, 0, Math.PI * 0.08]} />
            <meshToonMaterial color={adjustedBudStripe3Color} gradientMap={gradientMap} />
          </mesh>
          <mesh rotation={[0, -Math.PI / 2, 0]}>
            <latheGeometry args={[stripe3Points, 32, 0, Math.PI * 0.08]} />
            <meshToonMaterial color={adjustedBudStripe3Color} gradientMap={gradientMap} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

// =============================================================================
// SUN POSITION & INTENSITY CALCULATIONS (from spec)
// =============================================================================

function getSunPosition(hour: number): [number, number, number] {
  // hour is 0-24
  // Sun rises in east (+x), arcs overhead (+y), sets in west (-x)
  const dayProgress = (hour - 6) / 12; // 0 at 6am, 1 at 6pm
  const angle = dayProgress * Math.PI; // 0 to PI

  const x = Math.cos(angle) * 100;
  const y = Math.sin(angle) * 100;
  const z = 50;

  // Clamp y to handle night (sun below horizon)
  return [x, Math.max(y, -20), z];
}

function getSunIntensityAndColor(hour: number): { intensity: number; color: string } {
  // Based on spec table
  if (hour >= 6 && hour < 8) {
    return { intensity: Math.PI * 0.8, color: '#fff5e0' }; // Warm morning
  } else if (hour >= 8 && hour < 17) {
    return { intensity: Math.PI * 1.5, color: '#ffffff' }; // Bright day
  } else if (hour >= 17 && hour < 19) {
    return { intensity: Math.PI * 1.2, color: '#ffcc88' }; // Warm evening
  } else if (hour >= 19 && hour < 20) {
    return { intensity: Math.PI * 0.5, color: '#ff9955' }; // Orange dusk
  } else {
    return { intensity: Math.PI * 0.1, color: '#aabbff' }; // Blue moonlight
  }
}

// =============================================================================
// POST-PROCESSING VALUES (from spec)
// =============================================================================

function getPostProcessingValues(gardenLevel: number) {
  return {
    hue: gardenLevel * 0.15, // 0 to 0.15 radians toward orange
    saturation: -0.2 + gardenLevel * 0.4, // -0.2 to +0.2
    brightness: -0.05 + gardenLevel * 0.1, // -0.05 to +0.05
    contrast: gardenLevel * 0.1, // 0 to 0.1
  };
}

// =============================================================================
// FLOWER EMISSIVE (from spec) - Phase 3
// Note: This would require updating Flower3D to accept external emissiveIntensity
// For now, flowers use their built-in DNA glowIntensity
// =============================================================================

// Phase 3: Flower emissive function (for future use when Flower3D is updated)
// function getFlowerEmissive(gardenLevel: number, hour: number): number {
//   const isNight = hour < 6 || hour > 20;
//   const isDusk = hour > 18 && hour <= 20;
//   if (isNight) return gardenLevel * 0.4;
//   if (isDusk) return gardenLevel * 0.15;
//   return gardenLevel * 0.05;
// }

// =============================================================================
// CONTROL PANEL STATE
// =============================================================================

interface PlaygroundConfig {
  // Time
  hour: number;

  // Garden level (0 = positive/cool/muted, 1 = negative/warm/vivid)
  gardenLevel: number;

  // Feature toggles
  shadowsEnabled: boolean;
  postProcessingEnabled: boolean;
  saturationEnabled: boolean; // Controls warm sepia tint
  brightnessContrastEnabled: boolean;
  bloomEnabled: boolean;
  flowerEmissiveEnabled: boolean;
  showLightHelper: boolean;
  renderMode: RenderMode; // normal / toon / clean / clean-toon
  barrenPatchMode: boolean; // Experimental decay rendering
}

const DEFAULT_CONFIG: PlaygroundConfig = {
  hour: 12,
  gardenLevel: 0.5,
  shadowsEnabled: true,
  postProcessingEnabled: false, // OFF by default per spec
  saturationEnabled: true, // Controls warm sepia tint
  brightnessContrastEnabled: true,
  bloomEnabled: false, // OFF by default per spec
  flowerEmissiveEnabled: false, // OFF by default per spec
  showLightHelper: true, // ON for debugging shadows
  renderMode: 'normal', // normal / toon / clean / clean-toon
  barrenPatchMode: false, // Experimental decay rendering - OFF by default
};

// Presets from spec
const PRESETS: Record<string, Partial<PlaygroundConfig>> = {
  'Negative Noon': { hour: 12, gardenLevel: 1.0 },
  'Positive Noon': { hour: 12, gardenLevel: 0.0 },
  'Negative Night': { hour: 22, gardenLevel: 1.0 },
  'Positive Night': { hour: 22, gardenLevel: 0.0 },
  'Sunrise Anxious': { hour: 7, gardenLevel: 0.8 },
  'Dusk Content': { hour: 19, gardenLevel: 0.2 },
};

// =============================================================================
// GROUND PLANE (with shadows)
// =============================================================================

function Ground() {
  const { gardenRadius } = getLayoutConfig();
  const groundRadius = gardenRadius * 1.3;
  const groundThickness = 3; // Thick ground slab

  return (
    <mesh position={[0, -groundThickness / 2, 0]} receiveShadow>
      <cylinderGeometry args={[groundRadius, groundRadius, groundThickness, 64]} />
      <meshStandardMaterial color="#3d2817" roughness={0.9} />
    </mesh>
  );
}

// =============================================================================
// SUN LIGHT WITH HELPER (for shadow debugging)
// =============================================================================

function SunLightHelper({ lightRef }: { lightRef: React.RefObject<THREE.DirectionalLight> }) {
  useHelper(lightRef as React.RefObject<THREE.Object3D>, THREE.DirectionalLightHelper, 5);
  return null;
}

function SunLight({
  sunPosition,
  intensity,
  color,
  shadowsEnabled,
  showHelper,
}: {
  sunPosition: [number, number, number];
  intensity: number;
  color: string;
  shadowsEnabled: boolean;
  showHelper: boolean;
}) {
  const lightRef = useRef<THREE.DirectionalLight>(null!);

  return (
    <>
      <directionalLight
        ref={lightRef}
        position={sunPosition}
        intensity={intensity}
        color={color}
        castShadow={shadowsEnabled}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={200}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0001}
      />
      {showHelper && <SunLightHelper lightRef={lightRef} />}
    </>
  );
}

// =============================================================================
// SCENE BACKGROUND COLOR (matches time of day)
// =============================================================================

function SceneBackground({ hour }: { hour: number }) {
  const { scene } = useThree();

  useLayoutEffect(() => {
    // Interpolate background color based on time
    let bgColor: string;
    if (hour >= 6 && hour < 8) {
      bgColor = '#2a2035'; // Dawn purple
    } else if (hour >= 8 && hour < 17) {
      bgColor = '#1a1a2e'; // Day blue-dark
    } else if (hour >= 17 && hour < 20) {
      bgColor = '#2d1f2f'; // Dusk purple-red
    } else {
      bgColor = '#0a0a15'; // Night dark
    }
    scene.background = new THREE.Color(bgColor);
  }, [scene, hour]);

  return null;
}

// =============================================================================
// PLANT COMPONENT - Switches between normal and toon versions
// =============================================================================

function Plant({
  plantDNA,
  position,
  renderMode,
  barrenPatchMode,
}: {
  plantDNA: PlantDNA;
  position: [number, number, number];
  renderMode: RenderMode;
  barrenPatchMode: boolean;
}) {
  // For decays, check if barren patch mode is enabled (works with any render mode)
  if (plantDNA.type === 'decay' && barrenPatchMode) {
    return <BarrenDecay3D dna={plantDNA.dna as DecayDNA} position={position} saturation={1} />;
  }

  if (renderMode === 'toon') {
    // Toon/cel-shaded versions (no wobble, no emissive, no sparkles, no data encoding on decay/sprout)
    switch (plantDNA.type) {
      case 'flower':
        return <ToonFlower3D dna={plantDNA.dna as FlowerDNA} position={position} saturation={1} />;
      case 'sprout':
        return <ToonSprout3D dna={plantDNA.dna as SproutDNA} position={position} saturation={1} />;
      case 'decay':
        return <ToonDecay3D dna={plantDNA.dna as DecayDNA} position={position} saturation={1} />;
    }
  } else if (renderMode === 'clean') {
    // Clean versions - simplified materials, no effects, but WITH full data encoding
    switch (plantDNA.type) {
      case 'flower':
        return <CleanFlower3D dna={plantDNA.dna} position={position} opacity={1} saturation={1} />;
      case 'sprout':
        return <CleanSprout3D dna={plantDNA.dna} position={position} opacity={1} saturation={1} />;
      case 'decay':
        return <CleanDecay3D dna={plantDNA.dna} position={position} opacity={1} saturation={1} />;
    }
  } else if (renderMode === 'clean-toon') {
    // Clean Toon - toon shading WITH full data encoding (stripes on sprouts, cracks on decays)
    switch (plantDNA.type) {
      case 'flower':
        return <ToonFlower3D dna={plantDNA.dna as FlowerDNA} position={position} saturation={1} />;
      case 'sprout':
        return <CleanToonSprout3D dna={plantDNA.dna as SproutDNA} position={position} saturation={1} />;
      case 'decay':
        return <CleanToonDecay3D dna={plantDNA.dna as DecayDNA} position={position} saturation={1} />;
    }
  } else {
    // Normal versions with wobble, emissive, sparkles
    switch (plantDNA.type) {
      case 'flower':
        return <Flower3D dna={plantDNA.dna} position={position} opacity={1} saturation={1} />;
      case 'sprout':
        return <Sprout3D dna={plantDNA.dna} position={position} opacity={1} saturation={1} />;
      case 'decay':
        return <Decay3D dna={plantDNA.dna} position={position} opacity={1} saturation={1} />;
    }
  }
}

// =============================================================================
// MAIN PLAYGROUND COMPONENT
// =============================================================================

export default function AtmospherePlayground() {
  const [config, setConfig] = useState<PlaygroundConfig>(DEFAULT_CONFIG);
  const [panelOpen, setPanelOpen] = useState(true);

  // Data loading
  const [allEntries, setAllEntries] = useState<MoodEntryWithPercentile[]>([]);
  const [positions, setPositions] = useState<Map<string, [number, number, number]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load CSV data
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/mood-data.csv');
        if (!response.ok) {
          throw new Error(`Failed to load CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
        const parsedEntries = parseCSVWithPercentiles(csvText);
        const sortedEntries = [...parsedEntries].sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );

        const calculatedPositions = calculatePositions(sortedEntries);

        setAllEntries(sortedEntries);
        setPositions(calculatedPositions);
        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Convert entries to DNA
  const plants = useMemo(() => {
    return allEntries.map(entryToDNA);
  }, [allEntries]);

  // Calculate sun position and lighting
  const sunPosition = useMemo(() => getSunPosition(config.hour), [config.hour]);
  const { intensity: sunIntensity, color: sunColor } = useMemo(
    () => getSunIntensityAndColor(config.hour),
    [config.hour]
  );

  // Calculate post-processing values
  const ppValues = useMemo(() => {
    const values = getPostProcessingValues(config.gardenLevel);
    // Debug logging
    if (config.postProcessingEnabled) {
      console.log('Post-processing values:', {
        gardenLevel: config.gardenLevel,
        hue: values.hue.toFixed(4),
        saturation: values.saturation.toFixed(4),
        brightness: values.brightness.toFixed(4),
        contrast: values.contrast.toFixed(4),
      });
    }
    return values;
  }, [config.gardenLevel, config.postProcessingEnabled]);

  // Note: Flower emissive (Phase 3) would require Flower3D component updates
  // For now, flowers use their built-in DNA glowIntensity

  // Config update helper
  const updateConfig = (updates: Partial<PlaygroundConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  // Apply preset
  const applyPreset = (presetName: string) => {
    const preset = PRESETS[presetName];
    if (preset) {
      updateConfig(preset);
    }
  };

  if (loading) {
    return <div className="atmosphere-playground"><div className="loading">Loading mood data...</div></div>;
  }

  if (error) {
    return <div className="atmosphere-playground"><div className="error">Error: {error}</div></div>;
  }

  return (
    <div className="atmosphere-playground">
      {/* Control Panel */}
      <div className={`atmosphere-panel ${panelOpen ? 'open' : 'collapsed'}`}>
        <div className="panel-header" onClick={() => setPanelOpen(!panelOpen)}>
          <h2>Atmosphere Controls</h2>
          <span className="toggle">{panelOpen ? '−' : '+'}</span>
        </div>

        {panelOpen && (
          <div className="panel-content">
            {/* Status Section */}
            <div className="status-section">
              <div className="status-row">
                <span>Time:</span>
                <span>{config.hour.toFixed(1)}:00</span>
              </div>
              <div className="status-row">
                <span>Garden Level:</span>
                <span className={config.gardenLevel < 0.5 ? 'lush' : 'barren'}>
                  {config.gardenLevel.toFixed(2)}
                </span>
              </div>
              <div className="status-row">
                <span>Plants:</span>
                <span>{plants.length}</span>
              </div>
              {config.postProcessingEnabled && (
                <>
                  <div className="status-row" style={{ marginTop: '8px', borderTop: '1px solid #333', paddingTop: '8px' }}>
                    <span>Sepia:</span>
                    <span>{(config.gardenLevel * 0.3).toFixed(3)}</span>
                  </div>
                  <div className="status-row">
                    <span>Brightness:</span>
                    <span>{ppValues.brightness.toFixed(3)}</span>
                  </div>
                  <div className="status-row">
                    <span>Contrast:</span>
                    <span>{ppValues.contrast.toFixed(3)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Time Controls */}
            <div className="control-section">
              <h3>Time</h3>
              <label>
                <span>Hour</span>
                <input
                  type="range"
                  min="0"
                  max="24"
                  step="0.5"
                  value={config.hour}
                  onChange={(e) => updateConfig({ hour: parseFloat(e.target.value) })}
                />
                <span>{config.hour.toFixed(1)}</span>
              </label>
            </div>

            {/* Emotion Controls */}
            <div className="control-section">
              <h3>Garden Level</h3>
              <label>
                <span>Level</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={config.gardenLevel}
                  onChange={(e) => updateConfig({ gardenLevel: parseFloat(e.target.value) })}
                />
                <span>{config.gardenLevel.toFixed(2)}</span>
              </label>
              <p style={{ fontSize: '11px', color: '#666', margin: '4px 0 0 0' }}>
                0 = positive (cool/muted) → 1 = negative (warm/vivid)
              </p>
            </div>

            {/* Feature Toggles */}
            <div className="control-section">
              <h3>Features</h3>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.shadowsEnabled}
                  onChange={(e) => updateConfig({ shadowsEnabled: e.target.checked })}
                />
                <span>Shadows</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.postProcessingEnabled}
                  onChange={(e) => updateConfig({ postProcessingEnabled: e.target.checked })}
                />
                <span>Post-Processing (Color Grade)</span>
              </label>
              {config.postProcessingEnabled && (
                <div style={{ marginLeft: '24px', marginBottom: '8px' }}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.saturationEnabled}
                      onChange={(e) => updateConfig({ saturationEnabled: e.target.checked })}
                    />
                    <span style={{ fontSize: '11px' }}>Warm Tint (Sepia)</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.brightnessContrastEnabled}
                      onChange={(e) => updateConfig({ brightnessContrastEnabled: e.target.checked })}
                    />
                    <span style={{ fontSize: '11px' }}>Brightness/Contrast</span>
                  </label>
                </div>
              )}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.bloomEnabled}
                  onChange={(e) => updateConfig({ bloomEnabled: e.target.checked })}
                />
                <span>Bloom</span>
              </label>
              <label className="checkbox-label" style={{ opacity: 0.5 }}>
                <input
                  type="checkbox"
                  checked={config.flowerEmissiveEnabled}
                  onChange={(e) => updateConfig({ flowerEmissiveEnabled: e.target.checked })}
                  disabled
                />
                <span>Flower Emissive (Phase 3 - TBD)</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.showLightHelper}
                  onChange={(e) => updateConfig({ showLightHelper: e.target.checked })}
                />
                <span>Show Light Helper (Debug)</span>
              </label>
              {/* Render Mode Selector */}
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Render Mode:</span>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <button
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: config.renderMode === 'normal' ? '#4a9eff' : '#333',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                    onClick={() => updateConfig({ renderMode: 'normal' })}
                  >
                    Normal
                  </button>
                  <button
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: config.renderMode === 'toon' ? '#4a9eff' : '#333',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                    onClick={() => updateConfig({ renderMode: 'toon' })}
                  >
                    Toon
                  </button>
                  <button
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: config.renderMode === 'clean' ? '#4a9eff' : '#333',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                    onClick={() => updateConfig({ renderMode: 'clean' })}
                  >
                    Clean
                  </button>
                  <button
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: config.renderMode === 'clean-toon' ? '#4a9eff' : '#333',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                    onClick={() => updateConfig({ renderMode: 'clean-toon' })}
                  >
                    Clean Toon
                  </button>
                </div>
                <p style={{ fontSize: '10px', color: '#666', margin: '4px 0 0 0' }}>
                  Normal: all effects | Toon: cel-shaded | Clean: simplified | Clean Toon: toon + data
                </p>
              </div>
              {/* Barren Patch Mode Toggle */}
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #333' }}>
                <label className="checkbox-label" style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={config.barrenPatchMode}
                    onChange={(e) => updateConfig({ barrenPatchMode: e.target.checked })}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <span style={{ color: '#ff9955' }}>Barren Patch Mode (Experimental)</span>
                    <p style={{ fontSize: '10px', color: '#666', margin: '4px 0 0 0' }}>
                      Decays as depleted earth: desaturated colors, irregular edges, recessed into ground
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Presets */}
            <div className="control-section">
              <h3>Presets</h3>
              <div className="preset-buttons">
                {Object.keys(PRESETS).map((name) => (
                  <button key={name} onClick={() => applyPreset(name)}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3D Canvas */}
      <Canvas
        shadows={config.shadowsEnabled}
        camera={{ position: [0, 30, 40], fov: 60 }}
      >
        {/* Background color controller */}
        <SceneBackground hour={config.hour} />

        {/* Sky dome */}
        <Sky
          sunPosition={sunPosition}
          turbidity={8}
          rayleigh={0.5}
          mieCoefficient={0.005}
          mieDirectionalG={0.7}
        />

        {/* Ambient fill light */}
        <hemisphereLight args={['#87CEEB', '#362312', 0.6]} />

        {/* Sun light with shadows */}
        <SunLight
          sunPosition={sunPosition}
          intensity={sunIntensity}
          color={sunColor}
          shadowsEnabled={config.shadowsEnabled}
          showHelper={config.showLightHelper}
        />

        {/* Ground plane */}
        <Ground />

        {/* Plants */}
        {plants.map((plantDNA, index) => {
          const entry = allEntries[index];
          const pos = positions.get(entry.id) ?? [0, 0, 0];
          return (
            <Plant
              key={entry.id}
              plantDNA={plantDNA}
              position={pos}
              renderMode={config.renderMode}
              barrenPatchMode={config.barrenPatchMode}
            />
          );
        })}

        {/* Post-processing effects */}
        {/*
          NOTE: HueSaturation effect is broken with emissive/MeshWobbleMaterial - causes black patches.
          Using Sepia with low intensity as a warm tint alternative (higher gardenLevel = warmer/more sepia).
          EffectComposer doesn't allow conditional children, so we use separate composers for each combination.
        */}

        {/* PP + Sepia + BC (no bloom) */}
        {config.postProcessingEnabled && !config.bloomEnabled && config.saturationEnabled && (
          <EffectComposer multisampling={0}>
            <Sepia intensity={config.gardenLevel * 0.3} blendFunction={BlendFunction.NORMAL} />
            <BrightnessContrast
              brightness={config.brightnessContrastEnabled ? ppValues.brightness : 0}
              contrast={config.brightnessContrastEnabled ? ppValues.contrast : 0}
            />
          </EffectComposer>
        )}

        {/* PP + BC only (no sepia, no bloom) */}
        {config.postProcessingEnabled && !config.bloomEnabled && !config.saturationEnabled && (
          <EffectComposer multisampling={0}>
            <BrightnessContrast
              brightness={config.brightnessContrastEnabled ? ppValues.brightness : 0}
              contrast={config.brightnessContrastEnabled ? ppValues.contrast : 0}
            />
          </EffectComposer>
        )}

        {/* Bloom only */}
        {!config.postProcessingEnabled && config.bloomEnabled && (
          <EffectComposer multisampling={0}>
            <Bloom
              intensity={0.5 + config.gardenLevel * 0.5}
              luminanceThreshold={0.8}
              luminanceSmoothing={0.9}
            />
          </EffectComposer>
        )}

        {/* PP + Sepia + BC + Bloom */}
        {config.postProcessingEnabled && config.bloomEnabled && config.saturationEnabled && (
          <EffectComposer multisampling={0}>
            <Sepia intensity={config.gardenLevel * 0.3} blendFunction={BlendFunction.NORMAL} />
            <BrightnessContrast
              brightness={config.brightnessContrastEnabled ? ppValues.brightness : 0}
              contrast={config.brightnessContrastEnabled ? ppValues.contrast : 0}
            />
            <Bloom
              intensity={0.5 + config.gardenLevel * 0.5}
              luminanceThreshold={0.8}
              luminanceSmoothing={0.9}
            />
          </EffectComposer>
        )}

        {/* PP + BC + Bloom (no sepia) */}
        {config.postProcessingEnabled && config.bloomEnabled && !config.saturationEnabled && (
          <EffectComposer multisampling={0}>
            <BrightnessContrast
              brightness={config.brightnessContrastEnabled ? ppValues.brightness : 0}
              contrast={config.brightnessContrastEnabled ? ppValues.contrast : 0}
            />
            <Bloom
              intensity={0.5 + config.gardenLevel * 0.5}
              luminanceThreshold={0.8}
              luminanceSmoothing={0.9}
            />
          </EffectComposer>
        )}

        {/* Camera controls */}
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
