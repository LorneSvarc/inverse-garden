import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * VitrineBase - The VISIBLE platform that anchors the garden
 *
 * This is NOT muddy brown that disappears into darkness.
 * It's warm, light stone that catches light and stands out.
 * The rim has subtle emissive to glow and catch bloom.
 *
 * The vitrine should be the BRIGHTEST non-plant element.
 */

interface VitrineBaseProps {
  width?: number;
  depth?: number;
  height?: number;
  bevelSize?: number;
}

// MUCH LIGHTER colors - visible against the dark void
const COLORS = {
  top: '#d4c4a8',       // Warm stone - light, catches light
  sides: '#c9b896',     // Visible warm stone
  bevel: '#e0d4bc',     // Light bevel - catches rim light
  rim: '#f5f0e6',       // Warm cream white - catches light aggressively
};

export const VitrineBase: React.FC<VitrineBaseProps> = ({
  width = 44,
  depth = 36,
  height = 2.5,
  bevelSize = 0.8,
}) => {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const w = width / 2;
    const d = depth / 2;
    const r = 2;

    shape.moveTo(-w + r, -d);
    shape.lineTo(w - r, -d);
    shape.quadraticCurveTo(w, -d, w, -d + r);
    shape.lineTo(w, d - r);
    shape.quadraticCurveTo(w, d, w - r, d);
    shape.lineTo(-w + r, d);
    shape.quadraticCurveTo(-w, d, -w, d - r);
    shape.lineTo(-w, -d + r);
    shape.quadraticCurveTo(-w, -d, -w + r, -d);

    const extrudeSettings = {
      depth: height,
      bevelEnabled: true,
      bevelThickness: bevelSize,
      bevelSize: bevelSize,
      bevelSegments: 3,
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -height - bevelSize, 0);

    return geo;
  }, [width, depth, height, bevelSize]);

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        color={COLORS.top}
        roughness={0.6}
        metalness={0.05}
      />
    </mesh>
  );
};

/**
 * VitrineRim - The glowing edge that catches light and bloom
 *
 * This is the lightest element - warm cream that pops against everything.
 * Has subtle emissive to glow and interact with bloom.
 */
export const VitrineRim: React.FC<VitrineBaseProps> = ({
  width = 44,
  depth = 36,
}) => {
  const geometry = useMemo(() => {
    const outer = new THREE.Shape();
    const inner = new THREE.Path();

    const wo = width / 2 + 0.5;
    const do_ = depth / 2 + 0.5;
    const wi = width / 2 - 0.3;
    const di = depth / 2 - 0.3;
    const ro = 2.5;
    const ri = 1.8;

    outer.moveTo(-wo + ro, -do_);
    outer.lineTo(wo - ro, -do_);
    outer.quadraticCurveTo(wo, -do_, wo, -do_ + ro);
    outer.lineTo(wo, do_ - ro);
    outer.quadraticCurveTo(wo, do_, wo - ro, do_);
    outer.lineTo(-wo + ro, do_);
    outer.quadraticCurveTo(-wo, do_, -wo, do_ - ro);
    outer.lineTo(-wo, -do_ + ro);
    outer.quadraticCurveTo(-wo, -do_, -wo + ro, -do_);

    inner.moveTo(-wi + ri, -di);
    inner.lineTo(wi - ri, -di);
    inner.quadraticCurveTo(wi, -di, wi, -di + ri);
    inner.lineTo(wi, di - ri);
    inner.quadraticCurveTo(wi, di, wi - ri, di);
    inner.lineTo(-wi + ri, di);
    inner.quadraticCurveTo(-wi, di, -wi, di - ri);
    inner.lineTo(-wi, -di + ri);
    inner.quadraticCurveTo(-wi, -di, -wi + ri, -di);

    outer.holes.push(inner);

    const extrudeSettings = {
      depth: 0.4,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.1,
      bevelSegments: 2,
    };

    const geo = new THREE.ExtrudeGeometry(outer, extrudeSettings);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.2, 0);

    return geo;
  }, [width, depth]);

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        color={COLORS.rim}
        emissive={COLORS.rim}
        emissiveIntensity={0.15}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  );
};

export default VitrineBase;
