/**
 * Reads the EPA supply chain factor file and writes data/processed/category_factors.json.
 *
 * Factors are the "Supply Chain Emission Factors with Margins" column (cradle to shelf),
 * kg CO2e per 2024 USD at purchaser price. Nothing is hard-coded: every kgPerUsd value is
 * read from the file. When a category maps to several NAICS rows, kgPerUsd is the median of
 * those rows' with-margins factors and `method` says so.
 */
import * as XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RAW = join(process.cwd(), 'data', 'raw', 'epa_factors_v1.4.0.xlsx');
const OUT = join(process.cwd(), 'data', 'processed', 'category_factors.json');
const VERSION = 'EPA Supply Chain GHG Emission Factors v1.4.0 (with margins, cradle to shelf)';
const YEAR = 2024; // USD basis of the factors ("kg CO2e/2024 USD, purchaser price")

type Mapping = { label: string; codes?: string[]; prefixes?: string[]; note?: string };

// Aquarium category -> EPA NAICS rows. Exact codes or code prefixes.
const MAP: Record<string, Mapping> = {
  restaurants: { label: 'Restaurants', codes: ['722513'], note: 'Limited-service restaurants' },
  groceries: {
    label: 'Groceries',
    prefixes: ['311'],
    note: 'Food manufacturing commodities. Supermarket rows are the retail margin only, so they would understate food.',
  },
  rideshare_taxi: { label: 'Rideshare and taxi', codes: ['485310'] },
  gasoline: { label: 'Gasoline', codes: ['324110'], note: 'Petroleum refineries (the fuel itself)' },
  public_transit: {
    label: 'Public transit',
    codes: ['485113'],
    note: 'EPA publishes one factor for all ground passenger transport, so this equals rideshare_taxi per dollar',
  },
  entertainment: { label: 'Entertainment', prefixes: ['711', '712', '713'] },
  apparel: { label: 'Apparel', prefixes: ['315'] },
  personal_care: { label: 'Personal care', codes: ['325620'], note: 'Toilet preparation manufacturing' },
  electronics: { label: 'Electronics', prefixes: ['3341', '3342', '3343'] },
  subscriptions_digital: {
    label: 'Subscriptions and digital',
    codes: ['515210'],
    note: 'Cable and other subscription programming',
  },
  travel_air: { label: 'Air travel', codes: ['481111'] },
  other: { label: 'Other', codes: ['453998'], note: 'Miscellaneous store retailers' },
};

type Row = { code: string; name: string; unit: string; withMargins: number };

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const wb = XLSX.readFile(RAW);
const sheet = wb.Sheets['CO2e'];
if (!sheet) throw new Error(`Sheet "CO2e" not found. Sheets: ${wb.SheetNames.join(', ')}`);
const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
const header = raw[0].map(String);
const col = (needle: string) => {
  const i = header.findIndex((h) => h.includes(needle));
  if (i < 0) throw new Error(`Column containing "${needle}" not found in: ${header.join(' | ')}`);
  return i;
};
const cCode = col('NAICS Code');
const cName = col('NAICS Title');
const cUnit = col('Unit');
const cWith = col('Emission Factors with Margins');

const rows: Row[] = raw
  .slice(1)
  .map((r) => ({
    code: String(r[cCode]).trim(),
    name: String(r[cName]).trim(),
    unit: String(r[cUnit]).trim(),
    withMargins: Number(r[cWith]),
  }))
  .filter((r) => r.code && Number.isFinite(r.withMargins));

const units = new Set(rows.map((r) => r.unit));
if (units.size !== 1) throw new Error(`Expected one unit, found: ${[...units].join(' ; ')}`);

const out: Record<string, unknown> = {};
for (const [category, m] of Object.entries(MAP)) {
  const hits = rows.filter(
    (r) => m.codes?.includes(r.code) || m.prefixes?.some((p) => r.code.startsWith(p)),
  );
  if (!hits.length) throw new Error(`No EPA rows matched category ${category}`);
  const single = hits.length === 1;
  out[category] = {
    label: m.label,
    epaCode: single ? hits[0].code : m.prefixes!.map((p) => `${p}*`).join(','),
    epaName: single ? hits[0].name : `${m.label}: median of ${hits.length} NAICS rows (${m.prefixes!.join(', ')})`,
    kgPerUsd: Number(median(hits.map((h) => h.withMargins)).toFixed(4)),
    method: single ? 'single row' : `median of ${hits.length} rows`,
    ...(m.note ? { note: m.note } : {}),
    source: VERSION,
    year: YEAR,
  };
}

mkdirSync(join(process.cwd(), 'data', 'processed'), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${OUT}`);
for (const [k, v] of Object.entries(out) as [string, { kgPerUsd: number; epaCode: string; method: string }][]) {
  console.log(`${k.padEnd(22)} ${String(v.kgPerUsd).padStart(7)} kg/$  ${v.epaCode.padEnd(14)} ${v.method}`);
}
