import type { MoodEntryWithPercentile, PlantType } from '../types';
import { getGardenLevelFadeModifier } from './gardenLevel';

/**
 * Plant Fading System
 *
 * Plants fade over time through opacity only:
 * - Opacity decreases over lifespan (solid → ghost → gone)
 * - Saturation stays at 1.0 (plants keep their color identity)
 *
 * Previously saturation also faded (faster than opacity), but this caused
 * all plants to turn grey before disappearing — visually confusing because
 * Content emotion IS grey. Now plants remain colorful until they fade out.
 *
 * Fade rate is modified by:
 * 1. Intensity (|valence|): higher intensity = slower fade
 * 2. Garden level: matching environment = slower fade
 */

// Configuration - tunable parameters
export const FADING_CONFIG = {
  // Base lifespan in days before plant reaches 0 opacity
  baseLifespanDays: 14,

  // How much intensity (|valence|) affects lifespan
  // At max intensity, lifespan is multiplied by (1 + this value)
  intensityModifier: 0.5, // +50% lifespan at max intensity

  // Saturation fade DISABLED — plants keep their color identity as they age
  // (Previously: saturationFadeSpeed: 1.5, minSaturation: 0.0)
  // Disabled because grey-fading conflicted with Content emotion (which IS grey)

  // Minimum opacity before plant disappears
  minOpacity: 0.0,

  // Fade curve exponent (> 1 = slow start, fast end)
  // 2.0 means quadratic acceleration
  fadeCurveExponent: 2.0,
};

export interface FadeState {
  opacity: number;    // 0 to 1
  saturation: number; // 0 to 1
  isVisible: boolean; // false when fully faded
}

/**
 * Calculate the effective lifespan for a plant based on its intensity.
 *
 * @param valence - The plant's valence (-1 to 1)
 * @returns Lifespan in milliseconds
 */
export function getEffectiveLifespan(valence: number): number {
  const baseLifespanMs = FADING_CONFIG.baseLifespanDays * 24 * 60 * 60 * 1000;

  // Higher |valence| = longer lifespan
  const intensity = Math.abs(valence);
  const intensityBonus = 1 + intensity * FADING_CONFIG.intensityModifier;

  return baseLifespanMs * intensityBonus;
}

/**
 * Apply the fade curve to linear progress.
 * This creates an accelerating fade (slow start, fast end).
 *
 * @param linearProgress - Linear progress 0 to 1
 * @returns Curved progress 0 to 1
 */
function applyFadeCurve(linearProgress: number): number {
  // Clamp to 0-1
  const clamped = Math.max(0, Math.min(1, linearProgress));

  // Apply power curve: starts slow, accelerates
  return Math.pow(clamped, FADING_CONFIG.fadeCurveExponent);
}

/**
 * Calculate the fade state for a plant at a specific time.
 *
 * @param entry - The mood entry for this plant
 * @param plantType - The type of plant ('flower', 'sprout', 'decay')
 * @param atTime - The current time
 * @param gardenLevel - Current garden level (for environmental modifier)
 * @returns FadeState with opacity, saturation, and visibility
 */
export function calculateFadeState(
  entry: MoodEntryWithPercentile,
  plantType: PlantType,
  atTime: Date,
  gardenLevel: number
): FadeState {
  const entryTimeMs = entry.timestamp.getTime();
  const atTimeMs = atTime.getTime();

  // Time since plant was created
  const ageMs = atTimeMs - entryTimeMs;

  // Plant not yet created
  if (ageMs < 0) {
    return { opacity: 1, saturation: 1, isVisible: false };
  }

  // Get base lifespan with intensity modifier
  const baseLifespanMs = getEffectiveLifespan(entry.valence);

  // Apply garden level modifier
  const gardenModifier = getGardenLevelFadeModifier(gardenLevel, plantType);

  // Effective lifespan after all modifiers
  // Lower modifier = longer lifespan (divide by modifier)
  const effectiveLifespanMs = baseLifespanMs / gardenModifier;

  // Linear progress through lifespan (0 = just born, 1 = fully faded)
  const linearProgress = ageMs / effectiveLifespanMs;

  // Apply accelerating curve
  const curvedProgress = applyFadeCurve(linearProgress);

  // Opacity decreases as progress increases
  const opacity = Math.max(
    FADING_CONFIG.minOpacity,
    1 - curvedProgress
  );

  // Saturation stays constant — plants keep their color identity as they fade
  // (Previously faded faster than opacity, but grey plants conflicted with Content emotion)
  const saturation = 1;

  // Plant is visible if opacity is above threshold
  const isVisible = opacity > FADING_CONFIG.minOpacity;

  return { opacity, saturation, isVisible };
}

/**
 * Apply saturation adjustment to a hex color.
 *
 * @param hexColor - Color in hex format (#RRGGBB)
 * @param saturation - Saturation multiplier (0 = grey, 1 = original)
 * @returns Adjusted color in hex format
 */
export function adjustColorSaturation(hexColor: string, saturation: number): string {
  // Parse hex color
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Convert to HSL
  const [h, s, l] = rgbToHsl(r, g, b);

  // Apply saturation adjustment
  const newS = s * saturation;

  // Convert back to RGB
  const [newR, newG, newB] = hslToRgb(h, newS, l);

  // Return as hex
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

/**
 * Convert RGB to HSL.
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h, s, l];
}

/**
 * Convert HSL to RGB.
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [r * 255, g * 255, b * 255];
}
