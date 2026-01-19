export interface FlowerDNA {
  name: string;
  description: string;
  petalCount: number;
  petalRows: number;
  petalLength: number;
  petalWidth: number;
  petalCurvature: number;
  petalColors: string[];
  centerColor: string;
  stemColors: string[];
  glowIntensity: number;
  wobbleSpeed: number;
  scale: number;
  stemBend: number;
  leafCount: number;
  leafSize: number;
  leafOrientation: number;
  leafAngle: number;
}

export interface DecayDNA {
  name: string;
  description: string;
  
  // Size & Shape
  size: number;              // Base diameter - scales width, not height
  aspectRatio: number;       // 1 = circular, >1 = elongated horizontally
  edgeWobble: number;        // 0-1, how irregular the edges are
  
  // Layer Colors (emotion-mapped)
  // Layer 1 = innermost/top, Layer 3 = outermost/bottom
  layer1Color: string;       // Primary emotion
  layer2Color: string;       // Secondary emotion (defaults to layer1 if absent)
  layer3Color: string;       // Tertiary emotion (defaults to layer1 if absent)
  
  // Crack Configuration
  crackCount: number;        // Number of radiating cracks (4-12 range)
  crackWobble: number;       // 0-1, how much zig-zag in the cracks
  crack1Color: string;       // Primary association
  crack2Color: string;       // Secondary association (defaults to crack1 if absent)
  crack3Color: string;       // Tertiary association (defaults to crack1 if absent)
}

export interface SproutDNA {
  name: string;
  description: string;
  
  // Bud (emotions) - closed seed pod shape at top
  budColor: string;           // Primary emotion
  budStripe2Color: string;    // Secondary emotion (vertical stripe)
  budStripe3Color: string;    // Tertiary emotion (vertical stripe)
  budSize: number;            // 0.5-1.5, affects bud dimensions
  budPointiness: number;      // 0-1, how teardrop vs rounded
  
  // Stem (primary association)
  stemColor: string;          // Primary association
  stemHeight: number;         // 0.8-1.5 (shorter than flowers)
  stemCurve: number;          // -1 to 1, more curve allowed than flowers
  stemThickness: number;      // 0.5-1, thinner than flowers
  
  // Cotyledons (associations 2 & 3) - round seed leaves, always paired
  cotyledon1Color: string;    // Secondary association
  cotyledon2Color: string;    // Tertiary association  
  cotyledonSize: number;      // 0.5-1.5
  
  // Animation
  swaySpeed: number;          // 0.3-1.5
  swayAmount: number;         // 0.1-0.5
  
  // General
  scale: number;              // 0.3-0.8 (always smaller than flowers)
}

export interface GenerationRequest {
  prompt?: string;
  mood?: string;
}
