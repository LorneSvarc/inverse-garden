import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FlowerDNA } from '../types';
import { adjustColorSaturation } from '../utils/plantFading';
import { getToonGradient } from '../utils/toonGradient';

// =============================================================================
// EASING FUNCTIONS (from animation brief)
// =============================================================================

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function easeOutBack(t: number, overshoot = 0.5): number {
  return 1 + (overshoot + 1) * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}

function easeOutElastic(t: number, period = 0.3): number {
  if (t === 0 || t === 1) return t;
  // Simplified elastic that doesn't require amplitude parameter
  return Math.pow(2, -10 * t) * Math.sin((t - period / 4) * (2 * Math.PI) / period) + 1;
}

// =============================================================================
// ANIMATION CONFIG
// =============================================================================

const ANIMATION_CONFIG = {
  // Phase timing - now with OVERLAPPING phases
  // Stem:   0% ------------ 50%
  // Leaves:    25% ------------ 70%
  // Bloom:              60% -------- 100%

  stemStart: 0,
  stemEnd: 0.5,

  leafStart: 0.25,   // Starts earlier, while stem is still growing
  leafEnd: 0.70,

  bloomStart: 0.6,   // Starts before leaves finish
  bloomEnd: 1.0,

  // Stem parameters
  stemFinalHeight: 3.0,   // Final stem height
  stemStartBelow: 0.5,    // How far below ground stem tip starts

  // Easing parameters
  elasticPeriod: 0.4,     // Period for elastic easing (higher = less bouncy)
  backOvershoot: 0.5,
};

// =============================================================================
// ANIMATED COMPONENTS
// =============================================================================

interface AnimatedToonFlower3DProps {
  dna: FlowerDNA;
  position?: [number, number, number];
  opacity?: number;
  saturation?: number;
  growthProgress: number; // 0 to 1
}

/**
 * AnimatedToonPetal - Petal with growth animation
 */
const AnimatedToonPetal: React.FC<{
  angle: number;
  row: number;
  dna: FlowerDNA;
  color: string;
  opacity: number;
  saturation: number;
  petalProgress: number; // 0 to 1 for this petal
}> = ({ angle, row, dna, color, opacity, saturation, petalProgress }) => {
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

  // Simple linear scale - no easing, just raw progress
  const scale = petalProgress;

  // Subtle petal animation (only when fully grown)
  useFrame((state) => {
    if (!meshRef.current || petalProgress < 1) return;
    const t = state.clock.getElapsedTime() * dna.wobbleSpeed * 0.5;
    meshRef.current.rotation.x = (Math.PI / 4) + (row * 0.2) + Math.sin(t + angle) * 0.05 * dna.petalCurvature;
  });

  // Don't render until this petal's animation has started
  if (petalProgress <= 0) return null;

  return (
    <group rotation={[0, angle, 0]} position={[0, row * 0.15, 0]} scale={[scale, scale, scale]}>
      <mesh ref={meshRef} geometry={petalShape} castShadow>
        <meshToonMaterial
          color={adjustedColor}
          gradientMap={gradientMap}
          transparent
          opacity={opacity * Math.min(1, petalProgress * 2)}
        />
      </mesh>
    </group>
  );
};

/**
 * AnimatedToonStemLeaf - Leaf with scale-in animation
 */
const AnimatedToonStemLeaf: React.FC<{
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
  color: string;
  opacity: number;
  saturation: number;
  leafProgress: number; // 0 to 1
}> = ({ position, rotation, scale, color, opacity, saturation, leafProgress }) => {
  const gradientMap = useMemo(() => getToonGradient(), []);

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.2, 0.2, 0.2, 0.8, 0, 1);
    s.bezierCurveTo(-0.2, 0.8, -0.2, 0.2, 0, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
  }, []);

  const adjustedColor = useMemo(() => adjustColorSaturation(color, saturation), [color, saturation]);

  // Apply easing with subtle overshoot
  const easedProgress = easeOutBack(leafProgress, ANIMATION_CONFIG.backOvershoot);
  const animatedScale = scale * Math.max(0.01, Math.min(1.1, easedProgress)); // minimum 0.01

  // Render even at very small progress - scale handles visibility
  if (leafProgress < 0) return null;

  return (
    <mesh position={position} rotation={rotation} geometry={shape} scale={[animatedScale, animatedScale, animatedScale]} castShadow>
      <meshToonMaterial
        color={adjustedColor}
        gradientMap={gradientMap}
        side={THREE.DoubleSide}
        transparent
        opacity={opacity * Math.min(1, leafProgress * 2)}
      />
    </mesh>
  );
};

/**
 * GrowingStem - Stem that actually grows from the ground
 * Uses a dynamic curve that extends as progress increases
 */
const GrowingStem: React.FC<{
  stemBend: number;
  stemProgress: number; // 0 to 1
  color: string;
  opacity: number;
  gradientMap: THREE.Texture;
}> = ({ stemBend, stemProgress, color, opacity, gradientMap }) => {
  // The stem grows from below ground up to full height
  // At progress 0: stem tip is at stemStartBelow below ground
  // At progress 1: stem tip is at stemFinalHeight

  const easedProgress = easeOutQuart(stemProgress);

  // Calculate current stem height
  // Start below ground, grow to full height
  const totalGrowth = ANIMATION_CONFIG.stemFinalHeight + ANIMATION_CONFIG.stemStartBelow;
  const currentGrowth = easedProgress * totalGrowth;

  // Stem tip Y position (starts below 0, ends at stemFinalHeight)
  const tipY = currentGrowth - ANIMATION_CONFIG.stemStartBelow;

  // Don't render if stem hasn't breached ground yet
  if (tipY <= 0) return null;

  // Create a curve from ground level (0) to current tip
  // The bend increases proportionally as the stem grows
  const bendAmount = stemBend * 2 * (tipY / ANIMATION_CONFIG.stemFinalHeight);

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bendAmount * 0.5, tipY * 0.5, 0),
    new THREE.Vector3(0, tipY, 0),
  ]);

  return (
    <mesh castShadow>
      <tubeGeometry args={[stemCurve, 20, 0.08, 8, false]} />
      <meshToonMaterial
        color={color}
        gradientMap={gradientMap}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
};

/**
 * AnimatedToonFlower3D - Flower with procedural growth animation
 *
 * Animation phases:
 * - Phase 1 (0-60%): Stem GROWS from below ground, tip emerges and rises
 * - Phase 2 (60-80%): Leaves scale in with staggered timing
 * - Phase 3 (80-100%): Bloom reveals - petals emerge one by one
 */
const AnimatedToonFlower3D: React.FC<AnimatedToonFlower3DProps> = ({
  dna,
  position = [0, 0, 0],
  opacity = 1,
  saturation = 1,
  growthProgress = 0,
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

  // ==========================================================================
  // PHASE CALCULATIONS - Overlapping phases for organic feel
  // ==========================================================================

  // Stem: 0% - 55%
  const STEM_START = 0;
  const STEM_END = 0.55;
  const stemProgress = Math.max(0, Math.min(
    (growthProgress - STEM_START) / (STEM_END - STEM_START),
    1
  ));

  // Leaves: 20% - 55% (shorter window, more overlap with stem)
  const LEAF_START = 0.20;
  const LEAF_END = 0.55;
  const leafPhaseProgress = Math.max(0, Math.min(
    (growthProgress - LEAF_START) / (LEAF_END - LEAF_START),
    1
  ));

  // Bloom: 35% - 100% (starts much earlier, while leaves are still growing)
  const BLOOM_START = 0.35;
  const BLOOM_END = 1.0;
  const bloomPhaseProgress = Math.max(0, Math.min(
    (growthProgress - BLOOM_START) / (BLOOM_END - BLOOM_START),
    1
  ));

  // ==========================================================================
  // CURRENT STEM TIP POSITION (for positioning leaves and bloom)
  // ==========================================================================

  // Use gentler easing for stem - easeOutQuad instead of easeOutQuart
  // This gives more visible growth in the later part of the stem phase
  const easedStemProgress = 1 - Math.pow(1 - stemProgress, 2); // easeOutQuad
  const totalGrowth = ANIMATION_CONFIG.stemFinalHeight + ANIMATION_CONFIG.stemStartBelow;
  const currentGrowth = easedStemProgress * totalGrowth;
  const stemTipY = Math.max(0, currentGrowth - ANIMATION_CONFIG.stemStartBelow);

  // Stem bend at current height
  const currentBend = dna.stemBend * 2 * (stemTipY / ANIMATION_CONFIG.stemFinalHeight);

  // ==========================================================================
  // LEAVES - positioned relative to current stem height
  // ==========================================================================

  // Leaves appear when we're in the leaf phase
  const leavesVisible = leafPhaseProgress > 0;

  // Calculate leaf positions based on FINAL stem curve (not current)
  // This ensures leaves stay in place as stem grows
  const finalBend = dna.stemBend * 2;
  const finalStemCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(finalBend * 0.5, ANIMATION_CONFIG.stemFinalHeight * 0.5, 0),
      new THREE.Vector3(0, ANIMATION_CONFIG.stemFinalHeight, 0),
    ]);
  }, [finalBend]);

  const leaves = useMemo(() => {
    const items: {
      position: THREE.Vector3;
      rotation: THREE.Euler;
      index: number;
      scale: number;
      color: string;
      tPosition: number;
      heightOnStem: number; // Y position for visibility check
    }[] = [];
    if (!dna.leafCount) return items;

    const positions = [0.3, 0.5, 0.7]; // Position along stem

    for (let i = 0; i < dna.leafCount; i++) {
      const t = i < positions.length ? positions[i] : 0.2 + i * 0.2;

      const point = finalStemCurve.getPointAt(t);
      const tangent = finalStemCurve.getTangentAt(t).normalize();

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

      const leafMatrix = new THREE.Matrix4().makeBasis(
        rotationAxis,
        finalDirection,
        new THREE.Vector3().crossVectors(rotationAxis, finalDirection)
      );
      const finalRot = new THREE.Euler().setFromRotationMatrix(leafMatrix);

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
        color: leafColor,
        tPosition: t,
        heightOnStem: point.y,
      });
    }
    return items;
  }, [dna.leafCount, dna.leafSize, dna.leafOrientation, dna.leafAngle, dna.stemColors, finalStemCurve]);

  // ==========================================================================
  // PETALS
  // ==========================================================================

  const petals = useMemo(() => {
    const items = [];
    for (let r = 0; r < dna.petalRows; r++) {
      const count = dna.petalCount - r * 2;
      if (count <= 0) break;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (r * Math.PI) / count;
        items.push({ angle, row: r, index: items.length });
      }
    }
    return items;
  }, [dna.petalCount, dna.petalRows]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  // Don't render if not yet started
  if (growthProgress <= 0) return null;

  // Calculate bloom center progress - simple linear like petals
  const centerScale = bloomPhaseProgress;

  // Bloom position - at the top of the FINAL stem (not current)
  const bloomY = ANIMATION_CONFIG.stemFinalHeight;
  const bloomVisible = bloomPhaseProgress > 0; // Bloom appears when we enter bloom phase

  return (
    <group position={position}>
      <group scale={[dna.scale, dna.scale, dna.scale]} rotation={[0, dna.rotation, 0]}>
        {/* Growing Stem */}
        <GrowingStem
          stemBend={dna.stemBend}
          stemProgress={stemProgress}
          color={adjustedStemColor}
          opacity={opacity}
          gradientMap={gradientMap}
        />

        {/* Leaves on Stem - all grow together */}
        {growthProgress > 0.20 && leaves.map((leaf, i) => (
          <AnimatedToonStemLeaf
            key={i}
            position={leaf.position}
            rotation={leaf.rotation}
            scale={leaf.scale}
            color={leaf.color}
            opacity={opacity}
            saturation={saturation}
            leafProgress={leafPhaseProgress}
          />
        ))}

        {/* Bloom - positioned at top of stem */}
        {growthProgress > 0.35 && (
          <group position={[0, bloomY, 0]}>
            {/* Petals - staggered radial appearance, one by one */}
            {petals.map((p, i) => {
              // Simple stagger: each petal starts at a different time
              // Petal 0 starts at bloomPhaseProgress=0, grows until 0.5
              // Petal 1 starts at bloomPhaseProgress=0.0625 (for 8 petals), grows until 0.5625
              // etc. Each petal takes 0.5 of the bloom phase to fully open
              const petalDelay = (i / petals.length) * 0.5; // stagger over first half
              const petalGrowthDuration = 0.5; // each petal takes half the bloom phase
              const petalProgress = Math.max(0, Math.min(1,
                (bloomPhaseProgress - petalDelay) / petalGrowthDuration
              ));

              return (
                <AnimatedToonPetal
                  key={`${p.index}-${dna.name}`}
                  angle={p.angle}
                  row={p.row}
                  dna={dna}
                  color={dna.petalColors[i % dna.petalColors.length]}
                  opacity={opacity}
                  saturation={saturation}
                  petalProgress={petalProgress}
                />
              );
            })}

            {/* Center / Pistil - appears with the petals */}
            <mesh position={[0, 0.2, 0]} scale={[centerScale, centerScale, centerScale]} castShadow>
              <sphereGeometry args={[0.4 * (dna.petalWidth / 2), 32, 32]} />
              <meshToonMaterial
                color={adjustedCenterColor}
                gradientMap={gradientMap}
                transparent
                opacity={opacity * Math.min(1, bloomPhaseProgress * 1.5)}
              />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
};

export default AnimatedToonFlower3D;
