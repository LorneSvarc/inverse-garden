import React, { useMemo } from 'react';
import * as THREE from 'three';
import { getToonGradient } from '../utils/toonGradient';
import { adjustColorSaturation } from '../utils/plantFading';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface FallenBloom3DProps {
  seed: number;            // Mild jitter for variety between instances
  petalLength: number;     // 0.2-0.5
  petalWidth: number;      // 0.1-0.25
  stemLength: number;      // 0.2-0.6
  scale: number;           // 0.4-1.8
  leafSize?: number;       // 0.3-1.0, uniform scale on half-leaf meshes

  // Color encoding (matches flower system)
  //   petals = petalColors.length (1-3, one per emotion)
  //   half-leaves derived from stemColors.length:
  //     1 assoc → 0 leaves (stem only)
  //     2 assoc → 1 half-leaf attached to stem end (A1)
  //     3 assoc → 1 attached half-leaf (A1) + 2 detached half-leaves (A2, A3)
  petalColors: string[];   // Emotion colors: [E0] or [E0,E1] or [E0,E1,E2]
  stemColors: string[];    // Association colors: [A0] or [A0,A1] or [A0,A1,A2]

  opacity?: number;
  saturation?: number;
}

// ─── Seeded Random (mild jitter only) ───────────────────────────────────────

function createSeededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

// ─── Leaf Color Logic (matches CleanToonFlower3D:172-178) ───────────────────

function getLeafColor(stemColors: string[], leafIndex: number): string {
  // leafIndex 0 = A1 (secondary), 1 = A2 (tertiary)
  if (stemColors.length <= 1) return stemColors[0];
  if (stemColors.length === 2) return stemColors[1];
  return stemColors[Math.min(leafIndex + 1, stemColors.length - 1)];
}

// ─── Component ──────────────────────────────────────────────────────────────

const FallenBloom3D: React.FC<FallenBloom3DProps> = ({
  seed,
  petalLength,
  petalWidth,
  stemLength,
  scale,
  leafSize = 0.5,
  petalColors,
  stemColors,
  opacity = 1,
  saturation = 1,
}) => {
  const gradientMap = useMemo(() => getToonGradient(), []);
  const random = useMemo(() => createSeededRandom(seed + 1), [seed]);

  // Piece counts driven by data
  const petalCount = petalColors.length;
  const stemColorCount = stemColors.length;

  // ── Petal geometry ──
  const petalGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const w = petalWidth / 2;
    const l = petalLength;
    shape.moveTo(0, 0);
    shape.bezierCurveTo(w, l * 0.3, w, l * 0.8, 0, l);
    shape.bezierCurveTo(-w, l * 0.8, -w, l * 0.3, 0, 0);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.015,
      bevelEnabled: false,
    });
  }, [petalWidth, petalLength]);

  // ── Half-leaf geometry: small half of a leaf cut along the midrib ──
  // Living flower leaf is 0→1 height, ±0.2 width. This half-leaf is ~0.2 height
  // with one straight edge (midrib cut) and one curved edge. Much smaller than petals.
  const halfLeafGeometry = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    // Straight edge along the midrib (the cut line)
    s.lineTo(0, 0.2);
    // Rounded tip curving outward
    s.bezierCurveTo(0.01, 0.22, 0.06, 0.21, 0.08, 0.17);
    // Curved natural leaf edge back to base
    s.bezierCurveTo(0.1, 0.12, 0.09, 0.05, 0, 0);
    return new THREE.ExtrudeGeometry(s, {
      depth: 0.01,
      bevelEnabled: false,
    });
  }, []);

  // ── Stem geometry: half-cylinder lying flat on ground ──
  // Semicircle cross-section (flat side down) extruded along a curved path
  const stemRandom = useMemo(() => createSeededRandom(seed + 100), [seed]);
  const stemCurvature = useMemo(() => {
    const r = stemRandom;
    return 0.1 + r() * 0.3;
  }, [stemRandom]);

  const stemGeometry = useMemo(() => {
    // Semicircle cross-section: flat edge at y=0, curved part going up
    const radius = 0.055;
    const halfCircle = new THREE.Shape();
    halfCircle.moveTo(-radius, 0);
    halfCircle.absarc(0, 0, radius, Math.PI, 0, false); // top half of circle
    halfCircle.lineTo(-radius, 0); // close flat bottom

    // Extrude path: gentle curve along ground in XZ plane
    const extrudePath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(stemLength * 0.4, 0, stemCurvature * stemLength * 0.3),
      new THREE.Vector3(stemLength * 0.8, 0, stemCurvature * stemLength * 0.1),
      new THREE.Vector3(stemLength, 0, 0),
    ]);

    return new THREE.ExtrudeGeometry(halfCircle, {
      steps: 20,
      bevelEnabled: false,
      extrudePath,
    });
  }, [stemLength, stemCurvature]);

  // ── Layout computation ──
  const layout = useMemo(() => {
    const rng = createSeededRandom(seed + 1);
    const jitter = () => (rng() - 0.5) * 0.04;
    const jitterAngle = () => (rng() - 0.5) * 0.2;

    // Base angle for whole arrangement
    const baseAngle = rng() * Math.PI * 2;

    // Petal pile: stacked like cards in a messy pile, primary on top
    // Each lower petal is rotated slightly more AND offset so it peeks out from one side
    // Not centered/symmetric — all fan in the same direction
    const fanStep = 0.18; // ~10° per petal — very tight
    const petalBaseAngle = baseAngle + jitterAngle();

    const petalLayouts = [];
    for (let i = 0; i < petalCount; i++) {
      // Each successive petal fans a bit further in the same direction
      const fanAngle = i * fanStep;
      // Offset each lower petal slightly so it peeks out from under the one above
      // Offset is along the petal's own rotated direction
      const offsetDist = i * 0.04; // small shift per layer
      const totalAngle = petalBaseAngle + fanAngle;
      petalLayouts.push({
        x: Math.cos(totalAngle) * offsetDist + jitter() * 0.1,
        z: Math.sin(totalAngle) * offsetDist + jitter() * 0.1,
        // Primary (i=0) on top
        y: 0.005 + (petalCount - 1 - i) * 0.005,
        angle: totalAngle + jitterAngle() * 0.1,
        colorIndex: i,
      });
    }

    // Stem: offset from petals
    const stemDir = baseAngle + Math.PI * 0.6 + jitterAngle();
    const stemDist = 0.25 + rng() * 0.1;
    const stemWorldX = Math.cos(stemDir) * stemDist + jitter();
    const stemWorldZ = Math.sin(stemDir) * stemDist + jitter();
    const stemAngle = stemDir + jitterAngle();

    // Attached half-leaf: in stem local space, halfway along, beside the stem
    // Lies on the ground (y≈0), offset to the side of the half-cylinder stem
    const attachedLeafLocal = stemColorCount >= 2 ? {
      x: stemLength * 0.5,
      y: 0.005,              // just above ground, lying flat
      z: 0.15,               // well clear of stem so visible at all leaf sizes
      angle: 0.6 + jitterAngle() * 0.3,
    } : null;

    // Detached half-leaf (3 assoc only): other side of stem, away from petals
    const detachedLeafLocal = stemColorCount >= 3 ? {
      x: stemLength * 0.45,
      y: 0.002,
      z: 0.20,               // opposite side of stem, close enough to keep footprint tight
      angle: -0.7 + jitterAngle(),
    } : null;

    return { petalLayouts, stemWorldX, stemWorldZ, stemAngle, attachedLeafLocal, detachedLeafLocal };
  }, [seed, petalCount, stemColorCount, stemLength]);

  // Adjusted colors
  const adjustedStemColor = useMemo(
    () => adjustColorSaturation(stemColors[0] ?? '#FFD700', saturation),
    [stemColors, saturation]
  );

  return (
    <group scale={[scale, scale, scale]}>
      {/* ── Petals: flat stacked deck of cards ── */}
      {layout.petalLayouts.map((p, i) => {
        const color = petalColors[p.colorIndex] ?? petalColors[0];
        const adjustedColor = adjustColorSaturation(color, saturation);
        return (
          <group
            key={`petal-${i}`}
            position={[p.x, p.y, p.z]}
            rotation={[0, p.angle, 0]}
          >
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              geometry={petalGeometry}
              castShadow
            >
              <meshToonMaterial
                color={adjustedColor}
                gradientMap={gradientMap}
                side={THREE.DoubleSide}
                transparent
                opacity={opacity}
              />
            </mesh>
          </group>
        );
      })}

      {/* ── Stem + attached half-leaf (inside same group so leaf inherits stem transform) ── */}
      <group
        position={[layout.stemWorldX, 0, layout.stemWorldZ]}
        rotation={[0, layout.stemAngle, 0]}
      >
        <mesh geometry={stemGeometry} castShadow>
          <meshToonMaterial
            color={adjustedStemColor}
            gradientMap={gradientMap}
            transparent
            opacity={opacity}
          />
        </mesh>

        {/* Attached half-leaf (A1): in stem local space */}
        {layout.attachedLeafLocal && (
          <group
            position={[layout.attachedLeafLocal.x, layout.attachedLeafLocal.y, layout.attachedLeafLocal.z]}
            rotation={[0, layout.attachedLeafLocal.angle, 0]}
          >
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              scale={[leafSize, leafSize, leafSize]}
              geometry={halfLeafGeometry}
              castShadow
            >
              <meshToonMaterial
                color={adjustColorSaturation(getLeafColor(stemColors, 0), saturation)}
                gradientMap={gradientMap}
                side={THREE.DoubleSide}
                transparent
                opacity={opacity}
              />
            </mesh>
          </group>
        )}

        {/* Detached half-leaf (A2): also in stem local space, opposite side */}
        {layout.detachedLeafLocal && (
          <group
            position={[layout.detachedLeafLocal.x, layout.detachedLeafLocal.y, layout.detachedLeafLocal.z]}
            rotation={[0, layout.detachedLeafLocal.angle, 0]}
          >
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              scale={[leafSize, leafSize, leafSize]}
              geometry={halfLeafGeometry}
              castShadow
            >
              <meshToonMaterial
                color={adjustColorSaturation(getLeafColor(stemColors, 1), saturation)}
                gradientMap={gradientMap}
                side={THREE.DoubleSide}
                transparent
                opacity={opacity}
              />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
};

export default FallenBloom3D;
