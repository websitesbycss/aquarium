/**
 * Water clarity 0..1 from the week's kg vs the cohort median.
 * 1 at or below the median, easing down to a floor of 0.25 at 2.5x the median.
 * The floor means the lagoon gets hazy and quiet but never looks gross or alarming.
 */
export const CLARITY_FLOOR = 0.25;

export function clarityFor(weekKg: number, cohortMedianKg: number): number {
  if (!(cohortMedianKg > 0)) return 1;
  const ratio = weekKg / cohortMedianKg;
  if (ratio <= 1) return 1;
  const t = Math.min(1, (ratio - 1) / 1.5);
  return Number((1 - (1 - CLARITY_FLOOR) * t).toFixed(3));
}
