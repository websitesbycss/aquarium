/**
 * Creates the schema on Tiger Data. Idempotent: safe to re-run.
 * Syntax verified against current Tiger Data docs for TimescaleDB 2.30:
 *  - CREATE TABLE ... WITH (tsdb.hypertable, ...) (create_hypertable() is legacy)
 *  - continuous aggregates with real-time aggregation (timescaledb.materialized_only = false)
 *  - columnstore (formerly compression) with add_columnstore_policy
 *
 * Run: npm run migrate
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { closePool, pool } from '../lib/db';

type Factor = { epaCode: string; epaName: string; kgPerUsd: number; source: string; year: number };

async function main() {
  const db = pool();
  const run = async (label: string, sql: string, params: unknown[] = []) => {
    await db.query(sql, params);
    console.log(`ok  ${label}`);
  };

  await run(
    'category_factors',
    `CREATE TABLE IF NOT EXISTS category_factors (
       category TEXT PRIMARY KEY,
       epa_code TEXT, epa_name TEXT,
       kg_per_usd DOUBLE PRECISION NOT NULL,
       source TEXT, year INT
     )`,
  );

  await run(
    'merchant_category',
    `CREATE TABLE IF NOT EXISTS merchant_category (
       merchant TEXT PRIMARY KEY,
       category TEXT NOT NULL REFERENCES category_factors(category),
       classified_by TEXT NOT NULL
     )`,
  );

  await run(
    'accounts',
    `CREATE TABLE IF NOT EXISTS accounts (
       account_id BIGINT PRIMARY KEY,
       kind TEXT NOT NULL,
       archetype TEXT
     )`,
  );

  // id: stable handle for /api/swap. external_id: Nessie purchase id, for idempotent sync.
  await run(
    'purchases (hypertable)',
    `CREATE TABLE IF NOT EXISTS purchases (
       ts          TIMESTAMPTZ NOT NULL,
       id          BIGINT GENERATED ALWAYS AS IDENTITY,
       account_id  BIGINT NOT NULL,
       merchant    TEXT NOT NULL,
       category    TEXT NOT NULL,
       amount_usd  NUMERIC(10,2) NOT NULL,
       kg_co2e     DOUBLE PRECISION NOT NULL,
       source      TEXT NOT NULL,
       external_id TEXT
     ) WITH (
       tsdb.hypertable,
       tsdb.partition_column = 'ts',
       tsdb.chunk_interval   = '7 days',
       tsdb.segmentby        = 'category',
       tsdb.orderby          = 'account_id, ts DESC'
     )`,
  );
  // Measured on this data (about 7 rows per account per weekly chunk): segmenting by account_id
  // compressed only 1.3x because batches were tiny. Segmenting by category (12 values) and
  // ordering by account_id, ts gave 5.7x. Applied via ALTER so existing databases pick it up too.
  await run(
    'columnstore settings',
    `ALTER TABLE purchases SET (timescaledb.segmentby = 'category', timescaledb.orderby = 'account_id, ts DESC')`,
  );
  await run('idx purchases(account_id, ts)', `CREATE INDEX IF NOT EXISTS purchases_account_ts ON purchases (account_id, ts DESC)`);
  await run(
    'idx purchases(external_id)',
    `CREATE UNIQUE INDEX IF NOT EXISTS purchases_external_id ON purchases (external_id, ts) WHERE external_id IS NOT NULL`,
  );

  // Weekly totals per account. time_bucket('7 days') is Monday-aligned in UTC by default.
  await run(
    'weekly_account_totals (continuous aggregate)',
    `CREATE MATERIALIZED VIEW IF NOT EXISTS weekly_account_totals
     WITH (timescaledb.continuous) AS
     SELECT time_bucket(INTERVAL '7 days', ts) AS week,
            account_id,
            SUM(kg_co2e)   AS kg,
            SUM(amount_usd) AS usd,
            COUNT(*)       AS n
     FROM purchases
     GROUP BY week, account_id
     WITH NO DATA`,
  );
  await run(
    'daily_category_totals (continuous aggregate)',
    `CREATE MATERIALIZED VIEW IF NOT EXISTS daily_category_totals
     WITH (timescaledb.continuous) AS
     SELECT time_bucket(INTERVAL '1 day', ts) AS day,
            account_id,
            category,
            SUM(kg_co2e)   AS kg,
            SUM(amount_usd) AS usd,
            COUNT(*)       AS n
     FROM purchases
     GROUP BY day, account_id, category
     WITH NO DATA`,
  );

  // Per-account daily totals: drives the rolling 7-day percentile (day-aligned window).
  await run(
    'daily_account_totals (continuous aggregate)',
    `CREATE MATERIALIZED VIEW IF NOT EXISTS daily_account_totals
     WITH (timescaledb.continuous) AS
     SELECT time_bucket(INTERVAL '1 day', ts) AS day,
            account_id,
            SUM(kg_co2e)    AS kg,
            SUM(amount_usd) AS usd,
            COUNT(*)        AS n
     FROM purchases
     GROUP BY day, account_id
     WITH NO DATA`,
  );

  // Real-time aggregation: reads combine materialized buckets with not-yet-refreshed raw rows.
  await run('weekly real-time on', `ALTER MATERIALIZED VIEW weekly_account_totals SET (timescaledb.materialized_only = false)`);
  await run('daily_account real-time on', `ALTER MATERIALIZED VIEW daily_account_totals SET (timescaledb.materialized_only = false)`);
  await run('daily real-time on', `ALTER MATERIALIZED VIEW daily_category_totals SET (timescaledb.materialized_only = false)`);

  await run(
    'weekly refresh policy',
    `SELECT add_continuous_aggregate_policy('weekly_account_totals',
       start_offset => INTERVAL '21 days', end_offset => INTERVAL '1 minute',
       schedule_interval => INTERVAL '30 seconds', if_not_exists => true)`,
  );
  await run(
    'daily_account refresh policy',
    `SELECT add_continuous_aggregate_policy('daily_account_totals',
       start_offset => INTERVAL '21 days', end_offset => INTERVAL '1 minute',
       schedule_interval => INTERVAL '30 seconds', if_not_exists => true)`,
  );
  await run(
    'daily refresh policy',
    `SELECT add_continuous_aggregate_policy('daily_category_totals',
       start_offset => INTERVAL '21 days', end_offset => INTERVAL '1 minute',
       schedule_interval => INTERVAL '30 seconds', if_not_exists => true)`,
  );

  // Columnstore: hypertable already created with segmentby/orderby and a default policy
  // (after = chunk interval). Make the 7-day threshold explicit and idempotent.
  await db.query(`CALL remove_columnstore_policy('purchases', if_exists => true)`);
  await run('columnstore policy (after 7 days)', `CALL add_columnstore_policy('purchases', after => INTERVAL '7 days', if_not_exists => true)`);

  // Reference data.
  const factors: Record<string, Factor> = JSON.parse(
    readFileSync(join(process.cwd(), 'data', 'processed', 'category_factors.json'), 'utf8'),
  );
  for (const [category, f] of Object.entries(factors)) {
    await db.query(
      `INSERT INTO category_factors (category, epa_code, epa_name, kg_per_usd, source, year)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (category) DO UPDATE SET
         epa_code = EXCLUDED.epa_code, epa_name = EXCLUDED.epa_name,
         kg_per_usd = EXCLUDED.kg_per_usd, source = EXCLUDED.source, year = EXCLUDED.year`,
      [category, f.epaCode, f.epaName, f.kgPerUsd, f.source, f.year],
    );
  }
  console.log(`ok  category_factors loaded (${Object.keys(factors).length})`);

  // The demo account is Nessie-backed, never simulated. Cohort ids start at 1000.
  await db.query(
    `INSERT INTO accounts (account_id, kind, archetype) VALUES (1, 'demo', 'balanced') ON CONFLICT DO NOTHING`,
  );
  console.log('ok  demo account (id 1)');

  const jobs = await db.query(
    `SELECT hypertable_name, proc_name, schedule_interval FROM timescaledb_information.jobs
     WHERE hypertable_name IN ('purchases','weekly_account_totals','daily_category_totals','daily_account_totals') ORDER BY 1,2`,
  );
  console.table(jobs.rows);
}

main()
  .catch((e) => {
    console.error('migrate failed:', e.message);
    process.exitCode = 1;
  })
  .finally(closePool);
