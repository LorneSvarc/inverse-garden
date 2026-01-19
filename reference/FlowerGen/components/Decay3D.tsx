import React, { useMemo } from 'react';
import * as THREE from 'three';
import { DecayDNA } from '../types';

interface Decay3DProps {
  dna: DecayDNA;
}

const Decay3D: React.FC<Decay3DProps> = ({ dna }) => {
  
  // ============================================
  // SHAPE GENERATION
  // ============================================
  
  /**
   * Creates a slightly irregular rounded shape that can vary from
   * circular to more rectangular based on aspectRatio.
   * Uses smooth noise for organic wobble, not spiky randomness.
   */
  const createLayerShape = (
    baseRadius: number,
    wobbleAmount: number,
    aspectRatio: number,
    seed: number
  ): THREE.Shape => {
    const shape = new THREE.Shape();
    const points = 64; // Smooth curve
    
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      
      // Base radius with aspect ratio applied
      // aspectRatio > 1 stretches horizontally
      const xRadius = baseRadius * aspectRatio;
      const yRadius = baseRadius;
      
      // Smooth organic wobble using layered sine waves
      // The seed makes each layer slightly different
      const wobble1 = Math.sin(angle * 2 + seed) * 0.15;
      const wobble2 = Math.sin(angle * 3 + seed * 1.7) * 0.1;
      const wobble3 = Math.cos(angle * 5 + seed * 2.3) * 0.05;
      const totalWobble = 1 + (wobble1 + wobble2 + wobble3) * wobbleAmount;
      
      // Softening toward rectangle (superellipse-like)
      // When aspectRatio is higher, we can add subtle squareness
      const squareness = Math.min((aspectRatio - 1) * 0.3, 0.4);
      const cornerSoftness = 1 - squareness * Math.pow(Math.abs(Math.sin(2 * angle)), 0.5) * 0.15;
      
      const x = Math.cos(angle) * xRadius * totalWobble * cornerSoftness;
      const y = Math.sin(angle) * yRadius * totalWobble * cornerSoftness;
      
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    
    shape.closePath();
    return shape;
  };
  
  // ============================================
  // LAYER GEOMETRIES
  // ============================================
  
  // Layer 3 (outermost/bottom) - 100% of size
  const layer3Geometry = useMemo(() => {
    const radius = dna.size;
    const shape = createLayerShape(radius, dna.edgeWobble, dna.aspectRatio, 1.0);
    return new THREE.ShapeGeometry(shape);
  }, [dna.size, dna.edgeWobble, dna.aspectRatio]);
  
  // Layer 2 (middle) - 70% of size
  const layer2Geometry = useMemo(() => {
    const radius = dna.size * 0.7;
    const shape = createLayerShape(radius, dna.edgeWobble, dna.aspectRatio, 2.5);
    return new THREE.ShapeGeometry(shape);
  }, [dna.size, dna.edgeWobble, dna.aspectRatio]);
  
  // Layer 1 (innermost/top) - 45% of size
  const layer1Geometry = useMemo(() => {
    const radius = dna.size * 0.45;
    const shape = createLayerShape(radius, dna.edgeWobble, dna.aspectRatio, 4.2);
    return new THREE.ShapeGeometry(shape);
  }, [dna.size, dna.edgeWobble, dna.aspectRatio]);
  
  // ============================================
  // CRACK GENERATION
  // ============================================
  
  /**
   * Creates radiating cracks from center outward.
   * - Evenly distributed with slight random offset
   * - Gentle controlled zig-zag
   * - Tapers from center to edge
   * - Never extends past Layer 3
   */
  const cracks = useMemo(() => {
    const crackList: {
      geometry: THREE.ShapeGeometry;
      colorIndex: number;
    }[] = [];
    
    const count = Math.max(4, Math.min(12, dna.crackCount));
    const maxLength = dna.size * 0.95; // Stay within layer 3
    const baseWidth = dna.size * 0.06; // Substantial width
    
    for (let i = 0; i < count; i++) {
      // Even distribution with slight random offset (±15°)
      const baseAngle = (i / count) * Math.PI * 2;
      const angleOffset = (Math.sin(i * 7.3) * 0.5 - 0.25) * 0.26; // Deterministic "random"
      const startAngle = baseAngle + angleOffset;
      
      // Build crack path with controlled zig-zag
      const segments = 8;
      const segmentLength = maxLength / segments;
      const points: { x: number; y: number }[] = [{ x: 0, y: 0 }];
      
      let currentAngle = startAngle;
      let cx = 0;
      let cy = 0;
      
      for (let j = 1; j <= segments; j++) {
        // Controlled zig-zag: alternating slight turns
        const zigzag = Math.sin(j * 2.5 + i * 1.3) * dna.crackWobble * 0.4;
        currentAngle = startAngle + zigzag;
        
        cx += Math.cos(currentAngle) * segmentLength;
        cy += Math.sin(currentAngle) * segmentLength;
        
        points.push({ x: cx, y: cy });
      }
      
      // Create crack shape with tapering width
      const crackShape = new THREE.Shape();
      
      // Walk up one side
      for (let j = 0; j < points.length; j++) {
        const p = points[j];
        const progress = j / (points.length - 1);
        const width = baseWidth * (1 - progress * 0.7); // Taper to 30% at tip
        
        // Perpendicular offset
        const nextP = points[Math.min(j + 1, points.length - 1)];
        const dx = nextP.x - p.x;
        const dy = nextP.y - p.y;
        const perpAngle = Math.atan2(dy, dx) + Math.PI / 2;
        
        const offsetX = Math.cos(perpAngle) * width;
        const offsetY = Math.sin(perpAngle) * width;
        
        if (j === 0) {
          crackShape.moveTo(p.x + offsetX, p.y + offsetY);
        } else {
          crackShape.lineTo(p.x + offsetX, p.y + offsetY);
        }
      }
      
      // Walk back down the other side
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
      
      // Determine which color this crack gets (cycling through available)
      const colorIndex = i % 3; // Will cycle 0, 1, 2, 0, 1, 2...
      
      crackList.push({
        geometry: new THREE.ShapeGeometry(crackShape),
        colorIndex
      });
    }
    
    return crackList;
  }, [dna.size, dna.crackCount, dna.crackWobble]);
  
  // ============================================
  // COLOR HELPERS
  // ============================================
  
  // Get crack color based on index, falling back appropriately
  const getCrackColor = (colorIndex: number): string => {
    if (colorIndex === 0) return dna.crack1Color;
    if (colorIndex === 1) return dna.crack2Color || dna.crack1Color;
    return dna.crack3Color || dna.crack1Color;
  };
  
  // ============================================
  // RENDER
  // ============================================
  
  // Layer heights - very flat, subtle stepping
  const layer3Height = 0.001;
  const layer2Height = 0.015;
  const layer1Height = 0.028;
  const crackHeight = 0.035;
  
  return (
    <>
      {/* Ground Plane */}
      <mesh 
        position={[0, -2.5, 0]} 
        rotation={[-Math.PI / 2, 0, 0]} 
        receiveShadow
      >
        <circleGeometry args={[25, 64]} />
        <meshStandardMaterial color="#8B7355" roughness={1} />
      </mesh>
      
      {/* Decay Group - positioned flat on ground */}
      <group position={[0, -2.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        
        {/* Layer 3 - Outermost/Bottom (Tertiary Emotion) */}
        <mesh position={[0, 0, layer3Height]} geometry={layer3Geometry}>
          <meshStandardMaterial
            color={dna.layer3Color}
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>
        
        {/* Layer 2 - Middle (Secondary Emotion) */}
        <mesh position={[0, 0, layer2Height]} geometry={layer2Geometry}>
          <meshStandardMaterial
            color={dna.layer2Color}
            roughness={0.8}
            metalness={0.08}
          />
        </mesh>
        
        {/* Layer 1 - Innermost/Top (Primary Emotion) */}
        <mesh position={[0, 0, layer1Height]} geometry={layer1Geometry}>
          <meshStandardMaterial
            color={dna.layer1Color}
            roughness={0.75}
            metalness={0.1}
          />
        </mesh>
        
        {/* Cracks - on top of everything */}
        {cracks.map((crack, idx) => (
          <mesh 
            key={`crack-${idx}`} 
            position={[0, 0, crackHeight]} 
            geometry={crack.geometry}
          >
            <meshStandardMaterial
              color={getCrackColor(crack.colorIndex)}
              roughness={0.7}
              metalness={0.15}
            />
          </mesh>
        ))}
        
      </group>
      
      <ambientLight intensity={0.5} />
    </>
  );
};

export default Decay3D;
