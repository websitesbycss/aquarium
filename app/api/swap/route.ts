import { z } from 'zod';
import { query } from '@/lib/db';
import { getFactors } from '@/lib/carbon';
import { clarityFor } from '@/lib/clarity';
import { DEMO_ACCOUNT, demoWindowKg, percentileFor } from '@/lib/lagoon';
import { swapById } from '@/lib/swaps';


const Body = z.object({ purchaseId: z.coerce.number().int().positive(), swapId: z.string().min(1) });

/** Read-only what-if: recompute the week as if one purchase had been swapped. No writes. */
export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'Expected { purchaseId, swapId }' }, { status: 400 });
    const { purchaseId, swapId } = parsed.data;

    const swap = swapById(swapId);
    if (!swap) return Response.json({ error: `Unknown swap "${swapId}"` }, { status: 404 });

    const rows = await query<{ category: string; amount_usd: string; kg_co2e: number; in_window: boolean }>(
      `SELECT category, amount_usd, kg_co2e,
              ts > time_bucket(INTERVAL '1 day', now()) - INTERVAL '7 days' AS in_window
       FROM purchases WHERE account_id = $1 AND id = $2`,
      [DEMO_ACCOUNT, purchaseId],
    );
    const p = rows[0];
    if (!p) return Response.json({ error: 'Purchase not found' }, { status: 404 });
    if (p.category !== swap.from) {
      return Response.json({ error: `Swap "${swapId}" does not apply to ${p.category}` }, { status: 400 });
    }

    const factor = (await getFactors()).get(swap.to);
    if (!factor) return Response.json({ error: `No factor for ${swap.to}` }, { status: 500 });

    const newAmount = Number(p.amount_usd) * swap.amountMultiplier;
    const newKg = newAmount * factor.kgPerUsd;

    const week = await demoWindowKg();
    const before = await percentileFor(week.kg);
    // A purchase outside the 7-day window does not change this week's numbers.
    const afterKg = p.in_window ? Math.max(0, week.kg - p.kg_co2e + newKg) : week.kg;
    const after = await percentileFor(afterKg);

    return Response.json({
      swap: { id: swap.id, label: swap.label, note: swap.note },
      purchase: { id: purchaseId, oldKg: Number(p.kg_co2e.toFixed(2)), newKg: Number(newKg.toFixed(2)), newAmountUsd: Number(newAmount.toFixed(2)) },
      before: {
        weekKg: Number(week.kg.toFixed(2)),
        clarity: clarityFor(week.kg, before.cohortMedianKg),
        percentile: before.cleanerThanPct,
      },
      after: {
        weekKg: Number(afterKg.toFixed(2)),
        clarity: clarityFor(afterKg, after.cohortMedianKg),
        percentile: after.cleanerThanPct,
      },
      cohortMedianKg: Number(after.cohortMedianKg.toFixed(2)),
      queryMs: after.ms,
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
