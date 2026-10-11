import { syncNessie } from '@/lib/sync';


export async function POST() {
  try {
    return Response.json({ ok: true, ...(await syncNessie()) });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
