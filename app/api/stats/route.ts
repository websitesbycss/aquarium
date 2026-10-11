import { query } from '@/lib/db';
import { latencies, percentileFor } from '@/lib/lagoon';


let cache: { at: number; body: unknown } | undefined;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Tiger Data panel: ingest rate, total rows, compression ratio, percentile latency, cohort size. */
export async function GET() {
  try {
    if (cache && Date.now() - cache.at < 2000) return Response.json(cache.body);

    // This instance may not have served any percentile queries yet (serverless). Warm a few.
    for (let i = latencies.length; i < 5; i++) await percentileFor(0);

    const [rows, rate, comp, accts] = await Promise.all([
      query<{ n: string }>(`SELECT approximate_row_count('purchases')::text AS n`),
      query<{ n: string }>(`SELECT count(*)::text AS n FROM purchases WHERE ts > now() - INTERVAL '10 seconds'`),
      query<{ total: string; compressed: string; before: string | null; after: string | null }>(
        `SELECT total_chunks::text AS total, number_compressed_chunks::text AS compressed,
                before_compression_total_bytes::text AS before, after_compression_total_bytes::text AS after
         FROM hypertable_columnstore_stats('purchases')`,
      ),
      query<{ n: string }>(`SELECT count(*)::text AS n FROM accounts WHERE kind = 'cohort'`),
    ]);

    const before = Number(comp[0]?.before ?? 0);
    const after = Number(comp[0]?.after ?? 0);
    const body = {
      totalRows: Number(rows[0].n),
      rowsPerSec: Number(rate[0].n) / 10,
      compressionRatio: after > 0 ? Number((before / after).toFixed(1)) : null,
      compressedChunks: Number(comp[0]?.compressed ?? 0),
      totalChunks: Number(comp[0]?.total ?? 0),
      p50PercentileMs: median(latencies),
      simulatedAccounts: Number(accts[0].n),
    };
    cache = { at: Date.now(), body };
    return Response.json(body);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
