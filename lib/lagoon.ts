import { query } from './db';
import { getFactors } from './carbon';
import { infoBubble, type InfoBubble } from './bubble';
import { clarityFor } from './clarity';
import { getAccount, demoAccountId } from './nessie';
import { swapsFor } from './swaps';

export const DEMO_ACCOUNT = 1;

/**
 * Percentile definition (the "partial week" edge from the spec):
 * we compare ROLLING 7 DAY-ALIGNED WINDOWS (today and the 6 days before it, UTC buckets) from
 * the daily_account_totals continuous aggregate. Both sides cover exactly 7 day buckets, so an
 * early-week partial week never makes everyone look cleaner. The cohort window ends at the
 * cohort's latest data day, so a stale backfill still compares like with like.
 */
export type Percentile = { cleanerThanPct: number; cohortMedianKg: number; cohortSize: number; ms: number };

export async function cohortAsOfDay(): Promise<string> {
  const r = await query<{ d: string }>(
    `SELECT LEAST(max(day), time_bucket(INTERVAL '1 day', now()))::date::text AS d
     FROM daily_account_totals WHERE account_id <> $1`,
    [DEMO_ACCOUNT],
  );
  return r[0]?.d ?? new Date().toISOString().slice(0, 10);
}

export async function demoWindowKg(): Promise<{ kg: number; usd: number }> {
  const r = await query<{ kg: number | null; usd: string | null }>(
    `SELECT SUM(kg) AS kg, SUM(usd) AS usd FROM daily_account_totals
     WHERE account_id = $1 AND day > time_bucket(INTERVAL '1 day', now()) - INTERVAL '7 days'`,
    [DEMO_ACCOUNT],
  );
  return { kg: Number(r[0]?.kg ?? 0), usd: Number(r[0]?.usd ?? 0) };
}

export async function percentileFor(demoKg: number): Promise<Percentile> {
  const asOf = await cohortAsOfDay();
  const t0 = performance.now();
  const r = await query<{ n: number; median: number | null; higher: number }>(
    `WITH cohort AS (
       SELECT account_id, SUM(kg) AS kg
       FROM daily_account_totals
       WHERE day >  $1::date - 7 AND day <= $1::date AND account_id <> $2
       GROUP BY account_id
     )
     SELECT count(*)::int AS n,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY kg) AS median,
            count(*) FILTER (WHERE kg > $3)::int AS higher
     FROM cohort`,
    [asOf, DEMO_ACCOUNT, demoKg],
  );
  const ms = performance.now() - t0;
  recordLatency(Math.round(ms));
  const n = r[0]?.n ?? 0;
  return {
    cleanerThanPct: n ? Math.round((100 * (r[0].higher ?? 0)) / n) : 0,
    cohortMedianKg: Number(r[0]?.median ?? 0),
    cohortSize: n,
    ms: Math.round(ms),
  };
}

export type PurchaseOut = {
  id: number;
  ts: string;
  merchant: string;
  category: string;
  amountUsd: number;
  kg: number;
  factor: number;
  info: InfoBubble;
  swaps: { id: string; label: string; note: string; newAmountUsd: number; newKg: number }[];
};

// Recent percentile query latencies (this server instance), for the Tiger Data panel.
const g = globalThis as unknown as { __pctLatencies?: number[] };
export const latencies = (g.__pctLatencies ??= []);
function recordLatency(ms: number) {
  latencies.push(ms);
  if (latencies.length > 20) latencies.shift();
}

export async function recentPurchases(limit = 50): Promise<PurchaseOut[]> {
  const factors = await getFactors();
  const rows = await query<{ id: string; ts: Date; merchant: string; category: string; amount_usd: string; kg_co2e: number }>(
    `SELECT id, ts, merchant, category, amount_usd, kg_co2e FROM purchases
     WHERE account_id = $1 ORDER BY ts DESC LIMIT $2`,
    [DEMO_ACCOUNT, Math.min(Math.max(limit, 1), 200)],
  );
  return rows.map((r) => {
    const amount = Number(r.amount_usd);
    const f = factors.get(r.category);
    return {
      id: Number(r.id),
      ts: r.ts.toISOString(),
      merchant: r.merchant,
      category: r.category,
      amountUsd: amount,
      kg: Number(r.kg_co2e.toFixed(2)),
      factor: f?.kgPerUsd ?? 0,
      info: infoBubble(amount, r.kg_co2e, f, r.category),
      swaps: swapsFor(r.category).map((s) => {
        const newAmount = amount * s.amountMultiplier;
        return {
          id: s.id,
          label: s.label,
          note: s.note,
          newAmountUsd: Number(newAmount.toFixed(2)),
          newKg: Number((newAmount * (factors.get(s.to)?.kgPerUsd ?? 0)).toFixed(2)),
        };
      }),
    };
  });
}

export async function topCategories() {
  return query<{ category: string; kg: number; usd: number }>(
    `SELECT category, SUM(kg)::float8 AS kg, SUM(usd)::float8 AS usd
     FROM daily_category_totals
     WHERE account_id = $1 AND day > time_bucket(INTERVAL '1 day', now()) - INTERVAL '7 days'
     GROUP BY category ORDER BY kg DESC`,
    [DEMO_ACCOUNT],
  );
}

async function nessieBalance(): Promise<number | null> {
  try {
    return (await getAccount(await demoAccountId())).balance;
  } catch {
    return null; // Nessie being slow must never take the page down
  }
}

export async function lagoon() {
  const [week, recent, cats, balance] = await Promise.all([
    demoWindowKg(),
    recentPurchases(12),
    topCategories(),
    nessieBalance(),
  ]);
  const pct = await percentileFor(week.kg);
  const dailyBurn = week.usd / 7;
  return {
    weekKg: Number(week.kg.toFixed(2)),
    weekUsd: Number(week.usd.toFixed(2)),
    cohortMedianKg: Number(pct.cohortMedianKg.toFixed(2)),
    cohortSize: pct.cohortSize,
    clarity: clarityFor(week.kg, pct.cohortMedianKg),
    percentile: pct.cleanerThanPct,
    balance,
    runwayDays: balance !== null && dailyBurn > 0 ? Math.floor(balance / dailyBurn) : null,
    recentPurchases: recent,
    topCategories: cats.map((c) => ({ ...c, kg: Number(c.kg.toFixed(2)), usd: Number(c.usd.toFixed(2)) })),
    queryMs: pct.ms,
  };
}
