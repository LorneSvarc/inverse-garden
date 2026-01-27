import type { MoodEntryWithPercentile } from '../types';

/**
 * Garden Level Calculation
 *
 * Garden level represents the cumulative emotional state of the garden:
 * - Negative valence entries (flowers) push garden level negative → "lush"
 * - Positive valence entries (decays) push garden level positive → "barren"
 * - Garden level decays toward zero over time (exponential decay)
 *
 * This affects plant fade rates:
 * - Negative garden level (lush) → flowers fade slower, decays fade faster
 * - Positive garden level (barren) → decays fade slower, flowers fade faster
 */

// Configuration - tunable parameters
export const GARDEN_LEVEL_CONFIG = {
  // How quickly garden level decays toward zero
  // After this many days, garden level is halved
  halfLifeDays: 7,

  // Maximum contribution from a single entry (prevents extreme spikes)
  maxEntryContribution: 1.0,
};

/**
 * Calculate the garden level at a specific point in time.
 *
 * @param entries - All mood entries (must be sorted by timestamp ascending)
 * @param atTime - The point in time to calculate garden level for
 * @returns The garden level (negative = lush, positive = barren)
 */
export function calculateGardenLevel(
  entries: MoodEntryWithPercentile[],
  atTime: Date
): number {
  const atTimeMs = atTime.getTime();
  const halfLifeMs = GARDEN_LEVEL_CONFIG.halfLifeDays * 24 * 60 * 60 * 1000;

  // Decay constant for exponential decay: level(t) = level(0) * e^(-λt)
  // Half-life: 0.5 = e^(-λ * halfLife) → λ = ln(2) / halfLife
  const decayConstant = Math.LN2 / halfLifeMs;

  let gardenLevel = 0;

  for (const entry of entries) {
    const entryTimeMs = entry.timestamp.getTime();

    // Skip entries after the current time
    if (entryTimeMs > atTimeMs) {
      break;
    }

    // How much time has passed since this entry
    const timeSinceEntryMs = atTimeMs - entryTimeMs;

    // Calculate decay factor for this entry
    const decayFactor = Math.exp(-decayConstant * timeSinceEntryMs);

    // Entry contribution is its valence (negative adds, positive subtracts)
    // Clamp to max contribution
    const contribution = Math.max(
      -GARDEN_LEVEL_CONFIG.maxEntryContribution,
      Math.min(GARDEN_LEVEL_CONFIG.maxEntryContribution, entry.valence)
    );

    // Add decayed contribution to garden level
    // Negative valence (flowers) → negative garden level (lush)
    // Positive valence (decays) → positive garden level (barren)
    gardenLevel += contribution * decayFactor;
  }

  return gardenLevel;
}

/**
 * Get the garden level modifier for fade rate.
 *
 * @param gardenLevel - Current garden level
 * @param plantType - Type of plant ('flower', 'sprout', or 'decay')
 * @returns Modifier multiplier (< 1 = fade slower, > 1 = fade faster)
 */
export function getGardenLevelFadeModifier(
  gardenLevel: number,
  plantType: 'flower' | 'sprout' | 'decay'
): number {
  // Maximum modifier effect (±50% = 0.5 to 1.5 multiplier)
  const maxModifier = 0.5;

  // Normalize garden level to roughly -1 to 1 range
  // This determines how strong the effect is
  const normalizedLevel = Math.max(-1, Math.min(1, gardenLevel / 5));

  if (plantType === 'flower') {
    // Negative garden level (lush) → flowers fade slower (multiplier < 1)
    // Positive garden level (barren) → flowers fade faster (multiplier > 1)
    return 1 + normalizedLevel * maxModifier;
  } else if (plantType === 'decay') {
    // Positive garden level (barren) → decays fade slower (multiplier < 1)
    // Negative garden level (lush) → decays fade faster (multiplier > 1)
    return 1 - normalizedLevel * maxModifier;
  } else {
    // Sprouts are neutral - no garden level modifier
    return 1.0;
  }
}
