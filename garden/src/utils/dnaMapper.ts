import type {
  MoodEntryWithPercentile,
  PlantType,
  PlantDNA,
  FlowerDNA,
  SproutDNA,
  FallenBloomDNA,
} from '../types';
import { percentileToScale } from './percentileCalculator';

// ============================================
// COLOR LOOKUP TABLES
// From inverse-garden-gdd-v3.2.md
// ============================================

/**
 * Emotion colors - Negative emotions are vibrant (appear on Flowers)
 * Positive emotions are muted (appear on Decays)
 */
const EMOTION_COLORS: Record<string, string> = {
  // Negative Emotions (Vibrant)
  'Anxious': '#00FFEF',      // Bright electric teal
  'Worried': '#4CBB17',      // Kelly green
  'Scared': '#015F63',       // Deep blue teal
  'Overwhelmed': '#00F5A0',  // Bright mint green
  'Sad': '#2563EB',          // Primary blue
  'Discouraged': '#38BDF8',  // Bright sky blue
  'Disappointed': '#312E81', // Dark indigo
  'Hopeless': '#BFDBFE',     // Baby blue
  'Stressed': '#EF4444',     // Vivid red
  'Annoyed': '#EC4899',      // Magenta
  'Frustrated': '#FBCFE8',   // Light pink
  'Irritated': '#BE123C',    // Bright maroon
  'Ashamed': '#FF5F1F',      // Neon orange
  'Guilty': '#FFBF00',       // Amber
  'Drained': '#FFEA00',      // Bright yellow
  'Disgusted': '#FFFF8F',    // Canary yellow

  // Neutral Emotion
  'Indifferent': '#DFFF00',  // Chartreuse

  // Positive Emotions (Muted - appear on Decays)
  'Content': '#9CA3AF',      // Grey
  'Satisfied': '#64748B',    // Slate grey
  'Happy': '#4B5563',        // Dark grey
  'Joyful': '#1F2937',       // Near black
  'Hopeful': '#78350F',      // Brown
  'Excited': '#988558',      // Dark tan
  'Passionate': '#D4A574',   // Camel
  'Grateful': '#808000',     // Olive green
  'Proud': '#355E3B',        // Hunter green
  'Brave': '#023020',        // Dark green
  'Confident': '#A0AFA0',    // Silver green
  'Relieved': '#8B8000',     // Dark yellow
  'Calm': '#8B4000',         // Dark orange
  'Surprised': '#811331',    // Claret
  'Amused': '#C9A9A6',       // Dusty rose

  // Handle typos/variants found in the data
  'Surpirsed': '#811331',    // Same as Surprised (typo in data)
  'Peaceful': '#9CA3AF',     // Not in GDD - using grey like Content
};

/**
 * Association colors - for stems, leaves, cracks
 */
const ASSOCIATION_COLORS: Record<string, string> = {
  'Self Care': '#9DC183',    // Sage green
  'Health': '#A0522D',       // Sienna
  'Fitness': '#FF69B4',      // Hot pink
  'Partner': '#FFB6C1',      // Light pink
  'Family': '#00FF7F',       // Spring green
  'Friends': '#E0FFFF',      // Light cyan
  'Community': '#FFFFFF',    // White
  'Work': '#DAA520',         // Goldenrod
  'Tasks': '#708090',        // Slate gray
  'Identity': '#9370DB',     // Medium purple
  'Hobbies': '#B22222',      // Firebrick
  'Travel': '#FFA500',       // Orange
  'Weather': '#00BFFF',      // Deep sky blue
};

// Fallback colors for missing data
const FALLBACK_EMOTION_COLOR = '#FFFFFF';     // White
const FALLBACK_CENTER_COLOR = '#FFD700';      // Bright yellow
const FALLBACK_ASSOCIATION_COLOR = '#FFD700'; // Bright yellow

// ============================================
// SEEDED RANDOM FOR REPRODUCIBLE VARIETY
// ============================================

/**
 * Simple seeded PRNG using mulberry32 algorithm
 * Returns a function that generates numbers 0-1
 */
function createSeededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================
// DEFAULT VALUES
// From inverse-garden-gdd-v3.2.md "Recommended Defaults"
// ============================================

const FLOWER_DEFAULTS = {
  petalCount: 8,
  petalRows: 2,
  petalLength: 1.2,   // Reduced from 2.5 for better garden density
  petalWidth: 0.6,    // Reduced from 1.2, keeps proportions similar
  petalCurvature: 0.5,
  glowIntensity: 1.5,
  wobbleSpeed: 0.8,
  // stemBend is now randomized per-flower, not a static default
  leafCount: 2,
  leafSize: 1.0,
  leafOrientation: 0,
  leafAngle: 0.5,
};

const SPROUT_DEFAULTS = {
  budSize: 1.0,
  budPointiness: 0.5,
  stemHeight: 1.0,
  stemCurve: 0.2,
  stemThickness: 0.8,
  cotyledonSize: 1.0,
  swaySpeed: 0.8,
  swayAmount: 0.3,
};

const FALLEN_BLOOM_DEFAULTS = {
  petalLength: 0.35,
  petalWidth: 0.18,
  stemLength: 0.35,
  leafSize: 0.5,
  frayDensity: 0.8,  // always max density; frayAmount drives visual intensity
};

// Scale ranges by plant type (updated for Phase 1.5)
// These use percentile-based mapping for better visual variety
const SCALE_RANGES = {
  flower: { min: 0.4, max: 1.8 },
  sprout: { min: 0.8, max: 1.0 },  // Narrow range, always visible
  decay: { min: 1.0, max: 3.6 },
};

// ============================================
// MAPPING FUNCTIONS
// ============================================

/**
 * Determine plant type from valence classification
 *
 * Very Unpleasant, Unpleasant, Slightly Unpleasant → Flower
 * Neutral → Sprout
 * Slightly Pleasant, Pleasant, Very Pleasant → Decay
 */
export function getPlantType(valenceClassification: string): PlantType {
  const classification = valenceClassification.toLowerCase().trim();

  if (classification.includes('unpleasant')) {
    return 'flower';
  }
  if (classification === 'neutral') {
    return 'sprout';
  }
  // pleasant variants
  return 'decay';
}

/**
 * Calculate scale from percentile (Phase 1.5 - percentile-based scaling)
 *
 * Percentile-based scaling ensures visual variety even when raw valence values cluster.
 * The percentile is pre-calculated and stored with each entry.
 *
 * @param percentile - 0-100, calculated from |valence| rank within plant type
 * @param plantType - flower, sprout, or decay
 */
export function calculateScaleFromPercentile(percentile: number, plantType: PlantType): number {
  const { min, max } = SCALE_RANGES[plantType];
  return percentileToScale(percentile, min, max);
}

/**
 * Calculate scale from absolute valence value (legacy - kept for backwards compatibility)
 *
 * scale = minScale + (|valence| × (maxScale - minScale))
 *
 * Both -0.8 and +0.8 produce the same large scale - intensity matters, not direction.
 * @deprecated Use calculateScaleFromPercentile for better visual variety
 */
export function calculateScale(valence: number, plantType: PlantType): number {
  const absValence = Math.abs(valence);
  const { min, max } = SCALE_RANGES[plantType];
  return min + absValence * (max - min);
}

/**
 * Look up emotion color with fallback
 */
export function getEmotionColor(emotion: string): string {
  return EMOTION_COLORS[emotion] || FALLBACK_EMOTION_COLOR;
}

/**
 * Look up association color with fallback
 */
export function getAssociationColor(association: string): string {
  return ASSOCIATION_COLORS[association] || FALLBACK_ASSOCIATION_COLOR;
}

/**
 * Get emotion colors array for a list of emotions
 * If empty, returns fallback white
 */
function getEmotionColors(emotions: string[]): string[] {
  if (emotions.length === 0) {
    return [FALLBACK_EMOTION_COLOR];
  }
  return emotions.map(getEmotionColor);
}

/**
 * Get association colors array for a list of associations
 * If empty, returns fallback yellow
 */
function getAssociationColors(associations: string[]): string[] {
  if (associations.length === 0) {
    return [FALLBACK_ASSOCIATION_COLOR];
  }
  return associations.map(getAssociationColor);
}

// ============================================
// DNA BUILDERS
// ============================================

/**
 * Build FlowerDNA from a mood entry
 *
 * Color application:
 * - 1 emotion: Entire bloom is that color
 * - 2-3 emotions: Center is primary, petals rotate through all
 *
 * Per-flower variety (seeded from timestamp for reproducibility):
 * - rotation: Random Y-axis rotation (0 to 2π) to break up clone army look
 * - stemBend: Random bend between 0.1 and 0.5 for organic variety
 */
function buildFlowerDNA(entry: MoodEntryWithPercentile): FlowerDNA {
  const emotionColors = getEmotionColors(entry.emotions);
  const associationColors = getAssociationColors(entry.associations);

  // Center color is always the primary emotion
  const centerColor = entry.emotions.length === 0
    ? FALLBACK_CENTER_COLOR
    : emotionColors[0];

  // Petal colors cycle through all emotions
  const petalColors = emotionColors;

  // Create seeded random from timestamp for reproducible variety
  const random = createSeededRandom(entry.timestamp.getTime());

  // Random Y-axis rotation (0 to 2π) - each flower faces a different direction
  const rotation = random() * Math.PI * 2;

  // Random stem bend between 0.1 and 0.5 for organic variety
  const stemBend = 0.1 + random() * 0.4;

  return {
    name: entry.id,
    description: `Flower from ${entry.timestamp.toLocaleDateString()}`,

    // Fixed defaults
    ...FLOWER_DEFAULTS,

    // Data-driven values
    petalColors,
    centerColor,
    stemColors: associationColors,
    scale: calculateScaleFromPercentile(entry.scalePercentile, 'flower'),

    // Per-flower variety (seeded from timestamp)
    rotation,
    stemBend,
  };
}

/**
 * Build SproutDNA from a mood entry
 *
 * Color application:
 * - 1 emotion: Entire bud is that color
 * - 2 emotions: Bud base is primary, stripe is secondary
 * - 3 emotions: Bud base is primary, two stripes are secondary/tertiary
 *
 * Association application:
 * - 1 association: Stem and cotyledons are that color
 * - 2+ associations: Stem = primary, cotyledons = secondary/tertiary
 */
function buildSproutDNA(entry: MoodEntryWithPercentile): SproutDNA {
  const emotionColors = getEmotionColors(entry.emotions);
  const associationColors = getAssociationColors(entry.associations);

  // Primary emotion is bud color, with stripes for 2nd/3rd
  const budColor = emotionColors[0];
  const budStripe2Color = emotionColors[1] || budColor;
  const budStripe3Color = emotionColors[2] || budColor;

  // Primary association is stem, 2nd/3rd are cotyledons
  const stemColor = associationColors[0];
  const cotyledon1Color = associationColors[1] || stemColor;
  const cotyledon2Color = associationColors[2] || stemColor;

  return {
    name: entry.id,
    description: `Sprout from ${entry.timestamp.toLocaleDateString()}`,

    // Fixed defaults
    ...SPROUT_DEFAULTS,

    // Data-driven values
    budColor,
    budStripe2Color,
    budStripe3Color,
    stemColor,
    cotyledon1Color,
    cotyledon2Color,
    scale: calculateScaleFromPercentile(entry.scalePercentile, 'sprout'),
  };
}

/**
 * Build FallenBloomDNA from a mood entry
 *
 * Fallen blooms represent positive emotions (contentment, peace, calm).
 * They appear as scattered fallen flower debris on the ground.
 *
 * Fray encoding:
 * - Valence drives frayAmount: slightly pleasant = light fray, very pleasant = heavy fray
 * - Density is fixed at max (0.8) — amount alone controls visual intensity
 *
 * Color encoding:
 * - Emotions → petal colors (1-3 petals stacked like cards)
 * - Associations → stem color (A0) + leaf colors (A1, A2)
 */
function buildFallenBloomDNA(entry: MoodEntryWithPercentile): FallenBloomDNA {
  const emotionColors = getEmotionColors(entry.emotions);
  const associationColors = getAssociationColors(entry.associations);
  const random = createSeededRandom(entry.timestamp.getTime());

  // Fixed decay aesthetic — all decays share the same "fallen" look
  // decayAmount drives gradient darkening, vertex browning, curl, and fray
  // Scale is the primary valence signal (bigger = more intense positive emotion)
  const FIXED_DECAY_AMOUNT = 0.55;

  return {
    name: entry.id,
    description: `Fallen bloom from ${entry.timestamp.toLocaleDateString()}`,

    // Fixed shape defaults (variation system can adjust later)
    ...FALLEN_BLOOM_DEFAULTS,

    // Scale from percentile: primary valence channel (1.0-3.6 range)
    scale: calculateScaleFromPercentile(entry.scalePercentile, 'decay'),

    // Decay look (fixed for all decays)
    decayAmount: FIXED_DECAY_AMOUNT,

    // Fraying — will be overridden by decayAmount in FallenBloom3D (kept for interface compat)
    frayAmount: FIXED_DECAY_AMOUNT * 2.0,

    // Colors: emotions → petals, associations → stem + leaves
    petalColors: emotionColors,
    stemColors: associationColors,

    // Randomization
    seed: entry.timestamp.getTime(),
    rotation: random() * Math.PI * 2,
  };
}

// ============================================
// MAIN EXPORT
// ============================================

/**
 * Convert a MoodEntryWithPercentile into the appropriate PlantDNA
 *
 * This is the main function that ties everything together:
 * 1. Determines plant type from valence classification
 * 2. Builds the appropriate DNA object with colors from emotions/associations
 * 3. Calculates scale from percentile rank (for visual variety)
 *
 * Note: Requires entries with scalePercentile pre-calculated.
 * Use parseCSVWithPercentiles() to load data with percentiles.
 */
export function entryToDNA(entry: MoodEntryWithPercentile): PlantDNA {
  const plantType = getPlantType(entry.valenceClassification);

  switch (plantType) {
    case 'flower':
      return { type: 'flower', dna: buildFlowerDNA(entry) };
    case 'sprout':
      return { type: 'sprout', dna: buildSproutDNA(entry) };
    case 'decay':
      return { type: 'decay', dna: buildFallenBloomDNA(entry) };
  }
}

/**
 * Convert multiple entries to DNA objects
 */
export function entriesToDNA(entries: MoodEntryWithPercentile[]): PlantDNA[] {
  return entries.map(entryToDNA);
}
