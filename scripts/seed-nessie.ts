/**
 * Seeds the Nessie demo account with ~4 weeks of realistic purchases so the demo has history.
 * Idempotent: does nothing if seeded purchases (description starting "seed:") already exist.
 * Deterministic: same output every run (seeded PRNG), dates relative to today.
 *
 * Run: npm run seed:nessie
 */
import { createPurchase, demoAccountId, ensureMerchant, listMerchants, listPurchases } from '../lib/nessie';

const WEEKS = 4;

// Small deterministic PRNG (mulberry32) so seeded history is reproducible.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261010);
const between = (lo: number, hi: number) => Math.round((lo + rand() * (hi - lo)) * 100) / 100;
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

type Plan = { merchant: string; amount: number; description: string };

// Typical week for a balanced student.
function weekPlan(): Plan[] {
  return [
    { merchant: pick(['Whole Foods', "Trader Joe's"]), amount: between(24, 48), description: 'seed: groceries' },
    { merchant: pick(['Whole Foods', "Trader Joe's"]), amount: between(12, 30), description: 'seed: groceries' },
    { merchant: 'Chipotle', amount: between(10, 14), description: 'seed: lunch' },
    { merchant: pick(['Chick-fil-A', 'Starbucks']), amount: between(6, 13), description: 'seed: food' },
    { merchant: 'Starbucks', amount: between(5, 8), description: 'seed: coffee' },
    { merchant: 'Uber', amount: between(8, 22), description: 'seed: ride' },
    { merchant: pick(['GoTriangle', 'Uber']), amount: between(2, 14), description: 'seed: ride' },
    { merchant: 'Shell', amount: between(18, 35), description: 'seed: gas' },
  ];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const accountId = await demoAccountId();
  const existing = await listPurchases(accountId);
  if (existing.some((p) => p.description?.startsWith('seed:'))) {
    console.log('Seed purchases already exist, nothing to do.');
    return;
  }

  const merchants = await listMerchants();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const jobs: { date: string; plan: Plan }[] = [];
  for (let w = 1; w <= WEEKS; w++) {
    for (const plan of weekPlan()) {
      const daysAgo = w * 7 - Math.floor(rand() * 7);
      jobs.push({ date: iso(new Date(today.getTime() - daysAgo * 86_400_000)), plan });
    }
    // One monthly subscription.
    if (w === 2) {
      jobs.push({
        date: iso(new Date(today.getTime() - 14 * 86_400_000)),
        plan: { merchant: 'Netflix', amount: 15.49, description: 'seed: subscription' },
      });
    }
  }

  let n = 0;
  for (const { date, plan } of jobs) {
    const m = await ensureMerchant(plan.merchant, merchants);
    await createPurchase(accountId, { merchantId: m._id, amount: plan.amount, description: plan.description, date });
    n++;
    // Fail fast: after the first write, the account must still list cleanly.
    if (n === 1) await listPurchases(accountId);
  }
  console.log(`Seeded ${n} purchases over ${WEEKS} weeks.`);
}

main().catch((e) => {
  console.error('seed-nessie failed:', e.message);
  process.exitCode = 1;
});
