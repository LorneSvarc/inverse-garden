import type { MoodEntryWithPercentile } from '../types';
import { PLANT_BOUNDS, LAYOUT_CONFIG } from '../config/environmentConfig';
import { getPlantType, calculateScaleFromPercentile } from './dnaMapper';

// Approximate horizontal bloom radius at scale 1.0
// These match current defaults in dnaMapper.ts — update when flowers become unique
const BLOOM_RADIUS_AT_SCALE_1: Record<string, number> = {
  flower: 1.2,    // FLOWER_DEFAULTS.petalLength (petals extend this far from center)
  decay: 0.35,    // FALLEN_BLOOM_DEFAULTS.petalLength
  sprout: 0.15,   // negligible
};

/**
 * Week-Per-Row Plant Positioning System
 *
 * Calendar-structured layout where time is readable at every scale:
 * - Each calendar week maps to one spatial row (back-to-front, oldest→newest)
 * - Within each row, days run left-to-right (Monday→Sunday)
 * - Within each day, entries cluster together using ring-based layouts
 *
 * All randomness is seeded for reproducibility.
 * Positions are calculated ONCE at data load time.
 */

// ============================================
// TYPES
// ============================================

export interface DaySummary {
  dateStr: string;
  entryCount: number;
  topEmotions: string[];       // top 2-3 by frequency
  center: [number, number, number]; // bounding box center of day's plants
}

export interface WeekSummary {
  weekIndex: number;
  startDate: Date;
  endDate: Date;
  flowerCount: number;
  sproutCount: number;
  decayCount: number;
  topEmotions: string[];       // top 2 by frequency for the week
  center: [number, number, number]; // bounding box center of week row
}

// Debug overlay info
export interface LayoutDebugInfo {
  weekRows: WeekRowDebug[];
  daySlots: DaySlotDebug[];
}

export interface WeekRowDebug {
  weekIndex: number;
  centerZ: number;
  startDate: string;
  endDate: string;
  entryCount: number;
}

export interface DaySlotDebug {
  dateStr: string;
  weekIndex: number;
  dayIndex: number;        // 0=Monday, 6=Sunday
  center: [number, number]; // [x, z]
  entryCount: number;
}

// ============================================
// SEEDED RANDOM NUMBER GENERATOR
// ============================================

function createSeededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function timestampToSeed(timestamp: Date): number {
  return timestamp.getTime();
}

function dateStringToSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getDateString(timestamp: Date): string {
  // Use local date (not UTC) to avoid timezone-shifted day boundaries
  const y = timestamp.getFullYear();
  const m = String(timestamp.getMonth() + 1).padStart(2, '0');
  const d = String(timestamp.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================
// LAYOUT MATH
// ============================================

const HALF_W = PLANT_BOUNDS.width / 2;   // 17
const HALF_D = PLANT_BOUNDS.depth / 2;   // 14

/**
 * Get the Monday of the week for a given date (ISO weeks start Monday).
 * Returns YYYY-MM-DD string for that Monday.
 */
function getWeekMonday(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
  // We want Monday as day 0: offset = (getDay() + 6) % 7
  const dayOfWeek = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayOfWeek);
  return getDateString(d);
}

/**
 * Get the day-of-week index (0=Monday, 6=Sunday) for a date.
 */
function getDayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Calculate row Z position for a given week index.
 * Row 0 (oldest) is at the back (negative Z, far from camera).
 * Last row (newest) is at the front (positive Z, close to camera).
 * Row spacing is dynamically calculated to fit all rows within PLANT_BOUNDS.
 */
function getRowZ(rowIndex: number, totalRows: number): number {
  const rowSpacing = Math.min(LAYOUT_CONFIG.rowSpacing, PLANT_BOUNDS.depth / Math.max(totalRows, 1));
  const totalDepthUsed = totalRows * rowSpacing;
  const marginZ = (PLANT_BOUNDS.depth - totalDepthUsed) / 2;
  // Row 0 = most negative Z (back), last row = most positive Z (front)
  return -HALF_D + marginZ + rowIndex * rowSpacing + rowSpacing / 2;
}

/**
 * Calculate slot X position for a given day index (0=Monday, 6=Sunday).
 * Monday is on the left, Sunday on the right.
 */
function getSlotX(dayIndex: number): number {
  const totalWidthUsed = LAYOUT_CONFIG.daysPerRow * LAYOUT_CONFIG.daySlotWidth;
  const marginX = (PLANT_BOUNDS.width - totalWidthUsed) / 2;
  return -HALF_W + marginX + dayIndex * LAYOUT_CONFIG.daySlotWidth + LAYOUT_CONFIG.daySlotWidth / 2;
}

// ============================================
// ENTRY CLUSTERING WITHIN A DAY SLOT
// ============================================

/**
 * Calculate the minimum ring radius so adjacent entries don't overlap.
 * For N entries on a ring, angular separation is 2π/N.
 * Two adjacent blooms overlap if: radius × 2 × sin(π/N) < maxBloomDiameter
 */
function minRingRadius(countOnRing: number, maxBloomDiameter: number): number {
  if (countOnRing <= 1) return 0;
  return maxBloomDiameter / (2 * Math.sin(Math.PI / countOnRing));
}

/**
 * Position entries within their day slot using ring-based layouts.
 * Entries are sorted by bloom radius (largest to outer rings) and ring radii
 * are inflated based on actual bloom widths to prevent overlap.
 *
 * | Count | Layout     | Details                                           |
 * |-------|------------|---------------------------------------------------|
 * | 1     | Center     | Small seeded offset from slot center              |
 * | 2-3   | Circle     | Evenly spaced, radius based on bloom width        |
 * | 4-6   | Dual ring  | Small inner, large outer                          |
 * | 7+    | Triple ring| Inner, middle, outer rings                        |
 */
function positionEntriesInDaySlot(
  entries: MoodEntryWithPercentile[],
  slotCenter: [number, number],
  clusterRadius: number,
  bloomRadii: number[]
): Map<string, [number, number, number]> {
  const positions = new Map<string, [number, number, number]>();
  const count = entries.length;

  if (count === 0) return positions;

  // Sort indices by bloom radius descending — largest blooms go to outer rings
  const sortedIndices = entries.map((_, i) => i)
    .sort((a, b) => bloomRadii[b] - bloomRadii[a]);

  const random = createSeededRandom(
    timestampToSeed(entries[0].timestamp) + dateStringToSeed(getDateString(entries[0].timestamp))
  );

  // Max radius cap: don't spill too far into adjacent slots
  const maxRadius = clusterRadius * 1.3;

  if (count === 1) {
    const idx = sortedIndices[0];
    const offsetX = (random() - 0.5) * 0.8;
    const offsetZ = (random() - 0.5) * 0.8;
    const [cx, cz] = clampToBounds(slotCenter[0] + offsetX, slotCenter[1] + offsetZ);
    positions.set(entries[idx].id, [cx, 0, cz]);
  } else if (count <= 3) {
    // All on one ring
    const maxBloom = Math.max(...sortedIndices.map(i => bloomRadii[i])) * 2;
    const baseRadius = clusterRadius * 0.4;
    const radius = Math.min(maxRadius, Math.max(baseRadius, minRingRadius(count, maxBloom)));
    const baseAngle = random() * Math.PI * 2;
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const idx = sortedIndices[i];
      const angle = baseAngle + i * angleStep;
      const x = slotCenter[0] + Math.cos(angle) * radius;
      const z = slotCenter[1] + Math.sin(angle) * radius;
      const [cx, cz] = clampToBounds(x, z);
      positions.set(entries[idx].id, [cx, 0, cz]);
    }
  } else if (count <= 6) {
    // Dual ring: smallest blooms inner, largest outer
    const innerCount = Math.min(2, Math.floor(count / 2));
    const outerCount = count - innerCount;
    const innerIndices = sortedIndices.slice(sortedIndices.length - innerCount); // smallest
    const outerIndices = sortedIndices.slice(0, outerCount); // largest

    const innerMaxBloom = Math.max(...innerIndices.map(i => bloomRadii[i])) * 2;
    const outerMaxBloom = Math.max(...outerIndices.map(i => bloomRadii[i])) * 2;

    const innerRadius = Math.min(maxRadius * 0.5, Math.max(clusterRadius * 0.2, minRingRadius(innerCount, innerMaxBloom)));
    const outerRadius = Math.min(maxRadius, Math.max(clusterRadius * 0.6, minRingRadius(outerCount, outerMaxBloom)));

    const innerBaseAngle = random() * Math.PI * 2;
    const innerAngleStep = (Math.PI * 2) / innerCount;
    for (let i = 0; i < innerCount; i++) {
      const idx = innerIndices[i];
      const angle = innerBaseAngle + i * innerAngleStep;
      const x = slotCenter[0] + Math.cos(angle) * innerRadius;
      const z = slotCenter[1] + Math.sin(angle) * innerRadius;
      const [cx, cz] = clampToBounds(x, z);
      positions.set(entries[idx].id, [cx, 0, cz]);
    }

    const outerBaseAngle = innerBaseAngle + Math.PI / outerCount;
    const outerAngleStep = (Math.PI * 2) / outerCount;
    for (let i = 0; i < outerCount; i++) {
      const idx = outerIndices[i];
      const angle = outerBaseAngle + i * outerAngleStep;
      const x = slotCenter[0] + Math.cos(angle) * outerRadius;
      const z = slotCenter[1] + Math.sin(angle) * outerRadius;
      const [cx, cz] = clampToBounds(x, z);
      positions.set(entries[idx].id, [cx, 0, cz]);
    }
  } else {
    // 7+ entries: triple ring
    const innerCount = 2;
    const middleCount = Math.min(4, count - innerCount);
    const outerCount = count - innerCount - middleCount;

    // Largest blooms → outer, smallest → inner
    const outerIndices = sortedIndices.slice(0, outerCount);
    const middleIndices = sortedIndices.slice(outerCount, outerCount + middleCount);
    const innerIndices = sortedIndices.slice(outerCount + middleCount);

    const innerMaxBloom = Math.max(...innerIndices.map(i => bloomRadii[i])) * 2;
    const middleMaxBloom = Math.max(...middleIndices.map(i => bloomRadii[i])) * 2;

    const innerRadius = Math.min(maxRadius * 0.3, Math.max(clusterRadius * 0.15, minRingRadius(innerCount, innerMaxBloom)));
    const middleRadius = Math.min(maxRadius * 0.6, Math.max(clusterRadius * 0.4, minRingRadius(middleCount, middleMaxBloom)));
    let outerRadius = clusterRadius * 0.85;
    if (outerCount > 0) {
      const outerMaxBloom = Math.max(...outerIndices.map(i => bloomRadii[i])) * 2;
      outerRadius = Math.min(maxRadius, Math.max(clusterRadius * 0.7, minRingRadius(outerCount, outerMaxBloom)));
    }

    const baseAngle = random() * Math.PI * 2;

    // Inner ring
    const innerStep = (Math.PI * 2) / innerCount;
    for (let i = 0; i < innerCount; i++) {
      const idx = innerIndices[i];
      const angle = baseAngle + i * innerStep;
      const x = slotCenter[0] + Math.cos(angle) * innerRadius;
      const z = slotCenter[1] + Math.sin(angle) * innerRadius;
      const [cx, cz] = clampToBounds(x, z);
      positions.set(entries[idx].id, [cx, 0, cz]);
    }

    // Middle ring
    const middleBaseAngle = baseAngle + Math.PI / middleCount;
    const middleStep = (Math.PI * 2) / middleCount;
    for (let i = 0; i < middleCount; i++) {
      const idx = middleIndices[i];
      const angle = middleBaseAngle + i * middleStep;
      const x = slotCenter[0] + Math.cos(angle) * middleRadius;
      const z = slotCenter[1] + Math.sin(angle) * middleRadius;
      const [cx, cz] = clampToBounds(x, z);
      positions.set(entries[idx].id, [cx, 0, cz]);
    }

    // Outer ring
    if (outerCount > 0) {
      const outerBaseAngle = baseAngle + Math.PI / (outerCount * 2);
      const outerStep = (Math.PI * 2) / outerCount;
      for (let i = 0; i < outerCount; i++) {
        const idx = outerIndices[i];
        const angle = outerBaseAngle + i * outerStep;
        const x = slotCenter[0] + Math.cos(angle) * outerRadius;
        const z = slotCenter[1] + Math.sin(angle) * outerRadius;
        const [cx, cz] = clampToBounds(x, z);
        positions.set(entries[idx].id, [cx, 0, cz]);
      }
    }
  }

  return positions;
}

/**
 * Clamp position to elliptical bounds matching the actual bed shape.
 * The bed is generated as an ellipse (ExcavatedBed's generateOrganicShape),
 * not a rectangle, so we use elliptical containment.
 */
function clampToBounds(x: number, z: number): [number, number] {
  const nx = x / HALF_W;
  const nz = z / HALF_D;
  const dist = nx * nx + nz * nz;

  if (dist <= 1) return [x, z]; // inside ellipse

  // Project onto ellipse boundary with slight inset so petals don't overshoot
  const scale = 0.95 / Math.sqrt(dist);
  return [x * scale, z * scale];
}

// ============================================
// EMOTION FREQUENCY HELPERS
// ============================================

/**
 * Count emotion frequencies across entries and return top N.
 */
function getTopEmotions(entries: MoodEntryWithPercentile[], topN: number): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const emotion of entry.emotions) {
      counts.set(emotion, (counts.get(emotion) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([emotion]) => emotion);
}

/**
 * Calculate bounding box center of positions.
 */
function boundingBoxCenter(positions: [number, number, number][]): [number, number, number] {
  if (positions.length === 0) return [0, 0, 0];
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const [x, y, z] of positions) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
}

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Calculate stable positions for all entries using the week-per-row layout.
 *
 * Called ONCE at data load time. Returns a Map from entry ID to [x, y, z].
 * Same signature as previous implementation — App.tsx does not need changes.
 */
export function calculatePositions(
  entries: MoodEntryWithPercentile[]
): Map<string, [number, number, number]> {
  if (entries.length === 0) {
    return new Map();
  }

  // --- Group entries by date ---
  const entriesByDate = new Map<string, MoodEntryWithPercentile[]>();
  for (const entry of entries) {
    const dateStr = getDateString(entry.timestamp);
    if (!entriesByDate.has(dateStr)) {
      entriesByDate.set(dateStr, []);
    }
    entriesByDate.get(dateStr)!.push(entry);
  }

  // --- Assign days to weeks ---
  const weekMondaySet = new Set<string>();
  const dayToWeekMonday = new Map<string, string>();

  for (const [dateStr, dayEntries] of entriesByDate) {
    const monday = getWeekMonday(dayEntries[0].timestamp);
    weekMondaySet.add(monday);
    dayToWeekMonday.set(dateStr, monday);
  }

  // Sort week Mondays chronologically → rowIndex
  const sortedWeekMondays = Array.from(weekMondaySet).sort();
  const mondayToRowIndex = new Map<string, number>();
  sortedWeekMondays.forEach((monday, index) => {
    mondayToRowIndex.set(monday, index);
  });

  const totalRows = sortedWeekMondays.length;

  // --- Position entries ---
  const positions = new Map<string, [number, number, number]>();

  for (const [dateStr, dayEntries] of entriesByDate) {
    const weekMonday = dayToWeekMonday.get(dateStr)!;
    const rowIndex = mondayToRowIndex.get(weekMonday)!;
    const dayIndex = getDayIndex(dayEntries[0].timestamp);

    const slotX = getSlotX(dayIndex);
    const rowZ = getRowZ(rowIndex, totalRows);
    const slotCenter: [number, number] = [slotX, rowZ];

    // Compute bloom radius for each entry (horizontal footprint)
    const bloomRadii = dayEntries.map(entry => {
      const plantType = getPlantType(entry.valenceClassification);
      const scale = calculateScaleFromPercentile(entry.scalePercentile, plantType);
      return (BLOOM_RADIUS_AT_SCALE_1[plantType] ?? 0.15) * scale;
    });

    const slotPositions = positionEntriesInDaySlot(
      dayEntries,
      slotCenter,
      LAYOUT_CONFIG.entryClusterRadius,
      bloomRadii
    );

    for (const [id, pos] of slotPositions) {
      positions.set(id, pos);
    }
  }

  return positions;
}

/**
 * Calculate positions and build summary/debug metadata for Phases 2 & 3.
 */
export function calculatePositionsWithDebug(
  entries: MoodEntryWithPercentile[]
): {
  positions: Map<string, [number, number, number]>;
  debugInfo: LayoutDebugInfo;
  daySummaries: Map<string, DaySummary>;
  weekSummaries: Map<number, WeekSummary>;
} {
  if (entries.length === 0) {
    return {
      positions: new Map(),
      debugInfo: { weekRows: [], daySlots: [] },
      daySummaries: new Map(),
      weekSummaries: new Map(),
    };
  }

  // --- Group entries by date ---
  const entriesByDate = new Map<string, MoodEntryWithPercentile[]>();
  for (const entry of entries) {
    const dateStr = getDateString(entry.timestamp);
    if (!entriesByDate.has(dateStr)) {
      entriesByDate.set(dateStr, []);
    }
    entriesByDate.get(dateStr)!.push(entry);
  }

  // --- Assign days to weeks ---
  const weekMondaySet = new Set<string>();
  const dayToWeekMonday = new Map<string, string>();

  for (const [dateStr, dayEntries] of entriesByDate) {
    const monday = getWeekMonday(dayEntries[0].timestamp);
    weekMondaySet.add(monday);
    dayToWeekMonday.set(dateStr, monday);
  }

  const sortedWeekMondays = Array.from(weekMondaySet).sort();
  const mondayToRowIndex = new Map<string, number>();
  sortedWeekMondays.forEach((monday, index) => {
    mondayToRowIndex.set(monday, index);
  });

  const totalRows = sortedWeekMondays.length;

  // --- Group days by week for summaries ---
  const weekToDays = new Map<number, string[]>();
  for (const [dateStr, weekMonday] of dayToWeekMonday) {
    const rowIndex = mondayToRowIndex.get(weekMonday)!;
    if (!weekToDays.has(rowIndex)) {
      weekToDays.set(rowIndex, []);
    }
    weekToDays.get(rowIndex)!.push(dateStr);
  }

  // --- Position entries ---
  const positions = new Map<string, [number, number, number]>();
  const daySlotDebug: DaySlotDebug[] = [];

  for (const [dateStr, dayEntries] of entriesByDate) {
    const weekMonday = dayToWeekMonday.get(dateStr)!;
    const rowIndex = mondayToRowIndex.get(weekMonday)!;
    const dayIndex = getDayIndex(dayEntries[0].timestamp);

    const slotX = getSlotX(dayIndex);
    const rowZ = getRowZ(rowIndex, totalRows);
    const slotCenter: [number, number] = [slotX, rowZ];

    // Compute bloom radius for each entry (horizontal footprint)
    const bloomRadii = dayEntries.map(entry => {
      const plantType = getPlantType(entry.valenceClassification);
      const scale = calculateScaleFromPercentile(entry.scalePercentile, plantType);
      return (BLOOM_RADIUS_AT_SCALE_1[plantType] ?? 0.15) * scale;
    });

    const slotPositions = positionEntriesInDaySlot(
      dayEntries,
      slotCenter,
      LAYOUT_CONFIG.entryClusterRadius,
      bloomRadii
    );

    for (const [id, pos] of slotPositions) {
      positions.set(id, pos);
    }

    daySlotDebug.push({
      dateStr,
      weekIndex: rowIndex,
      dayIndex,
      center: slotCenter,
      entryCount: dayEntries.length,
    });
  }

  // --- Build DaySummaries ---
  const daySummaries = new Map<string, DaySummary>();
  for (const [dateStr, dayEntries] of entriesByDate) {
    const dayPositions = dayEntries
      .map(e => positions.get(e.id))
      .filter((p): p is [number, number, number] => p !== undefined);

    daySummaries.set(dateStr, {
      dateStr,
      entryCount: dayEntries.length,
      topEmotions: getTopEmotions(dayEntries, 3),
      center: boundingBoxCenter(dayPositions),
    });
  }

  // --- Build WeekSummaries ---
  const weekSummaries = new Map<number, WeekSummary>();
  for (let i = 0; i < totalRows; i++) {
    const mondayStr = sortedWeekMondays[i];
    const dayStrs = weekToDays.get(i) ?? [];
    const weekEntries: MoodEntryWithPercentile[] = [];

    for (const dayStr of dayStrs) {
      weekEntries.push(...(entriesByDate.get(dayStr) ?? []));
    }

    // Count plant types
    let flowerCount = 0, sproutCount = 0, decayCount = 0;
    for (const entry of weekEntries) {
      const plantType = getPlantType(entry.valenceClassification);
      if (plantType === 'flower') flowerCount++;
      else if (plantType === 'sprout') sproutCount++;
      else decayCount++;
    }

    // Week date range
    const monday = new Date(mondayStr + 'T00:00:00');
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    // Positions for bounding box center
    const weekPositions = weekEntries
      .map(e => positions.get(e.id))
      .filter((p): p is [number, number, number] => p !== undefined);

    weekSummaries.set(i, {
      weekIndex: i,
      startDate: monday,
      endDate: sunday,
      flowerCount,
      sproutCount,
      decayCount,
      topEmotions: getTopEmotions(weekEntries, 2),
      center: boundingBoxCenter(weekPositions),
    });
  }

  // --- Build week row debug info ---
  const weekRowDebug: WeekRowDebug[] = sortedWeekMondays.map((mondayStr, index) => {
    const dayStrs = weekToDays.get(index) ?? [];
    let entryCount = 0;
    for (const dayStr of dayStrs) {
      entryCount += entriesByDate.get(dayStr)?.length ?? 0;
    }

    const sunday = new Date(mondayStr + 'T00:00:00');
    sunday.setDate(sunday.getDate() + 6);

    return {
      weekIndex: index,
      centerZ: getRowZ(index, totalRows),
      startDate: mondayStr,
      endDate: getDateString(sunday),
      entryCount,
    };
  });

  return {
    positions,
    debugInfo: {
      weekRows: weekRowDebug,
      daySlots: daySlotDebug,
    },
    daySummaries,
    weekSummaries,
  };
}

/**
 * Get configuration values (for debugging or UI display)
 */
export function getLayoutConfig() {
  return { ...LAYOUT_CONFIG };
}
