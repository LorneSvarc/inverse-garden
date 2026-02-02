// The raised bed defines the plantable world
export const GROUND_BOUNDS = {
  width: 36,           // x dimension (was 30)
  depth: 30,           // z dimension (was 24)
  cornerRadius: 3,     // softened corners
  wallHeight: 1.2,     // visible edge depth
};

// Where plants can spawn (inset from walls)
export const PLANT_BOUNDS = {
  width: GROUND_BOUNDS.width - 2,   // 34 (was 28)
  depth: GROUND_BOUNDS.depth - 2,   // 28 (was 22)
  cornerRadius: GROUND_BOUNDS.cornerRadius,
};

// Camera limits - tighter to keep focus on garden
export const CAMERA_LIMITS = {
  minDistance: 10,      // was 8
  maxDistance: 40,      // was 50
  minPolarAngle: Math.PI * 0.15,   // was 0.1 - slightly more constrained
  maxPolarAngle: Math.PI * 0.45,   // same
  minAzimuthAngle: -Math.PI / 3,   // was -PI/2 - less side rotation
  maxAzimuthAngle: Math.PI / 3,    // was PI/2
};

// Scene background color (will be replaced by skybox)
export const SCENE_BACKGROUND_COLOR = '#2A3A4A';
