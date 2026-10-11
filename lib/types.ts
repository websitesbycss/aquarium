import type { lagoon, PurchaseOut } from './lagoon';

// Type-only imports: erased at build time, so no server code reaches the browser.
export type { PurchaseOut };
export type LagoonData = Awaited<ReturnType<typeof lagoon>>;

export type Stats = {
  totalRows: number;
  rowsPerSec: number;
  compressionRatio: number | null;
  compressedChunks: number;
  totalChunks: number;
  p50PercentileMs: number | null;
  simulatedAccounts: number;
};

export type SwapResult = {
  swap: { id: string; label: string; note: string };
  purchase: { id: number; oldKg: number; newKg: number; newAmountUsd: number };
  before: { weekKg: number; clarity: number; percentile: number };
  after: { weekKg: number; clarity: number; percentile: number };
  cohortMedianKg: number;
};

export const HONESTY =
  'Cohort is simulated (50,000 students), calibrated to BLS Consumer Expenditure averages. Carbon values are spend-based estimates using EPA supply chain emission factors.';
