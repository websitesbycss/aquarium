import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { createPurchase, demoAccountId, ensureMerchant } from '@/lib/nessie';
import { syncNessie } from '@/lib/sync';
import { recentPurchases } from '@/lib/lagoon';


const Body = z.object({ merchant: z.string().min(1).max(80), amount: z.number().positive().max(10_000) });

function authorized(req: Request): boolean {
  const secret = process.env.DEV_SECRET;
  const given = req.headers.get('x-dev-secret') ?? '';
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

/** Demo trigger: creates a Nessie purchase, then syncs it. Needs the x-dev-secret header. */
export async function POST(req: Request) {
  // Disabled entirely when DEV_SECRET is not configured.
  if (!process.env.DEV_SECRET) return new Response('Not found', { status: 404 });
  if (!authorized(req)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'Expected { merchant, amount }' }, { status: 400 });
    const { merchant, amount } = parsed.data;

    const accountId = await demoAccountId();
    const m = await ensureMerchant(merchant);
    await createPurchase(accountId, {
      merchantId: m._id,
      amount,
      description: `demo: ${merchant}`,
      date: new Date().toISOString().slice(0, 10),
    });
    const sync = await syncNessie();
    const [latest] = await recentPurchases(1);
    return Response.json({ ok: true, sync, purchase: latest });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
