import { query } from './db';
import { kgFor } from './carbon';
import { classify } from './classify';
import { demoAccountId, listMerchants, listPurchases } from './nessie';

export const DEMO_ACCOUNT = 1;

/**
 * Nessie purchases only carry a date. A purchase dated today (UTC) is stamped with the time we
 * first see it, so a new purchase appears as "now". Older dates are stamped at noon UTC.
 */
function timestampFor(date: string, now = new Date()): Date {
  const today = now.toISOString().slice(0, 10);
  return date === today ? now : new Date(`${date}T12:00:00Z`);
}

export type SyncResult = { fetched: number; inserted: number; skipped: number; classifiedBy: Record<string, number> };

/** Pulls Nessie purchases for the demo account and inserts the ones not seen yet. Idempotent. */
export async function syncNessie(): Promise<SyncResult> {
  const accountId = await demoAccountId();
  const [purchases, merchants] = await Promise.all([listPurchases(accountId), listMerchants()]);
  const names = new Map(merchants.map((m) => [m._id, m.name]));

  const known = new Set(
    (
      await query<{ external_id: string }>(
        'SELECT external_id FROM purchases WHERE external_id = ANY($1::text[])',
        [purchases.map((p) => p._id)],
      )
    ).map((r) => r.external_id),
  );

  const result: SyncResult = { fetched: purchases.length, inserted: 0, skipped: 0, classifiedBy: {} };
  for (const p of purchases) {
    if (known.has(p._id) || (p.status && p.status !== 'completed')) {
      result.skipped++;
      continue;
    }
    const merchant = names.get(p.merchant_id) ?? p.description ?? 'unknown';
    const c = await classify(merchant);
    const kg = await kgFor(c.category, p.amount);
    await query(
      `INSERT INTO purchases (ts, account_id, merchant, category, amount_usd, kg_co2e, source, external_id)
       VALUES ($1,$2,$3,$4,$5,$6,'nessie',$7)`,
      [timestampFor(p.purchase_date), DEMO_ACCOUNT, merchant, c.category, p.amount, kg, p._id],
    );
    result.inserted++;
    result.classifiedBy[c.classifiedBy] = (result.classifiedBy[c.classifiedBy] ?? 0) + 1;
  }
  return result;
}
