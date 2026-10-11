import { lagoon } from '@/lib/lagoon';


export async function GET() {
  try {
    return Response.json(await lagoon());
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
