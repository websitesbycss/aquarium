import { query } from './db';

export type Factor = {
  category: string;
  kgPerUsd: number;
  epaCode: string;
  epaName: string;
  source: string;
  year: number;
};

let cache: { at: number; map: Map<string, Factor> } | undefined;

/** Factors live in the category_factors table (loaded from the EPA file by migrate). Cached 60s. */
export async function getFactors(): Promise<Map<string, Factor>> {
  if (cache && Date.now() - cache.at < 60_000) return cache.map;
  const rows = await query<{
    category: string;
    kg_per_usd: number;
    epa_code: string;
    epa_name: string;
    source: string;
    year: number;
  }>('SELECT category, kg_per_usd, epa_code, epa_name, source, year FROM category_factors');
  const map = new Map(
    rows.map((r) => [
      r.category,
      { category: r.category, kgPerUsd: r.kg_per_usd, epaCode: r.epa_code, epaName: r.epa_name, source: r.source, year: r.year },
    ]),
  );
  cache = { at: Date.now(), map };
  return map;
}

export async function kgFor(category: string, amountUsd: number): Promise<number> {
  const f = (await getFactors()).get(category);
  if (!f) throw new Error(`No emission factor for category "${category}"`);
  return amountUsd * f.kgPerUsd;
}
