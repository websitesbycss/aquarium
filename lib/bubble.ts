import type { Factor } from './carbon';

// EPA average gasoline passenger vehicle, about 403 g CO2e per mile
// (EPA Greenhouse Gas Equivalencies Calculator, 4.03e-4 metric tons CO2e/mile).
export const KG_PER_MILE = 0.403;

export const CATEGORY_LABELS: Record<string, string> = {
  restaurants: 'Restaurants',
  groceries: 'Groceries',
  rideshare_taxi: 'Rideshare and taxi',
  gasoline: 'Gasoline',
  public_transit: 'Public transit',
  entertainment: 'Entertainment',
  apparel: 'Apparel',
  personal_care: 'Personal care',
  electronics: 'Electronics',
  subscriptions_digital: 'Subscriptions and digital',
  travel_air: 'Air travel',
  other: 'Other',
};

export type InfoBubble = {
  formula: string;
  categoryLabel: string;
  epaName: string;
  source: string;
  caveat: string;
  equivalent?: string;
};

/** Built entirely from the stored factor. No model call. */
export function infoBubble(amountUsd: number, kg: number, factor: Factor | undefined, category: string): InfoBubble {
  const kgPerUsd = factor?.kgPerUsd ?? 0;
  const miles = kg / KG_PER_MILE;
  return {
    formula: `$${amountUsd.toFixed(2)} × ${kgPerUsd.toFixed(3)} kg/$ = ${kg.toFixed(1)} kg CO2e`,
    categoryLabel: CATEGORY_LABELS[category] ?? category,
    epaName: factor?.epaName ?? 'Unknown',
    source: factor?.source ?? 'EPA supply chain emission factors (with margins)',
    caveat: 'Spend-based estimate, treat as a ballpark.',
    ...(miles >= 1 ? { equivalent: `≈ driving ${Math.round(miles)} miles` } : {}),
  };
}
