import React, { useMemo } from 'react';
import * as THREE from 'three';
import { getDecayToonGradient } from '../utils/toonGradient';
import { adjustColorSaturation } from '../utils/plantFading';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface FallenBloom3DProps {
  seed: number;            // Mild jitter for variety between instances
  petalLength: number;     // 0.2-0.5
  petalWidth: number;      // 0.1-0.25
  stemLength: number;      // 0.2-0.6
  scale: number;           // 0.4-1.8
  leafSize?: number;       // 0.3-1.0, uniform scale on half-leaf meshes
  decayAmount?: number;    // 0-1: master decay progression. Drives curl, fray, gradient, darkening.
  frayAmount?: number;     // 0 = smooth, 1+ = deep notches. Override; if omitted, derived from decayAmount.
  frayDensity?: number;    // 0-1: fraction of edge points that get notched. Default 0.4.
  curlAmount?: number;     // 0 = flat, 1 = fully curled edges. Override; if omitted, derived from decayAmount.

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
  position?: [number, number, number];
  rotation?: number;       // Y-axis rotation in radians (0-2π)
  onClick?: (e: any) => void;
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
  decayAmount = 0,
  frayAmount,
  frayDensity = 0.4,
  curlAmount,
  petalColors,
  stemColors,
  opacity = 1,
  saturation = 1,
  position,
  rotation = 0,
  onClick,
}) => {
  // Derive curl and fray from decayAmount (can be overridden by explicit props)
  const effectiveCurl = curlAmount ?? Math.min(0.30, decayAmount * 0.30);
  const effectiveFray = frayAmount ?? decayAmount * 2.0;

  const gradientMap = useMemo(() => getDecayToonGradient(decayAmount), [decayAmount]);
  const random = useMemo(() => createSeededRandom(seed + 1), [seed]);

  // Piece counts driven by data
  const petalCount = petalColors.length;
  const stemColorCount = stemColors.length;

  // ── Petal geometries (one per petal) ──
  // Built as a parametric grid surface (BufferGeometry) so we have full control
  // over every vertex. This lets curl work reliably: u=0/1 are edges, u=0.5 is center.
  //
  // Grid: vRows (base→tip) × uCols (right edge → left edge)
  // At each (u,v): x,y come from the almond bezier, z comes from curl formula.
  // Edge notches are applied by shrinking the width at boundary vertices.
  const petalGeometries = useMemo(() => {
    const w = petalWidth / 2;
    const l = petalLength;
    const uCols = 12;  // across the petal width (enough for smooth curl)
    const vRows = 16;  // along the petal height

    // Bezier width at a given normalized height (v: 0=base, 1=tip)
    // The almond shape: right bezier x = 3(1-u)²u·w + 3(1-u)u²·w at parameter u
    // But we need width as function of height. Approximation: sin(π·v) peaks at 0.5
    function bezierHalfWidth(v: number): number {
      // More accurate: the cubic bezier x-component peaks around v≈0.4-0.5
      return w * Math.sin(Math.PI * v);
    }

    // Bezier height (y) at normalized v
    // Right bezier: y = 3(1-u)²u·(l·0.3) + 3(1-u)u²·(l·0.8) + u³·l at u=v
    function bezierY(v: number): number {
      const iu = 1 - v;
      return 3 * iu * iu * v * (l * 0.3) + 3 * iu * v * v * (l * 0.8) + v * v * v * l;
    }

    return Array.from({ length: petalCount }, (_, petalIdx) => {
      const petalSeed = seed + petalIdx * 137;
      const rng = createSeededRandom(petalSeed);

      // ── Pre-compute notch slots for edge damage ──
      const decayFrontier = Math.min(0.95, effectiveFray * 0.45);
      const totalSlots = 3 + Math.floor(frayDensity * 5);
      const notchSlots: Array<{
        vCenter: number;    // normalized height position (0-1)
        vHalfWidth: number; // how wide in v-space
        depthFrac: number;  // fraction of local width to cut
        isVCut: boolean;
      }> = [];

      for (let n = 0; n < totalSlots; n++) {
        const vCenter = Math.sqrt(rng()); // biased toward tip (v=1)
        if (vCenter > decayFrontier * 1.1) { rng(); rng(); continue; } // outside frontier, skip
        const vHalfWidth = 0.05 + rng() * 0.08;
        const depthFrac = (0.15 + rng() * 0.2) * effectiveFray;
        const isVCut = rng() < 0.6;

        // Fade near frontier
        const frontierFade = vCenter > decayFrontier * 0.8
          ? Math.max(0, (decayFrontier * 1.1 - vCenter) / (decayFrontier * 0.3))
          : 1;

        notchSlots.push({
          vCenter,
          vHalfWidth,
          depthFrac: depthFrac * frontierFade,
          isVCut,
        });
      }

      // ── Build vertex grid ──
      const vertCount = (uCols + 1) * (vRows + 1);
      const positions = new Float32Array(vertCount * 3);
      const vertColors = new Float32Array(vertCount * 3); // RGB per vertex for edge/tip darkening

      for (let vi = 0; vi <= vRows; vi++) {
        const v = vi / vRows; // 0=base, 1=tip
        const y = bezierY(v);
        const hw = bezierHalfWidth(v); // half-width at this height

        // Compute notch shrinkage at this v (applied to both edges)
        let edgeShrink = 0; // 0-1: fraction of width removed from each edge
        for (const notch of notchSlots) {
          const dist = Math.abs(v - notch.vCenter);
          if (dist > notch.vHalfWidth) continue;
          const nd = dist / notch.vHalfWidth;
          const profile = notch.isVCut ? 1 - nd : 1 - nd * nd;
          edgeShrink = Math.max(edgeShrink, notch.depthFrac * profile);
        }

        for (let ui = 0; ui <= uCols; ui++) {
          const u = ui / uCols; // 0=right edge, 1=left edge
          const idx = (vi * (uCols + 1) + ui) * 3;

          // Cross-section position: u=0 → x=+hw, u=0.5 → x=0, u=1 → x=-hw
          const crossU = 1 - 2 * u; // +1 (right) to -1 (left)
          let localHW = hw;

          // Apply notch: shrink width at edges (u near 0 or 1)
          if (edgeShrink > 0) {
            const edgeness = Math.abs(crossU); // 0 at center, 1 at edge
            // Only shrink vertices close to the edge
            if (edgeness > 0.7) {
              const shrinkMask = (edgeness - 0.7) / 0.3; // 0 at 0.7, 1 at edge
              localHW *= (1 - edgeShrink * shrinkMask);
            }
          }

          const x = crossU * localHW;

          // ── Curl: edges lift, center stays flat ──
          // edgeness² gives parabolic cross-section: 0 at center, 1 at edges
          const edgeness = 2 * Math.abs(u - 0.5); // 0 at center, 1 at edge
          const heightRamp = Math.min(1, v / 0.3); // base stays flat
          const z = effectiveCurl * edgeness * edgeness * heightRamp * 0.08;

          positions[idx] = x;
          positions[idx + 1] = y;
          positions[idx + 2] = z;

          // ── Vertex color: edge/tip darkening ──
          // Center = (1,1,1) = full material color
          // Edges darken toward brown, tips darken further, all scaled by decayAmount
          let r = 1, g = 1, b = 1;
          if (decayAmount > 0) {
            // Edge darkening: edgeness 0.5-1.0 maps to 0-1 darkening zone
            const edgeDark = Math.max(0, (edgeness - 0.5) * 2); // 0 at center, 1 at edge
            // Tip darkening: v 0.6-1.0 maps to 0-1 darkening zone
            const tipDark = Math.max(0, (v - 0.6) * 2.5); // 0 at base, 1 at tip
            // Combined: tips of edges get the most darkening
            const darkFactor = Math.min(1, edgeDark + tipDark * 0.7) * decayAmount;
            // Lerp toward brown (0.5, 0.35, 0.25)
            r = 1 - darkFactor * 0.5;
            g = 1 - darkFactor * 0.65;
            b = 1 - darkFactor * 0.75;
          }
          vertColors[idx] = r;
          vertColors[idx + 1] = g;
          vertColors[idx + 2] = b;
        }
      }

      // ── Build triangle indices ──
      const triCount = uCols * vRows * 2;
      const indices = new Uint16Array(triCount * 3);
      let triIdx = 0;
      for (let vi = 0; vi < vRows; vi++) {
        for (let ui = 0; ui < uCols; ui++) {
          const a = vi * (uCols + 1) + ui;
          const b = a + 1;
          const c = a + (uCols + 1);
          const d = c + 1;
          indices[triIdx++] = a; indices[triIdx++] = c; indices[triIdx++] = b;
          indices[triIdx++] = b; indices[triIdx++] = c; indices[triIdx++] = d;
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(vertColors, 3));
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
      geo.computeVertexNormals();

      return geo;
    });
  }, [petalWidth, petalLength, petalCount, effectiveFray, frayDensity, effectiveCurl, decayAmount, seed]);

  // ── Half-leaf geometries (one per leaf for unique fraying) ──
  // Living flower leaf is 0→1 height, ±0.2 width. This half-leaf is ~0.2 height
  // with one straight edge (midrib cut) and one curved edge. Much smaller than petals.
  // The straight midrib edge stays clean; only the curved outer edge gets frayed.
  const leafCount = Math.max(0, stemColorCount - 1); // 0, 1, or 2 leaves
  const halfLeafGeometries = useMemo(() => {
    const numCurvePoints = 32;

    // The curved portion of the leaf: tip curve + outer edge curve
    // Sampled as two cubic beziers joined at (0.08, 0.17)
    // Bezier 1 (tip): P0=(0, 0.2), P1=(0.01, 0.22), P2=(0.06, 0.21), P3=(0.08, 0.17)
    // Bezier 2 (edge): P0=(0.08, 0.17), P1=(0.1, 0.12), P2=(0.09, 0.05), P3=(0, 0)
    function sampleLeafCurve(t: number): [number, number] {
      if (t <= 0.5) {
        const u = t * 2;
        const iu = 1 - u;
        const x = iu*iu*iu*0 + 3*iu*iu*u*0.01 + 3*iu*u*u*0.06 + u*u*u*0.08;
        const y = iu*iu*iu*0.2 + 3*iu*iu*u*0.22 + 3*iu*u*u*0.21 + u*u*u*0.17;
        return [x, y];
      } else {
        const u = (t - 0.5) * 2;
        const iu = 1 - u;
        const x = iu*iu*iu*0.08 + 3*iu*iu*u*0.1 + 3*iu*u*u*0.09 + u*u*u*0;
        const y = iu*iu*iu*0.17 + 3*iu*iu*u*0.12 + 3*iu*u*u*0.05 + u*u*u*0;
        return [x, y];
      }
    }

    return Array.from({ length: leafCount }, (_, leafIdx) => {
      const shape = new THREE.Shape();
      const leafSeed = seed + leafIdx * 200 + 500;
      const rng = createSeededRandom(leafSeed);

      // Start at base (0,0), go up the straight midrib edge — no fraying
      shape.moveTo(0, 0);
      shape.lineTo(0, 0.2);

      // ── Progression-based leaf decay (same approach as petals) ──
      // Leaf curve: t=0 is the tip, t=1 is back at the base.
      // So "height from base" = 1 - t. Tip = highest = decays first.
      const leafMaxWidth = 0.1;
      const decayFrontier = Math.min(0.95, effectiveFray * 0.45);

      const totalSlots = 2 + Math.floor(frayDensity * 3); // 2-5 notch slots
      interface LeafNotch {
        center: number;
        halfWidth: number;
        depth: number;
        isVCut: boolean;
        heightNorm: number;
      }
      const notchSlots: LeafNotch[] = [];
      for (let n = 0; n < totalSlots; n++) {
        const heightNorm = Math.sqrt(rng()); // biased toward tip
        // Leaf curve is single edge (t=0 tip, t=1 base), so heightNorm maps directly
        const center = 1 - heightNorm; // high heightNorm → low t → near tip
        const halfWidth = 0.03 + rng() * 0.04;
        const baseDepthFrac = (0.15 + rng() * 0.15) * (0.5 + heightNorm * 0.5);
        const isVCut = rng() < 0.6;
        notchSlots.push({ center, halfWidth, depth: baseDepthFrac, isVCut, heightNorm });
      }
      notchSlots.sort((a, b) => b.heightNorm - a.heightNorm);

      // Curved portion: sample + progression-based notch displacement
      for (let i = 0; i <= numCurvePoints; i++) {
        const t = i / numCurvePoints;
        const [bx, by] = sampleLeafCurve(t);

        // Outward normal
        const dt = 0.001;
        const [bx2, by2] = sampleLeafCurve(Math.min(t + dt, 1));
        const tanX = bx2 - bx;
        const tanY = by2 - by;
        const tLen = Math.sqrt(tanX * tanX + tanY * tanY) || 1;
        const outNx = tanY / tLen;
        const outNy = -tanX / tLen;

        let displacement = 0;
        for (const notch of notchSlots) {
          if (notch.heightNorm > decayFrontier * 1.1) continue;
          const frontierFade = notch.heightNorm > decayFrontier * 0.8
            ? (decayFrontier * 1.1 - notch.heightNorm) / (decayFrontier * 0.3)
            : 1;

          const dist = Math.abs(t - notch.center);
          if (dist > notch.halfWidth) continue;

          const normalizedDist = dist / notch.halfWidth;
          const profile = notch.isVCut
            ? 1 - normalizedDist
            : 1 - normalizedDist * normalizedDist;
          const effectiveDepth = leafMaxWidth * notch.depth * effectiveFray * Math.max(0, Math.min(1, frontierFade));
          const notchDisp = -effectiveDepth * profile;
          if (notchDisp < displacement) displacement = notchDisp;
        }

        const fx = bx + outNx * displacement;
        const fy = by + outNy * displacement;
        shape.lineTo(fx, fy);
      }

      return new THREE.ExtrudeGeometry(shape, {
        depth: 0.01,
        bevelEnabled: false,
      });
    });
  }, [leafCount, effectiveFray, frayDensity, seed]);

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
    const offsetPerPetal = 0.04; // small shift per layer
    const yGap = 0.005;
    const petalBaseAngle = baseAngle + jitterAngle();

    const petalLayouts = [];
    for (let i = 0; i < petalCount; i++) {
      // Each successive petal fans a bit further in the same direction
      const fanAngle = i * fanStep;
      // Offset each lower petal so it peeks out from under the one above
      const offsetDist = i * offsetPerPetal;
      const totalAngle = petalBaseAngle + fanAngle;
      petalLayouts.push({
        x: Math.cos(totalAngle) * offsetDist + jitter() * 0.1,
        z: Math.sin(totalAngle) * offsetDist + jitter() * 0.1,
        // Primary (i=0) on top
        y: 0.005 + (petalCount - 1 - i) * yGap,
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
    <group position={position} rotation={[0, rotation, 0]} onClick={onClick}>
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
              geometry={petalGeometries[i]}
              castShadow
            >
              <meshToonMaterial
                color={adjustedColor}
                gradientMap={gradientMap}
                side={THREE.DoubleSide}
                transparent
                opacity={opacity}
                vertexColors={decayAmount > 0}
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
        {layout.attachedLeafLocal && halfLeafGeometries[0] && (
          <group
            position={[layout.attachedLeafLocal.x, layout.attachedLeafLocal.y, layout.attachedLeafLocal.z]}
            rotation={[0, layout.attachedLeafLocal.angle, 0]}
          >
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              scale={[leafSize, leafSize, leafSize]}
              geometry={halfLeafGeometries[0]}
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
        {layout.detachedLeafLocal && halfLeafGeometries[1] && (
          <group
            position={[layout.detachedLeafLocal.x, layout.detachedLeafLocal.y, layout.detachedLeafLocal.z]}
            rotation={[0, layout.detachedLeafLocal.angle, 0]}
          >
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              scale={[leafSize, leafSize, leafSize]}
              geometry={halfLeafGeometries[1]}
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
    </group>
  );
};

export default FallenBloom3D;
