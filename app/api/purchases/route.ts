import type { NextRequest } from 'next/server';
import { recentPurchases } from '@/lib/lagoon';


export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 50);
    return Response.json({ purchases: await recentPurchases(Number.isFinite(limit) ? limit : 50) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
