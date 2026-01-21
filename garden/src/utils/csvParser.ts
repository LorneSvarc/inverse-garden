import type { MoodEntry, MoodEntryWithPercentile } from '../types';
import { calculatePercentiles } from './percentileCalculator';

/**
 * Parses the Apple Health State of Mind CSV export into typed MoodEntry objects.
 *
 * CSV Format:
 * - Start: DateTime with timezone (e.g., "2026-01-09 15:34:06 -0500")
 * - End: Same as Start for point-in-time entries
 * - Kind: "Momentary Emotion" or "Daily Mood"
 * - Labels: Pipe-separated emotions (e.g., "Anxious | Irritated | Sad")
 * - Associations: Pipe-separated context tags (e.g., "Self Care | Health")
 * - Valence: Float from -1 to 1
 * - Valence Classification: String like "Very Unpleasant", "Neutral", etc.
 *
 * Note: There's a trailing comma after Valence Classification in each row.
 */

export function parseCSV(csvText: string): MoodEntry[] {
  const lines = csvText.trim().split('\n');

  // Skip header row
  const dataLines = lines.slice(1);

  const entries: MoodEntry[] = [];

  for (const line of dataLines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Parse CSV line - handle potential commas in fields
    // The format is fixed: 7 columns with a trailing comma
    // Start, End, Kind, Labels, Associations, Valence, Valence Classification,
    const parts = parseCSVLine(line);

    if (parts.length < 7) {
      console.warn('Skipping malformed line:', line);
      continue;
    }

    const [startStr, , kind, labels, associations, valenceStr, valenceClassification] = parts;

    // Parse timestamp - format: "2026-01-09 15:34:06 -0500"
    const timestamp = parseTimestamp(startStr);
    if (!timestamp) {
      console.warn('Could not parse timestamp:', startStr);
      continue;
    }

    // Parse emotions from Labels field
    // Format: "Anxious | Irritated | Sad" or empty string
    const emotions = parseList(labels);

    // Parse associations
    // Format: "Self Care | Health | Identity" or empty string
    const associationList = parseList(associations);

    // Parse valence
    const valence = parseFloat(valenceStr);
    if (isNaN(valence)) {
      console.warn('Could not parse valence:', valenceStr);
      continue;
    }

    // Create unique ID from timestamp
    const id = `entry-${timestamp.getTime()}`;

    entries.push({
      id,
      timestamp,
      kind: kind as 'Momentary Emotion' | 'Daily Mood',
      emotions,
      associations: associationList,
      valence,
      valenceClassification: valenceClassification.trim(),
    });
  }

  return entries;
}

/**
 * Parse a CSV line handling the fixed format
 * We know the structure, so we can be simple here
 */
function parseCSVLine(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Don't forget the last part
  parts.push(current.trim());

  return parts;
}

/**
 * Parse timestamp from format: "2026-01-09 15:34:06 -0500"
 *
 * Safari is strict about date formats, so we need to convert to ISO 8601.
 * Input:  "2026-01-09 15:34:06 -0500"
 * Output: "2026-01-09T15:34:06-05:00" (ISO 8601 with timezone)
 */
function parseTimestamp(str: string): Date | null {
  try {
    // Convert "2026-01-09 15:34:06 -0500" to "2026-01-09T15:34:06-05:00"
    // Step 1: Replace space between date and time with 'T'
    // Step 2: Convert timezone from "-0500" to "-05:00"
    const match = str.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-])(\d{2})(\d{2})$/);

    if (!match) {
      return null;
    }

    const [, datePart, timePart, tzSign, tzHours, tzMinutes] = match;
    const isoString = `${datePart}T${timePart}${tzSign}${tzHours}:${tzMinutes}`;

    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch {
    return null;
  }
}

/**
 * Parse pipe-separated list into array
 * "Anxious | Irritated | Sad" -> ["Anxious", "Irritated", "Sad"]
 * "" -> []
 */
function parseList(str: string): string[] {
  if (!str || str.trim() === '') {
    return [];
  }

  // Split on " | " (space-pipe-space)
  return str.split(' | ').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Utility to load CSV from file path (for development)
 */
export async function loadCSVFromPath(path: string): Promise<MoodEntry[]> {
  const response = await fetch(path);
  const text = await response.text();
  return parseCSV(text);
}

/**
 * Parse CSV and calculate percentiles in one step
 * This is the main function to use when loading data for the garden.
 */
export function parseCSVWithPercentiles(csvText: string): MoodEntryWithPercentile[] {
  const entries = parseCSV(csvText);
  return calculatePercentiles(entries);
}

/**
 * Load CSV from path and calculate percentiles
 */
export async function loadCSVWithPercentiles(path: string): Promise<MoodEntryWithPercentile[]> {
  const response = await fetch(path);
  const text = await response.text();
  return parseCSVWithPercentiles(text);
}
