/**
 * Simulated student cohort.
 *
 *   npm run simulate -- backfill [--accounts 50000] [--weeks 12]
 *   npm run simulate -- live [--rate 500]
 *
 * Realism:
 *  - Each account gets an archetype whose category multipliers scale cohort_profile.json means.
 *  - Per-account lognormal factor (sigma 0.45) gives right-skewed weekly totals.
 *  - Purchase counts per category per week are Poisson, amounts lognormal around a ticket size.
 *  - kg_co2e = amount_usd * kg_per_usd from category_factors (EPA file via migrate).
 *  - Rows are source='sim', accounts kind='cohort' (ids from 1000). The demo account is never simulated.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { from as copyFrom } from 'pg-copy-streams';
import { closePool, pool } from '../lib/db';

// ---------- args ----------
const argv = process.argv.slice(2);
const mode = argv[0];
const flag = (name: string, dflt: number) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? Number(argv[i + 1]) : dflt;
};
const ACCOUNTS = flag('accounts', 50_000);
const WEEKS = flag('weeks', 12);
const RATE = flag('rate', 500);
const FIRST_ID = 1000;

// ---------- deterministic randomness ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(Number(process.env.SIM_SEED ?? 424242));
const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const lognormal = (sigma: number) => Math.exp(sigma * normal() - (sigma * sigma) / 2); // mean 1
function poisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L);
  return k - 1;
}
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

// ---------- model ----------
const MERCHANTS: Record<string, string[]> = {
  restaurants: ['Chipotle', 'Chick-fil-A', 'Starbucks', "McDonald's", 'Local Pizza', 'Panera Bread', 'Taco Bell', 'Domino\'s', 'Cook Out', 'Jersey Mike\'s', 'Wendy\'s', 'DoorDash', 'Uber Eats', 'Cafe Luna'],
  groceries: ['Whole Foods', "Trader Joe's", 'Harris Teeter', 'Aldi', 'Food Lion', 'Kroger', 'Target Grocery', 'Lidl', 'Campus Market'],
  rideshare_taxi: ['Uber', 'Lyft', 'Yellow Cab', 'Campus Cab'],
  gasoline: ['Shell', 'Exxon', 'BP', 'Speedway', 'Wawa', 'Sheetz', 'Circle K'],
  public_transit: ['GoTriangle', 'GoDurham', 'Campus Bus Pass', 'Metro Fare'],
  entertainment: ['AMC Theatres', 'Regal Cinemas', 'Ticketmaster', 'Steam', 'Dave & Buster\'s', 'Bowling Alley', 'Concert Venue', 'Escape Room'],
  apparel: ['Nike', 'H&M', 'Zara', 'Old Navy', 'Uniqlo', 'Target Apparel', 'Thrift Shop', 'Nordstrom Rack'],
  personal_care: ['Sephora', 'Ulta Beauty', 'CVS', 'Walgreens', 'Great Clips', 'Campus Salon'],
  electronics: ['Best Buy', 'Apple Store', 'Micro Center', 'Amazon Electronics', 'GameStop', 'Newegg'],
  subscriptions_digital: ['Spotify', 'Netflix', 'Hulu', 'Disney+', 'Apple iCloud', 'YouTube Premium', 'Mint Mobile', 'Adobe', 'HBO Max'],
  travel_air: ['Delta', 'American Airlines', 'Southwest', 'United', 'JetBlue'],
  other: ['Amazon', 'Walmart', 'Target', 'Etsy', 'Campus Bookstore', 'USPS', 'Post Office', 'Dollar General'],
};

// Typical ticket (USD) per category.
const TICKET: Record<string, number> = {
  restaurants: 14, groceries: 35, rideshare_taxi: 18, gasoline: 32, public_transit: 3.5,
  entertainment: 25, apparel: 48, personal_care: 20, electronics: 85, subscriptions_digital: 13,
  travel_air: 260, other: 18,
};

const ARCHETYPES: Record<string, Record<string, number>> = {
  commuter: { gasoline: 2.0, rideshare_taxi: 2.0, public_transit: 2.5, restaurants: 0.9, groceries: 0.9 },
  home_cook: { groceries: 1.6, restaurants: 0.4, rideshare_taxi: 0.5, subscriptions_digital: 0.8 },
  delivery_heavy: { restaurants: 2.2, groceries: 0.6, rideshare_taxi: 1.2 },
  subscription_heavy: { subscriptions_digital: 2.5, electronics: 1.5, entertainment: 1.3 },
  balanced: {},
};
const ARCH_NAMES = Object.keys(ARCHETYPES);
const ARCH_WEIGHTS = [0.2, 0.22, 0.18, 0.15, 0.25];
function pickArchetype(): string {
  let r = rand();
  for (let i = 0; i < ARCH_NAMES.length; i++) {
    r -= ARCH_WEIGHTS[i];
    if (r <= 0) return ARCH_NAMES[i];
  }
  return 'balanced';
}

// Day-of-week and hour-of-day shapes (evenings and weekends busier).
const HOUR_W = [1, 1, 1, 1, 1, 2, 3, 5, 6, 6, 7, 9, 12, 10, 8, 8, 9, 11, 13, 12, 10, 7, 4, 2];
const HOUR_SUM = HOUR_W.reduce((a, b) => a + b, 0);
function randomHour(): number {
  let r = rand() * HOUR_SUM;
  for (let h = 0; h < 24; h++) {
    r -= HOUR_W[h];
    if (r <= 0) return h;
  }
  return 12;
}

type Profile = { weeklyMeanUsd: Record<string, number> };
const profile: Profile = JSON.parse(readFileSync(join(process.cwd(), 'data', 'processed', 'cohort_profile.json'), 'utf8'));
const CATEGORIES = Object.keys(profile.weeklyMeanUsd);

type Account = { id: number; archetype: string; lambda: Record<string, number> };
function makeAccount(id: number): Account {
  const archetype = pickArchetype();
  const level = lognormal(0.45);
  const lambda: Record<string, number> = {};
  for (const c of CATEGORIES) {
    const mult = ARCHETYPES[archetype][c] ?? 1;
    // Category-level personal taste on top of the overall spending level.
    lambda[c] = ((profile.weeklyMeanUsd[c] * mult * level * lognormal(0.3)) / TICKET[c]);
  }
  return { id, archetype, lambda };
}

let factors: Record<string, number> = {};
async function loadFactors() {
  const r = await pool().query<{ category: string; kg_per_usd: number }>('SELECT category, kg_per_usd FROM category_factors');
  factors = Object.fromEntries(r.rows.map((x) => [x.category, x.kg_per_usd]));
  for (const c of CATEGORIES) if (factors[c] === undefined) throw new Error(`Missing factor for ${c}; run npm run migrate`);
}

function makePurchase(a: Account, category: string, ts: Date) {
  const amount = Math.max(1, Math.round(TICKET[category] * lognormal(0.5) * 100) / 100);
  return { ts, accountId: a.id, merchant: pick(MERCHANTS[category]), category, amount, kg: amount * factors[category] };
}
const row = (p: ReturnType<typeof makePurchase>) =>
  `${p.ts.toISOString()}\t${p.accountId}\t${p.merchant}\t${p.category}\t${p.amount.toFixed(2)}\t${p.kg}\tsim\n`;

// ---------- backfill ----------
async function backfill() {
  await loadFactors();
  const db = pool();
  console.log(`Backfill: ${ACCOUNTS} accounts, ${WEEKS} weeks`);

  const accounts: Account[] = Array.from({ length: ACCOUNTS }, (_, i) => makeAccount(FIRST_ID + i));
  await db.query(
    `INSERT INTO accounts (account_id, kind, archetype)
     SELECT id, 'cohort', arch FROM unnest($1::bigint[], $2::text[]) AS t(id, arch)
     ON CONFLICT (account_id) DO NOTHING`,
    [accounts.map((a) => a.id), accounts.map((a) => a.archetype)],
  );

  const now = Date.now();
  const start = now - WEEKS * 7 * 86_400_000;
  let rows = 0;
  const t0 = Date.now();

  function* generate(): Generator<string> {
    for (const a of accounts) {
      for (let w = 0; w < WEEKS; w++) {
        const weekStart = start + w * 7 * 86_400_000;
        const weekNoise = lognormal(0.25);
        for (const c of CATEGORIES) {
          const n = poisson(a.lambda[c] * weekNoise);
          for (let i = 0; i < n; i++) {
            const day = Math.floor(rand() * 7);
            const ts = new Date(weekStart + day * 86_400_000 + (randomHour() * 60 + Math.floor(rand() * 60)) * 60_000);
            if (ts.getTime() > now) continue;
            rows++;
            if (rows % 250_000 === 0) {
              const s = (Date.now() - t0) / 1000;
              console.log(`  ${rows.toLocaleString()} rows  (${Math.round(rows / s).toLocaleString()} rows/sec)`);
            }
            yield row(makePurchase(a, c, ts));
          }
        }
      }
    }
  }

  const client = await db.connect();
  try {
    const stream = client.query(
      copyFrom(`COPY purchases (ts, account_id, merchant, category, amount_usd, kg_co2e, source) FROM STDIN`),
    );
    await pipeline(Readable.from(generate(), { objectMode: false }), stream);
  } finally {
    client.release();
  }
  const secs = (Date.now() - t0) / 1000;
  console.log(`Inserted ${rows.toLocaleString()} rows in ${secs.toFixed(1)}s (${Math.round(rows / secs).toLocaleString()} rows/sec)`);

  console.log('Refreshing continuous aggregates...');
  for (const v of ['daily_account_totals', 'daily_category_totals', 'weekly_account_totals']) {
    await db.query(`CALL refresh_continuous_aggregate('${v}', NULL, NULL)`);
    console.log(`  refreshed ${v}`);
  }

  console.log('Converting chunks older than 7 days to columnstore...');
  const chunks = await db.query<{ c: string }>(
    `SELECT show_chunks('purchases', older_than => INTERVAL '7 days')::text AS c`,
  );
  for (const { c } of chunks.rows) {
    await db.query(`CALL convert_to_columnstore($1::regclass, if_not_columnstore => true)`, [c]);
  }
  console.log(`  ${chunks.rows.length} chunks converted`);
}

// ---------- live ----------
async function live() {
  await loadFactors();
  const db = pool();
  const known = await db.query<{ account_id: string; archetype: string }>(
    `SELECT account_id, archetype FROM accounts WHERE kind = 'cohort'`,
  );
  if (!known.rows.length) throw new Error('No cohort accounts. Run backfill first.');
  const accounts = known.rows.map((r) => makeAccount(Number(r.account_id)));
  // Category mix for a single purchase: proportional to expected purchase counts.
  const mix = CATEGORIES.map((c) => profile.weeklyMeanUsd[c] / TICKET[c]);
  const mixSum = mix.reduce((a, b) => a + b, 0);
  const pickCategory = () => {
    let r = rand() * mixSum;
    for (let i = 0; i < CATEGORIES.length; i++) {
      r -= mix[i];
      if (r <= 0) return CATEGORIES[i];
    }
    return 'other';
  };

  const TICK_MS = 200;
  const perTick = Math.max(1, Math.round((RATE * TICK_MS) / 1000));
  let total = 0;
  const t0 = Date.now();
  let stop = false;
  process.on('SIGINT', () => (stop = true));
  console.log(`Live mode: ~${RATE} rows/sec (${perTick} rows per ${TICK_MS}ms). Ctrl+C to stop.`);

  while (!stop) {
    const tickStart = Date.now();
    const batch = Array.from({ length: perTick }, () => makePurchase(pick(accounts), pickCategory(), new Date()));
    await db.query(
      `INSERT INTO purchases (ts, account_id, merchant, category, amount_usd, kg_co2e, source)
       SELECT * FROM unnest($1::timestamptz[], $2::bigint[], $3::text[], $4::text[], $5::numeric[], $6::float8[], $7::text[])`,
      [
        batch.map((b) => b.ts),
        batch.map((b) => b.accountId),
        batch.map((b) => b.merchant),
        batch.map((b) => b.category),
        batch.map((b) => b.amount),
        batch.map((b) => b.kg),
        batch.map(() => 'sim'),
      ],
    );
    total += batch.length;
    const secs = (Date.now() - t0) / 1000;
    process.stdout.write(`\r${total.toLocaleString()} rows  ${Math.round(total / secs)} rows/sec   `);
    const wait = TICK_MS - (Date.now() - tickStart);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  console.log(`\nStopped after ${total.toLocaleString()} rows.`);
}

async function main() {
  if (mode === 'backfill') await backfill();
  else if (mode === 'live') await live();
  else throw new Error('Usage: npm run simulate -- backfill|live [--accounts N] [--weeks N] [--rate N]');
}

main()
  .catch((e) => {
    console.error('simulate failed:', e.message);
    process.exitCode = 1;
  })
  .finally(closePool);
