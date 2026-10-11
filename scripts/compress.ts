/** Converts purchases chunks older than 7 days to columnstore. Idempotent. Run: npm run compress */
import { closePool, pool } from '../lib/db';

async function main() {
  const db = pool();
  const chunks = await db.query<{ c: string }>(
    `SELECT show_chunks('purchases', older_than => INTERVAL '7 days')::text AS c`,
  );
  // --rebuild: decompress first, so chunks pick up changed segmentby/orderby settings.
  const rebuild = process.argv.includes('--rebuild');
  let done = 0;
  for (const { c } of chunks.rows) {
    const t0 = Date.now();
    if (rebuild) await db.query(`SELECT decompress_chunk($1::regclass, true)`, [c]);
    await db.query(`CALL convert_to_columnstore($1::regclass, if_not_columnstore => true)`, [c]);
    done++;
    console.log(`${done}/${chunks.rows.length} ${c} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  const s = await db.query(
    `SELECT total_chunks, number_compressed_chunks,
            pg_size_pretty(before_compression_total_bytes) AS before,
            pg_size_pretty(after_compression_total_bytes) AS after,
            round(before_compression_total_bytes::numeric / NULLIF(after_compression_total_bytes, 0), 1) AS ratio
     FROM hypertable_columnstore_stats('purchases')`,
  );
  console.table(s.rows);
}

main()
  .catch((e) => {
    console.error('compress failed:', e.message);
    process.exitCode = 1;
  })
  .finally(closePool);
