/**
 * Patch-based positioning configuration.
 *
 * The garden is divided into irregular patches. Each day is assigned to a patch,
 * and entries within that day cluster inside it. When all plants in a patch fade
 * to opacity 0, the patch becomes available for reuse.
 */
export const PATCH_CONFIG = {
  // Patch generation
  patchCount: 28,           // Target number of patches (~5×6 jittered grid)
  gridJitter: 0.35,         // Fraction of cell size to jitter (0 = rigid, 0.5 = max)
  minPatchSpacing: 5.0,     // Minimum distance between patch centers (world units)

  // Sizing
  patchRadius: 3.5,         // Usable radius per patch (world units)

  // Intra-patch placement
  stemSpacing: 3.5,         // Target distance between stems within a patch
  stemSpacingMin: 2.5,      // Absolute minimum (some petal overlap OK)

  // Reuse
  reuseGraceDays: 0,        // Days after last plant fades before patch is reusable

  // Spatial ordering
  fillOrder: 'serpentine' as const,  // 'serpentine' = sweep back and forth across rows

  // Deterministic seed for patch layout
  seed: 12345,
};
