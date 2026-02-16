import type { MoodEntry, MoodEntryWithPercentile } from '../types';

/**
 * Percentile-based scale calculation for Inverse Garden
 *
 * Why percentiles?
 * ----------------
 * Raw valence values in the mood data tend to cluster (many entries near -0.5 to -0.7).
 * If we use linear scaling directly from |valence|, most plants end up similar sizes.
 *
 * By using percentile ranks WITHIN each plant type:
 * - The smallest 10% of flower valences get scales near 0.7
 * - The largest 10% of flower valences get scales near 1.5
 * - This ensures visual variety regardless of how the actual values cluster
 *
 * How it works:
 * 1. Separate entries by plant type (flower, sprout, decay)
 * 2. Sort each group by |valence|
 * 3. Assign percentile rank (0-100) based on position in sorted list
 * 4. Sprouts get fixed percentile (50) since they have minimal variation
 */

/**
 * Check if an entry should become a flower (negative valence)
 */
function isFlower(classification: string): boolean {
  const c = classification.toLowerCase();
  return c.includes('unpleasant');
}

/**
 * Check if an entry should become a decay (positive valence)
 */
function isDecay(classification: string): boolean {
  const c = classification.toLowerCase();
  return c.includes('pleasant') && !c.includes('unpleasant');
}

/**
 * Check if an entry should become a sprout (neutral)
 */
function isNeutral(classification: string): boolean {
  return classification.toLowerCase() === 'neutral';
}

/**
 * Assign percentile ranks to a group of entries based on |valence|
 *
 * @param group - Entries of the same plant type
 * @returns Entries with scalePercentile assigned
 */
function assignPercentiles(group: MoodEntry[]): MoodEntryWithPercentile[] {
  if (group.length === 0) return [];

  // Single entry gets middle percentile
  if (group.length === 1) {
    return [{ ...group[0], scalePercentile: 50 }];
  }

  // Sort by absolute valence (ascending - smallest intensity first)
  const sorted = [...group].sort((a, b) => Math.abs(a.valence) - Math.abs(b.valence));

  // Assign percentile based on position
  // Index 0 (smallest |valence|) → percentile 0
  // Index n-1 (largest |valence|) → percentile 100
  return sorted.map((entry, index) => ({
    ...entry,
    scalePercentile: (index / (sorted.length - 1)) * 100,
  }));
}

/**
 * Calculate percentiles for all entries
 *
 * This should be called once when data is loaded, not on every render.
 * The percentile is stored with each entry and used later for scale calculation.
 *
 * @param entries - Raw parsed entries from CSV
 * @returns Entries with scalePercentile field added
 */
export function calculatePercentiles(entries: MoodEntry[]): MoodEntryWithPercentile[] {
  // Debug: log first few entries to see what we're getting
  console.log('calculatePercentiles received', entries.length, 'entries');
  if (entries.length > 0) {
    console.log('First entry valenceClassification:', JSON.stringify(entries[0].valenceClassification));
    console.log('Sample classifications:', entries.slice(0, 5).map(e => e.valenceClassification));
  }

  // Only plant-spawning entries participate in percentile ranking
  // Daily Mood entries control atmosphere + garden level, not plant spawning (per GDD)
  const plantEntries = entries.filter(e => e.kind !== 'Daily Mood');

  // Separate by component type
  const flowers = plantEntries.filter(e => isFlower(e.valenceClassification));
  const decays = plantEntries.filter(e => isDecay(e.valenceClassification));
  const sprouts = plantEntries.filter(e => isNeutral(e.valenceClassification));

  // Log distribution for debugging
  console.log(`Percentile calculation: ${flowers.length} flowers, ${sprouts.length} sprouts, ${decays.length} decays`);

  // Assign percentiles within each group
  const flowersWithPercentile = assignPercentiles(flowers);
  const decaysWithPercentile = assignPercentiles(decays);

  // Sprouts get fixed middle percentile (they have minimal variation)
  const sproutsWithPercentile: MoodEntryWithPercentile[] = sprouts.map(e => ({
    ...e,
    scalePercentile: 50,
  }));

  // Daily Mood entries get default percentile (they don't spawn plants)
  const dailyMoodEntries: MoodEntryWithPercentile[] = entries
    .filter(e => e.kind === 'Daily Mood')
    .map(e => ({ ...e, scalePercentile: 50 }));

  // Combine all entries back together
  // Note: Order doesn't matter here since we'll look them up by ID later
  return [
    ...flowersWithPercentile,
    ...decaysWithPercentile,
    ...sproutsWithPercentile,
    ...dailyMoodEntries,
  ];
}

/**
 * Convert a percentile (0-100) to a scale value within a range
 *
 * @param percentile - 0 to 100
 * @param min - Minimum scale value
 * @param max - Maximum scale value
 * @returns Scale value between min and max
 */
export function percentileToScale(percentile: number, min: number, max: number): number {
  return min + (percentile / 100) * (max - min);
}
