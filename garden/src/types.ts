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
  rotation: number;  // Y-axis rotation in radians (0 to 2π)
}

// Legacy DecayDNA — kept for reference, replaced by FallenBloomDNA
export interface DecayDNA {
  name: string;
  description: string;
  size: number;
  aspectRatio: number;
  edgeWobble: number;
  layer1Color: string;
  layer2Color: string;
  layer3Color: string;
  crackCount: number;
  crackWobble: number;
  crack1Color: string;
  crack2Color: string;
  crack3Color: string;
}

export interface FallenBloomDNA {
  name: string;
  description: string;

  // Shape (fixed defaults, variation system can adjust later)
  petalLength: number;       // 0.2-0.5
  petalWidth: number;        // 0.1-0.25
  stemLength: number;        // 0.2-0.6
  leafSize: number;          // 0.3-1.0
  scale: number;             // 0.4-1.8 (from percentile, may be fixed later)

  // Decay progression (fixed aesthetic for all decays)
  decayAmount: number;       // 0-1: master decay look (gradient, darkening, curl, fray)
  frayAmount: number;        // 0-2, scales with valence intensity
  frayDensity: number;       // 0-1, fixed at max for data-driven use

  // Colors (same encoding as flower system)
  petalColors: string[];     // Emotion colors [E0] or [E0,E1] or [E0,E1,E2]
  stemColors: string[];      // Association colors [A0] or [A0,A1] or [A0,A1,A2]

  // Per-instance randomization
  seed: number;              // From entry timestamp for reproducibility
  rotation: number;          // Y-axis rotation (0-2π)
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

// Parsed mood entry from CSV (before percentile calculation)
export interface MoodEntry {
  id: string;                    // Unique identifier (timestamp-based)
  timestamp: Date;
  kind: 'Momentary Emotion' | 'Daily Mood';
  emotions: string[];            // Parsed from Labels field
  associations: string[];        // Parsed from Associations field
  valence: number;               // -1 to 1
  valenceClassification: string; // "Very Unpleasant", "Neutral", etc.
}

// MoodEntry with percentile calculated (used for scale)
export interface MoodEntryWithPercentile extends MoodEntry {
  scalePercentile: number;       // 0-100, calculated at load time based on |valence| rank within type
}

// What type of plant this entry becomes
export type PlantType = 'flower' | 'sprout' | 'decay';

// Union of all DNA types with discriminator
export type PlantDNA =
  | { type: 'flower'; dna: FlowerDNA }
  | { type: 'sprout'; dna: SproutDNA }
  | { type: 'decay'; dna: FallenBloomDNA };
