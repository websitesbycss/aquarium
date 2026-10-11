/**
 * Reads BLS Consumer Expenditure Survey Table 1300 (age of reference person, 2024) and writes
 * data/processed/cohort_profile.json: mean weekly spend per category for one student.
 *
 * Scaling assumptions (also written into the output under `assumptions`):
 *  1. Source column is "Under 25 years". Values are annual means per consumer unit (household).
 *  2. Per person: divide by the column's average people per consumer unit.
 *  3. Per week: divide by 52.
 *  4. BLS has no line for electronics, rideshare, transit, or air travel, so some lines are split
 *     by fixed shares below. Those shares are assumptions, not BLS data.
 *  5. Housing, insurance, education, and healthcare are excluded: they do not map to purchases
 *     that appear in a student's card feed.
 */
import * as XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RAW = join(process.cwd(), 'data', 'raw', 'bls_cex_2024_age.xlsx');
const OUT = join(process.cwd(), 'data', 'processed', 'cohort_profile.json');
const AGE_COL_HEADER = /Under\s*25/i;

const wb = XLSX.readFile(RAW);
const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

const hdrRow = rows.find((r) => r.some((c) => AGE_COL_HEADER.test(String(c))));
if (!hdrRow) throw new Error('Could not find the "Under 25 years" column header');
const colIdx = hdrRow.findIndex((c) => AGE_COL_HEADER.test(String(c)));

const label = (r: unknown[]) => String(r[0]).replace(/\s+/g, ' ').trim();

/** Annual mean for a line: the row labeled `item`, followed by a "Mean" row. */
function mean(item: string): number {
  for (let i = 0; i < rows.length - 1; i++) {
    if (label(rows[i]) === item && label(rows[i + 1]) === 'Mean') {
      const v = Number(rows[i + 1][colIdx]);
      if (Number.isFinite(v)) return v;
    }
  }
  throw new Error(`BLS line not found or non-numeric: "${item}"`);
}

const peopleRow = rows.find((r) => label(r) === 'People');
const people = Number(peopleRow?.[colIdx]);
if (!Number.isFinite(people)) throw new Error('Could not read average people per consumer unit');

const publicTransport = mean('Public and other transportation');
const audioVisual = mean('Audio and visual equipment and services');

// Fixed splits (assumptions, see header).
const SPLIT = {
  publicTransport: { travel_air: 0.45, rideshare_taxi: 0.35, public_transit: 0.2 },
  audioVisual: { electronics: 0.4, subscriptions_digital: 0.6 },
};

const annualHousehold: Record<string, number> = {
  groceries: mean('Food at home'),
  restaurants: mean('Food away from home'),
  gasoline: mean('Gasoline'),
  travel_air: publicTransport * SPLIT.publicTransport.travel_air,
  rideshare_taxi: publicTransport * SPLIT.publicTransport.rideshare_taxi,
  public_transit: publicTransport * SPLIT.publicTransport.public_transit,
  entertainment: mean('Entertainment') - audioVisual,
  apparel: mean('Apparel and services'),
  personal_care: mean('Personal care products and services'),
  electronics: audioVisual * SPLIT.audioVisual.electronics,
  subscriptions_digital: mean('Cellular phone service') + audioVisual * SPLIT.audioVisual.subscriptions_digital,
  other: mean('Miscellaneous') + mean('Reading'),
};

const weeklyPerStudent: Record<string, number> = {};
for (const [k, v] of Object.entries(annualHousehold)) {
  weeklyPerStudent[k] = Number((v / people / 52).toFixed(2));
}

const out = {
  source: 'BLS Consumer Expenditure Surveys, Table 1300, Age of reference person, 2024, Under 25 years',
  peoplePerConsumerUnit: people,
  weeksPerYear: 52,
  assumptions: [
    'Annual household mean / average people per consumer unit / 52 = weekly spend per student.',
    'Public and other transportation split: 45% air, 35% rideshare/taxi, 20% transit (assumed).',
    'Audio and visual equipment and services split: 40% electronics, 60% subscriptions (assumed).',
    'subscriptions_digital also includes cellular phone service.',
    'entertainment = BLS Entertainment minus audio and visual (which is counted above).',
    'other = Miscellaneous + Reading.',
    'Housing, insurance, education, healthcare excluded.',
  ],
  weeklyMeanUsd: weeklyPerStudent,
  weeklyTotalUsd: Number(Object.values(weeklyPerStudent).reduce((a, b) => a + b, 0).toFixed(2)),
};

mkdirSync(join(process.cwd(), 'data', 'processed'), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${OUT}  (people/unit ${people}, weekly total $${out.weeklyTotalUsd})`);
for (const [k, v] of Object.entries(weeklyPerStudent)) console.log(`${k.padEnd(22)} $${v.toFixed(2)}`);
