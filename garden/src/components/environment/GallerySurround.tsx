import React from 'react';
import * as THREE from 'three';

/**
 * GallerySurround - Simple dark backdrop
 *
 * This is NOT the visual focus - the EmissiveGround is.
 * This just provides a dark backdrop that doesn't compete.
 */

interface GallerySurroundProps {
  showUnderglow?: boolean;
}

export const GallerySurround: React.FC<GallerySurroundProps> = () => {
  return (
    <mesh>
      <sphereGeometry args={[200, 32, 32]} />
      <meshBasicMaterial
        color="#0a0a10"
        side={THREE.BackSide}
      />
    </mesh>
  );
};

export const GalleryFloor: React.FC = () => {
  // No longer needed - EmissiveGround handles this
  return null;
};

export default GallerySurround;
