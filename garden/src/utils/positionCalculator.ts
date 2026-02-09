import type { MoodEntryWithPercentile } from '../types';
import { PLANT_BOUNDS } from '../config/environmentConfig';

/**
 * Spatial Layout: Subtle Temporal Spiral with Scatter
 *
 * Creates stable, reproducible positions for all plants using a three-level system:
 *
 * 1. Spiral base: Each calendar day maps to a position along a spiral path
 *    - Day 1 → near center, Day N → toward edge
 *    - Spiral overlaps itself (3.5 rotations) so it's not an obvious outward path
 *
 * 2. Day scatter: Each day's position is randomly offset from its spiral position
 *    - Breaks up the spiral so it's not visually obvious
 *    - Adjacent days might end up far apart
 *
 * 3. Entry scatter: Entries within a day cluster tightly around the day's position
 *    - Multiple entries on same day form a small clump
 *    - Tight enough to read as "same moment in time"
 *
 * All randomness is seeded from timestamps for reproducibility.
 * Positions are clamped to fit within the ExcavatedBed rectangular bounds.
 */

// ============================================
// CONFIGURATION
// ============================================

// Rectangular half-extents for plant placement (inset from PLANT_BOUNDS edges)
const HALF_W = PLANT_BOUNDS.width / 2 - 2; // 15
const HALF_D = PLANT_BOUNDS.depth / 2 - 2; // 12

const CONFIG = {
  gardenRadius: 12,            // Spiral radius (fits within rectangular depth)
  spiralRotations: 3.5,       // How many times spiral wraps around
  dayScatterRadius: 2,        // How far a day drifts from spiral position
  entryScatterRadius: 1.5,    // How far entries spread within a day
  minEntrySpacing: 0.8,       // Minimum distance between entries in same day cluster
  minStemDistance: 2.0,       // Global minimum distance between ANY two plant stems
};

// ============================================
// SEEDED RANDOM NUMBER GENERATOR
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

/**
 * Generate a seed from a timestamp
 */
function timestampToSeed(timestamp: Date): number {
  return timestamp.getTime();
}

/**
 * Generate a seed from a date string (YYYY-MM-DD)
 * Used for day-level scatter so all entries on same day share the same day scatter
 */
function dateStringToSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// ============================================
// SPIRAL CALCULATION
// ============================================

/**
 * Calculate a point on the spiral for a given progress (0-1)
 * Uses Archimedean spiral: r = a + b*θ
 *
 * @param progress - 0 = center, 1 = edge
 * @returns [x, z] coordinates on the XZ plane
 */
function spiralPoint(progress: number): [number, number] {
  const maxAngle = CONFIG.spiralRotations * 2 * Math.PI;
  const angle = progress * maxAngle;

  // Radius grows from near-center to edge
  // Start at 10% of radius to avoid exact center clustering
  const minRadius = CONFIG.gardenRadius * 0.1;
  const maxRadius = CONFIG.gardenRadius * 0.85; // Leave some margin at edge
  const radius = minRadius + progress * (maxRadius - minRadius);

  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  return [x, z];
}

// ============================================
// POSITION CALCULATION
// ============================================

/**
 * Get the date string (YYYY-MM-DD) from a timestamp
 */
function getDateString(timestamp: Date): string {
  return timestamp.toISOString().split('T')[0];
}

/**
 * Calculate stable positions for all entries
 *
 * This should be called ONCE at data load time, not per frame.
 * Returns a Map from entry ID to [x, y, z] position.
 *
 * @param entries - All mood entries (should already be sorted by timestamp)
 * @returns Map of entry ID → position tuple
 */
export function calculatePositions(
  entries: MoodEntryWithPercentile[]
): Map<string, [number, number, number]> {
  if (entries.length === 0) {
    return new Map();
  }

  const positions = new Map<string, [number, number, number]>();

  // Get the date range
  const earliestTime = entries[0].timestamp.getTime();
  const latestTime = entries[entries.length - 1].timestamp.getTime();
  const totalTimeSpan = latestTime - earliestTime;

  // Group entries by date for cluster handling
  const entriesByDate = new Map<string, MoodEntryWithPercentile[]>();
  for (const entry of entries) {
    const dateStr = getDateString(entry.timestamp);
    if (!entriesByDate.has(dateStr)) {
      entriesByDate.set(dateStr, []);
    }
    entriesByDate.get(dateStr)!.push(entry);
  }

  // Calculate day scatter positions (one per unique date)
  const dayPositions = new Map<string, [number, number]>();

  for (const [dateStr, dayEntries] of entriesByDate) {
    // Use the first entry's timestamp for spiral progress
    const dayTimestamp = dayEntries[0].timestamp.getTime();
    const progress = totalTimeSpan > 0
      ? (dayTimestamp - earliestTime) / totalTimeSpan
      : 0.5;

    // Get base spiral position for this day
    const [spiralX, spiralZ] = spiralPoint(progress);

    // Apply day-level scatter (seeded by date string)
    const dayRandom = createSeededRandom(dateStringToSeed(dateStr));

    // Random offset in a circle around the spiral point
    const scatterAngle = dayRandom() * 2 * Math.PI;
    const scatterDistance = dayRandom() * CONFIG.dayScatterRadius;

    const dayX = spiralX + Math.cos(scatterAngle) * scatterDistance;
    const dayZ = spiralZ + Math.sin(scatterAngle) * scatterDistance;

    // Clamp to rectangular plant bounds
    const clampedX = Math.max(-HALF_W, Math.min(HALF_W, dayX));
    const clampedZ = Math.max(-HALF_D, Math.min(HALF_D, dayZ));
    dayPositions.set(dateStr, [clampedX, clampedZ]);
  }

  // Track ALL placed positions globally for collision detection
  const allPlacedPositions: [number, number][] = [];

  /**
   * Check if a position collides with any already-placed position
   * Returns true if too close to any existing plant
   */
  function hasGlobalCollision(x: number, z: number): boolean {
    return allPlacedPositions.some(([px, pz]) => {
      const dx = x - px;
      const dz = z - pz;
      return Math.sqrt(dx * dx + dz * dz) < CONFIG.minStemDistance;
    });
  }

  /**
   * Nudge a position outward from center until it's clear of collisions
   * Returns the adjusted [x, z] position
   */
  function nudgeUntilClear(x: number, z: number, random: () => number): [number, number] {
    let nudgeX = x;
    let nudgeZ = z;
    let attempts = 0;
    const maxAttempts = 50;

    while (hasGlobalCollision(nudgeX, nudgeZ) && attempts < maxAttempts) {
      // Calculate direction from center
      const dist = Math.sqrt(nudgeX * nudgeX + nudgeZ * nudgeZ);
      const angle = dist > 0.01 ? Math.atan2(nudgeZ, nudgeX) : random() * Math.PI * 2;

      // Add some randomness to the nudge direction
      const nudgeAngle = angle + (random() - 0.5) * Math.PI * 0.5;
      const nudgeDistance = CONFIG.minStemDistance * 0.5;

      nudgeX += Math.cos(nudgeAngle) * nudgeDistance;
      nudgeZ += Math.sin(nudgeAngle) * nudgeDistance;

      // Clamp to rectangular plant bounds
      nudgeX = Math.max(-HALF_W, Math.min(HALF_W, nudgeX));
      nudgeZ = Math.max(-HALF_D, Math.min(HALF_D, nudgeZ));

      attempts++;
    }

    return [nudgeX, nudgeZ];
  }

  // Now assign positions to individual entries with global collision detection
  for (const [dateStr, dayEntries] of entriesByDate) {
    const [dayX, dayZ] = dayPositions.get(dateStr)!;

    if (dayEntries.length === 1) {
      // Single entry on this day - use day position, but check for global collision
      const entryRandom = createSeededRandom(timestampToSeed(dayEntries[0].timestamp));
      const [finalX, finalZ] = nudgeUntilClear(dayX, dayZ, entryRandom);
      allPlacedPositions.push([finalX, finalZ]);
      positions.set(dayEntries[0].id, [finalX, 0, finalZ]);
    } else {
      // Multiple entries - scatter them around the day position
      for (const entry of dayEntries) {
        // Seed random from entry's specific timestamp
        const entryRandom = createSeededRandom(timestampToSeed(entry.timestamp));

        // Start with scatter around day position
        const angle = entryRandom() * 2 * Math.PI;
        const distance = entryRandom() * CONFIG.entryScatterRadius;

        let entryX = dayX + Math.cos(angle) * distance;
        let entryZ = dayZ + Math.sin(angle) * distance;

        // Check and resolve global collision
        [entryX, entryZ] = nudgeUntilClear(entryX, entryZ, entryRandom);

        allPlacedPositions.push([entryX, entryZ]);
        positions.set(entry.id, [entryX, 0, entryZ]);
      }
    }
  }

  return positions;
}

/**
 * Get configuration values (for debugging or UI display)
 */
export function getLayoutConfig() {
  return { ...CONFIG };
}
