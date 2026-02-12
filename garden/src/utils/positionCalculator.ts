import type { MoodEntryWithPercentile } from '../types';
import { PLANT_BOUNDS } from '../config/environmentConfig';
import { PATCH_CONFIG } from '../config/patchConfig';
import { getEffectiveLifespan } from './plantFading';

/**
 * Patch-Based Plant Positioning System
 *
 * Replaces the spiral-scatter system with a patch-grid approach:
 *
 * 1. Generate ~28 patches as a jittered grid across the planting bed
 * 2. Order patches in serpentine (back-and-forth row sweep)
 * 3. Assign each calendar day to a patch, reusing freed patches
 * 4. Position entries within their patch using ring-based layouts
 *
 * All randomness is seeded for reproducibility.
 * Positions are calculated ONCE at data load time.
 */

// ============================================
// TYPES
// ============================================

interface Patch {
  id: number;
  center: [number, number]; // [x, z]
  assignedDay: string | null; // YYYY-MM-DD or null if unassigned
  plantIds: string[];
  freedAtMs: number; // timestamp when all plants in this patch have fully faded
}

// Exported for debug overlay
export interface PatchDebugInfo {
  id: number;
  center: [number, number];
  radius: number;
  assignedDay: string | null;
  plantCount: number;
  freedAtMs: number;
}

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
 */
function dateStringToSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Get the date string (YYYY-MM-DD) from a timestamp
 */
function getDateString(timestamp: Date): string {
  return timestamp.toISOString().split('T')[0];
}

// ============================================
// STEP 1: GENERATE PATCHES
// ============================================

// Rectangular half-extents for patch placement (inset from PLANT_BOUNDS edges)
const HALF_W = PLANT_BOUNDS.width / 2 - 2; // 15
const HALF_D = PLANT_BOUNDS.depth / 2 - 2; // 12

/**
 * Generate patches as a jittered grid across the planting bed.
 *
 * Creates a 5×6 base grid, jitters each point, and filters to
 * stay within bounds. Result: ~25-28 organic-feeling patch positions.
 */
function generatePatches(seed: number): Patch[] {
  const random = createSeededRandom(seed);

  const cols = 5;
  const rows = 6;

  // Effective area: 2*HALF_W × 2*HALF_D = 30 × 24
  const cellW = (2 * HALF_W) / cols; // 6.0
  const cellD = (2 * HALF_D) / rows; // 4.0

  const patches: Patch[] = [];
  let id = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Base grid position (center of each cell)
      const baseX = -HALF_W + (col + 0.5) * cellW;
      const baseZ = -HALF_D + (row + 0.5) * cellD;

      // Jitter: random offset within ±(jitter * cellSize)
      const jitterX = (random() - 0.5) * 2 * PATCH_CONFIG.gridJitter * cellW;
      const jitterZ = (random() - 0.5) * 2 * PATCH_CONFIG.gridJitter * cellD;

      const x = baseX + jitterX;
      const z = baseZ + jitterZ;

      // Only keep if within bounds
      if (x >= -HALF_W && x <= HALF_W && z >= -HALF_D && z <= HALF_D) {
        patches.push({
          id: id++,
          center: [x, z],
          assignedDay: null,
          plantIds: [],
          freedAtMs: 0,
        });
      }
    }
  }

  return patches;
}

// ============================================
// STEP 2: SERPENTINE ORDERING
// ============================================

/**
 * Order patches in serpentine fill order.
 *
 * Groups by approximate row (z-coordinate bands), then alternates
 * left-to-right and right-to-left across rows. This creates
 * temporal-spatial locality: time sweeps across the bed.
 */
function orderPatchesSerpentine(patches: Patch[]): Patch[] {
  if (patches.length === 0) return [];

  // Find z-range and divide into row bands
  const zValues = patches.map(p => p.center[1]);
  const minZ = Math.min(...zValues);
  const maxZ = Math.max(...zValues);
  const zRange = maxZ - minZ;

  // Use 6 row bands (matching our grid rows)
  const rowCount = 6;
  const bandHeight = zRange / rowCount;

  // Assign each patch to a row band
  const rowBuckets: Patch[][] = Array.from({ length: rowCount }, () => []);
  for (const patch of patches) {
    let rowIndex = Math.floor((patch.center[1] - minZ) / bandHeight);
    rowIndex = Math.min(rowIndex, rowCount - 1); // clamp
    rowBuckets[rowIndex].push(patch);
  }

  // Sort within each row by x, alternating direction
  const ordered: Patch[] = [];
  for (let row = 0; row < rowCount; row++) {
    const bucket = rowBuckets[row];
    bucket.sort((a, b) => a.center[0] - b.center[0]);
    if (row % 2 === 1) {
      bucket.reverse(); // Odd rows go right-to-left
    }
    ordered.push(...bucket);
  }

  return ordered;
}

// ============================================
// STEP 3: SIMULATE TIMELINE FOR PATCH REUSE
// ============================================

/**
 * Assign each calendar day to a patch.
 *
 * Walks through days chronologically, assigning each to the next
 * available patch in serpentine order. When all patches are used,
 * reuses the earliest-freed patch.
 *
 * Uses getEffectiveLifespan from plantFading.ts to estimate when
 * plants will fully fade (at neutral garden level, modifier = 1.0).
 */
function simulateTimeline(
  patches: Patch[],
  entriesByDate: Map<string, MoodEntryWithPercentile[]>,
  sortedDays: string[]
): Map<string, number> {
  // Map from day string to patch index
  const dayToPatch = new Map<string, number>();

  // Track which patches are available via a simple scan
  let nextUnusedIndex = 0;

  for (const dayStr of sortedDays) {
    const dayEntries = entriesByDate.get(dayStr)!;
    const dayFirstEntryMs = dayEntries[0].timestamp.getTime();

    let assignedPatchIndex = -1;

    // First: try the next unassigned patch
    if (nextUnusedIndex < patches.length) {
      assignedPatchIndex = nextUnusedIndex;
      nextUnusedIndex++;
    } else {
      // All patches used — find one that's freed
      // Look for the patch that freed earliest and is available
      let earliestFreed = Infinity;
      let earliestFreedIndex = -1;

      for (let i = 0; i < patches.length; i++) {
        const patch = patches[i];
        if (
          patch.freedAtMs > 0 &&
          patch.freedAtMs < dayFirstEntryMs &&
          patch.freedAtMs < earliestFreed
        ) {
          earliestFreed = patch.freedAtMs;
          earliestFreedIndex = i;
        }
      }

      if (earliestFreedIndex >= 0) {
        assignedPatchIndex = earliestFreedIndex;
      } else {
        // Fallback: force reuse of the oldest assigned patch
        let oldestAssignMs = Infinity;
        let oldestIndex = 0;
        for (let i = 0; i < patches.length; i++) {
          const patch = patches[i];
          if (patch.assignedDay) {
            const assignedEntries = entriesByDate.get(patch.assignedDay);
            if (assignedEntries) {
              const assignMs = assignedEntries[0].timestamp.getTime();
              if (assignMs < oldestAssignMs) {
                oldestAssignMs = assignMs;
                oldestIndex = i;
              }
            }
          }
        }
        assignedPatchIndex = oldestIndex;
      }
    }

    // Assign this day to the patch
    const patch = patches[assignedPatchIndex];
    patch.assignedDay = dayStr;
    patch.plantIds = dayEntries.map(e => e.id);

    // Estimate when this patch's plants will be fully faded
    // Take the LATEST entry's timestamp + LONGEST lifespan
    let latestFadeMs = 0;
    for (const entry of dayEntries) {
      const lifespanMs = getEffectiveLifespan(entry.valence);
      const fadeMs = entry.timestamp.getTime() + lifespanMs;
      if (fadeMs > latestFadeMs) {
        latestFadeMs = fadeMs;
      }
    }

    // Add grace period
    const graceMs = PATCH_CONFIG.reuseGraceDays * 24 * 60 * 60 * 1000;
    patch.freedAtMs = latestFadeMs + graceMs;

    dayToPatch.set(dayStr, assignedPatchIndex);
  }

  return dayToPatch;
}

// ============================================
// STEP 4: POSITION ENTRIES WITHIN A PATCH
// ============================================

/**
 * Position entries within their assigned patch using ring-based layouts.
 *
 * | Count | Layout     | Details                                           |
 * |-------|------------|---------------------------------------------------|
 * | 1     | Center     | Small seeded offset ±0.5 from patch center        |
 * | 2-3   | Circle     | Radius = stemSpacing/2, evenly spaced angles      |
 * | 4-6   | Dual ring  | 1-2 inner (r~1.4), rest outer (r~2.8)            |
 */
function positionEntriesInPatch(
  entries: MoodEntryWithPercentile[],
  patchCenter: [number, number],
  patchRadius: number
): Map<string, [number, number, number]> {
  const positions = new Map<string, [number, number, number]>();
  const count = entries.length;

  if (count === 0) return positions;

  // Use first entry's timestamp as seed for deterministic layout
  const random = createSeededRandom(timestampToSeed(entries[0].timestamp) + dateStringToSeed(getDateString(entries[0].timestamp)));

  if (count === 1) {
    // Single entry: small offset from center
    const offsetX = (random() - 0.5) * 1.0;
    const offsetZ = (random() - 0.5) * 1.0;
    const x = clampToBounds(patchCenter[0] + offsetX, patchCenter[1] + offsetZ)[0];
    const z = clampToBounds(patchCenter[0] + offsetX, patchCenter[1] + offsetZ)[1];
    positions.set(entries[0].id, [x, 0, z]);
  } else if (count <= 3) {
    // 2-3 entries: single ring
    const radius = Math.min(PATCH_CONFIG.stemSpacing / 2, patchRadius * 0.5);
    const baseAngle = random() * Math.PI * 2;
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + i * angleStep;
      const x = patchCenter[0] + Math.cos(angle) * radius;
      const z = patchCenter[1] + Math.sin(angle) * radius;
      const [cx, cz] = clampToBounds(x, z);
      positions.set(entries[i].id, [cx, 0, cz]);
    }
  } else {
    // 4-6 entries: dual ring
    const innerCount = Math.min(2, Math.floor(count / 2));
    const outerCount = count - innerCount;

    const innerRadius = Math.min(PATCH_CONFIG.stemSpacing * 0.4, patchRadius * 0.35);
    const outerRadius = Math.min(PATCH_CONFIG.stemSpacing * 0.8, patchRadius * 0.7);

    // Inner ring
    const innerBaseAngle = random() * Math.PI * 2;
    const innerAngleStep = (Math.PI * 2) / innerCount;
    for (let i = 0; i < innerCount; i++) {
      const angle = innerBaseAngle + i * innerAngleStep;
      const x = patchCenter[0] + Math.cos(angle) * innerRadius;
      const z = patchCenter[1] + Math.sin(angle) * innerRadius;
      const [cx, cz] = clampToBounds(x, z);
      positions.set(entries[i].id, [cx, 0, cz]);
    }

    // Outer ring — offset from inner to avoid radial alignment
    const outerBaseAngle = innerBaseAngle + Math.PI / outerCount;
    const outerAngleStep = (Math.PI * 2) / outerCount;
    for (let i = 0; i < outerCount; i++) {
      const angle = outerBaseAngle + i * outerAngleStep;
      const x = patchCenter[0] + Math.cos(angle) * outerRadius;
      const z = patchCenter[1] + Math.sin(angle) * outerRadius;
      const [cx, cz] = clampToBounds(x, z);
      positions.set(entries[innerCount + i].id, [cx, 0, cz]);
    }
  }

  return positions;
}

/**
 * Clamp a position to the rectangular plant bounds.
 */
function clampToBounds(x: number, z: number): [number, number] {
  return [
    Math.max(-HALF_W, Math.min(HALF_W, x)),
    Math.max(-HALF_D, Math.min(HALF_D, z)),
  ];
}

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Calculate stable positions for all entries using the patch-based system.
 *
 * Called ONCE at data load time. Returns a Map from entry ID to [x, y, z].
 * Same signature as previous spiral implementation.
 */
export function calculatePositions(
  entries: MoodEntryWithPercentile[]
): Map<string, [number, number, number]> {
  if (entries.length === 0) {
    return new Map();
  }

  // --- Step 1: Generate patches ---
  const patches = generatePatches(PATCH_CONFIG.seed);

  // --- Step 2: Order patches serpentine ---
  const orderedPatches = orderPatchesSerpentine(patches);

  // --- Step 3: Group entries by date ---
  const entriesByDate = new Map<string, MoodEntryWithPercentile[]>();
  for (const entry of entries) {
    const dateStr = getDateString(entry.timestamp);
    if (!entriesByDate.has(dateStr)) {
      entriesByDate.set(dateStr, []);
    }
    entriesByDate.get(dateStr)!.push(entry);
  }

  // Sort days chronologically
  const sortedDays = Array.from(entriesByDate.keys()).sort();

  // --- Step 4: Simulate timeline to assign days → patches ---
  const dayToPatch = simulateTimeline(orderedPatches, entriesByDate, sortedDays);

  // --- Step 5: Position entries within their patches ---
  const positions = new Map<string, [number, number, number]>();

  for (const [dayStr, dayEntries] of entriesByDate) {
    const patchIndex = dayToPatch.get(dayStr);
    if (patchIndex === undefined) continue;

    const patch = orderedPatches[patchIndex];
    const patchPositions = positionEntriesInPatch(
      dayEntries,
      patch.center,
      PATCH_CONFIG.patchRadius
    );

    for (const [id, pos] of patchPositions) {
      positions.set(id, pos);
    }
  }

  return positions;
}

/**
 * Get patch debug info for the overlay visualization.
 * Call after calculatePositions to get the current patch state.
 */
let _lastPatches: Patch[] = [];
let _lastDayToPatch: Map<string, number> = new Map();

export function calculatePositionsWithDebug(
  entries: MoodEntryWithPercentile[]
): { positions: Map<string, [number, number, number]>; patches: PatchDebugInfo[] } {
  if (entries.length === 0) {
    return { positions: new Map(), patches: [] };
  }

  // --- Step 1: Generate patches ---
  const patches = generatePatches(PATCH_CONFIG.seed);

  // --- Step 2: Order patches serpentine ---
  const orderedPatches = orderPatchesSerpentine(patches);

  // --- Step 3: Group entries by date ---
  const entriesByDate = new Map<string, MoodEntryWithPercentile[]>();
  for (const entry of entries) {
    const dateStr = getDateString(entry.timestamp);
    if (!entriesByDate.has(dateStr)) {
      entriesByDate.set(dateStr, []);
    }
    entriesByDate.get(dateStr)!.push(entry);
  }

  const sortedDays = Array.from(entriesByDate.keys()).sort();

  // --- Step 4: Simulate timeline ---
  const dayToPatch = simulateTimeline(orderedPatches, entriesByDate, sortedDays);

  // Store for debug
  _lastPatches = orderedPatches;
  _lastDayToPatch = dayToPatch;

  // --- Step 5: Position entries ---
  const positions = new Map<string, [number, number, number]>();

  for (const [dayStr, dayEntries] of entriesByDate) {
    const patchIndex = dayToPatch.get(dayStr);
    if (patchIndex === undefined) continue;

    const patch = orderedPatches[patchIndex];
    const patchPositions = positionEntriesInPatch(
      dayEntries,
      patch.center,
      PATCH_CONFIG.patchRadius
    );

    for (const [id, pos] of patchPositions) {
      positions.set(id, pos);
    }
  }

  // Build debug info
  const debugPatches: PatchDebugInfo[] = orderedPatches.map(p => ({
    id: p.id,
    center: p.center,
    radius: PATCH_CONFIG.patchRadius,
    assignedDay: p.assignedDay,
    plantCount: p.plantIds.length,
    freedAtMs: p.freedAtMs,
  }));

  return { positions, patches: debugPatches };
}

/**
 * Get configuration values (for debugging or UI display)
 */
export function getLayoutConfig() {
  return { ...PATCH_CONFIG };
}

// ============================================
// LEGACY: Spiral-scatter system (kept for A/B comparison)
// ============================================

const SPIRAL_CONFIG = {
  gardenRadius: 12,
  spiralRotations: 3.5,
  dayScatterRadius: 2,
  entryScatterRadius: 1.5,
  minEntrySpacing: 0.8,
  minStemDistance: 2.0,
};

function spiralPoint(progress: number): [number, number] {
  const maxAngle = SPIRAL_CONFIG.spiralRotations * 2 * Math.PI;
  const angle = progress * maxAngle;
  const minRadius = SPIRAL_CONFIG.gardenRadius * 0.1;
  const maxRadius = SPIRAL_CONFIG.gardenRadius * 0.85;
  const radius = minRadius + progress * (maxRadius - minRadius);
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

export function calculatePositions_spiral(
  entries: MoodEntryWithPercentile[]
): Map<string, [number, number, number]> {
  if (entries.length === 0) return new Map();

  const positions = new Map<string, [number, number, number]>();
  const earliestTime = entries[0].timestamp.getTime();
  const latestTime = entries[entries.length - 1].timestamp.getTime();
  const totalTimeSpan = latestTime - earliestTime;

  const entriesByDate = new Map<string, MoodEntryWithPercentile[]>();
  for (const entry of entries) {
    const dateStr = getDateString(entry.timestamp);
    if (!entriesByDate.has(dateStr)) entriesByDate.set(dateStr, []);
    entriesByDate.get(dateStr)!.push(entry);
  }

  const dayPositions = new Map<string, [number, number]>();
  for (const [dateStr, dayEntries] of entriesByDate) {
    const dayTimestamp = dayEntries[0].timestamp.getTime();
    const progress = totalTimeSpan > 0 ? (dayTimestamp - earliestTime) / totalTimeSpan : 0.5;
    const [spiralX, spiralZ] = spiralPoint(progress);
    const dayRandom = createSeededRandom(dateStringToSeed(dateStr));
    const scatterAngle = dayRandom() * 2 * Math.PI;
    const scatterDistance = dayRandom() * SPIRAL_CONFIG.dayScatterRadius;
    const dayX = Math.max(-HALF_W, Math.min(HALF_W, spiralX + Math.cos(scatterAngle) * scatterDistance));
    const dayZ = Math.max(-HALF_D, Math.min(HALF_D, spiralZ + Math.sin(scatterAngle) * scatterDistance));
    dayPositions.set(dateStr, [dayX, dayZ]);
  }

  const allPlaced: [number, number][] = [];
  function hasCollision(x: number, z: number): boolean {
    return allPlaced.some(([px, pz]) => Math.sqrt((x - px) ** 2 + (z - pz) ** 2) < SPIRAL_CONFIG.minStemDistance);
  }
  function nudge(x: number, z: number, random: () => number): [number, number] {
    let nx = x, nz = z, attempts = 0;
    while (hasCollision(nx, nz) && attempts < 50) {
      const dist = Math.sqrt(nx * nx + nz * nz);
      const angle = dist > 0.01 ? Math.atan2(nz, nx) : random() * Math.PI * 2;
      const nudgeAngle = angle + (random() - 0.5) * Math.PI * 0.5;
      nx += Math.cos(nudgeAngle) * SPIRAL_CONFIG.minStemDistance * 0.5;
      nz += Math.sin(nudgeAngle) * SPIRAL_CONFIG.minStemDistance * 0.5;
      nx = Math.max(-HALF_W, Math.min(HALF_W, nx));
      nz = Math.max(-HALF_D, Math.min(HALF_D, nz));
      attempts++;
    }
    return [nx, nz];
  }

  for (const [dateStr, dayEntries] of entriesByDate) {
    const [dayX, dayZ] = dayPositions.get(dateStr)!;
    if (dayEntries.length === 1) {
      const entryRandom = createSeededRandom(timestampToSeed(dayEntries[0].timestamp));
      const [fx, fz] = nudge(dayX, dayZ, entryRandom);
      allPlaced.push([fx, fz]);
      positions.set(dayEntries[0].id, [fx, 0, fz]);
    } else {
      for (const entry of dayEntries) {
        const entryRandom = createSeededRandom(timestampToSeed(entry.timestamp));
        const angle = entryRandom() * 2 * Math.PI;
        const distance = entryRandom() * SPIRAL_CONFIG.entryScatterRadius;
        let ex = dayX + Math.cos(angle) * distance;
        let ez = dayZ + Math.sin(angle) * distance;
        [ex, ez] = nudge(ex, ez, entryRandom);
        allPlaced.push([ex, ez]);
        positions.set(entry.id, [ex, 0, ez]);
      }
    }
  }

  return positions;
}
