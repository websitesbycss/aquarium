import { query } from './db';
import { getFactors } from './carbon';
import { classifyMerchant } from './gemini';

export const normalizeMerchant = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();

// Order matters: first match wins ("uber eats" must beat "uber").
const RULES: [string, RegExp][] = [
  ['restaurants', /uber eats|doordash|grubhub|chipotle|mcdonald|chick-?fil|starbucks|dunkin|panera|taco|burger|pizza|domino|wendy|kfc|restaurant|cafe|coffee|diner|grill|sushi|wing/],
  ['rideshare_taxi', /uber|lyft|taxi|\bcab\b/],
  ['groceries', /whole foods|trader joe|kroger|harris teeter|aldi|publix|safeway|food lion|grocery|supermarket|market/],
  ['gasoline', /\bshell\b|exxon|\bbp\b|chevron|speedway|wawa|sheetz|gas station|fuel/],
  ['public_transit', /go ?triangle|metro|transit|\bmta\b|\bbus\b|train fare/],
  ['travel_air', /delta|united air|american air|southwest|jetblue|airline|airways|spirit air/],
  ['subscriptions_digital', /spotify|netflix|hulu|disney|hbo|apple music|youtube|icloud|adobe|openai|chatgpt|verizon|t-mobile|at&t|mint mobile|prime video|subscription/],
  ['electronics', /best buy|apple store|apple\.com|micro center|newegg|b&h|gamestop/],
  ['apparel', /nike|h&m|zara|uniqlo|old navy|\bgap\b|nordstrom|adidas|lululemon/],
  ['personal_care', /sephora|ulta|cvs|walgreens|salon|barber|great clips/],
  ['entertainment', /\bamc\b|cinema|regal|ticketmaster|steam|bowling|concert|theater|theatre/],
];

export function ruleCategory(normalized: string): string | null {
  for (const [category, re] of RULES) if (re.test(normalized)) return category;
  return null;
}

export type Classified = { category: string; classifiedBy: 'cache' | 'rule' | 'gemini' | 'fallback' };

async function store(merchant: string, category: string, by: 'rule' | 'gemini' | 'seed') {
  await query(
    `INSERT INTO merchant_category (merchant, category, classified_by) VALUES ($1,$2,$3) ON CONFLICT (merchant) DO NOTHING`,
    [merchant, category, by],
  );
}

/**
 * Cache, then keyword rules, then one Gemini call. A merchant is never classified twice.
 * If Gemini fails, return "other" without caching so a later sync can retry.
 */
export async function classify(rawName: string): Promise<Classified> {
  const merchant = normalizeMerchant(rawName);
  const hit = await query<{ category: string }>('SELECT category FROM merchant_category WHERE merchant = $1', [merchant]);
  if (hit[0]) return { category: hit[0].category, classifiedBy: 'cache' };

  const byRule = ruleCategory(merchant);
  if (byRule) {
    await store(merchant, byRule, 'rule');
    return { category: byRule, classifiedBy: 'rule' };
  }

  const categories = [...(await getFactors()).keys()];
  const byModel = await classifyMerchant(merchant, categories);
  if (byModel) {
    await store(merchant, byModel, 'gemini');
    return { category: byModel, classifiedBy: 'gemini' };
  }
  return { category: 'other', classifiedBy: 'fallback' };
}
