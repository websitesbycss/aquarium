// Server-only Nessie (Capital One) client. Nessie requires https://, plain http fails.
const BASE = 'https://api.nessieisreal.com';

export type NessieMerchant = { _id: string; name: string; category?: string };
export type NessiePurchase = {
  _id: string;
  merchant_id: string;
  purchase_date: string; // YYYY-MM-DD, no time component
  amount: number;
  description?: string;
  status?: string;
};
export type NessieAccount = { _id: string; balance: number; nickname?: string; customer_id?: string };

function key(): string {
  const k = process.env.NESSIE_API_KEY;
  if (!k) throw new Error('NESSIE_API_KEY is not set');
  return k;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${path}${sep}key=${key()}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Nessie ${init?.method ?? 'GET'} ${path} failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : null) as T;
}

let cachedAccountId: string | undefined;

/** NESSIE_ACCOUNT_ID if set, otherwise the first account on the key. */
export async function demoAccountId(): Promise<string> {
  if (process.env.NESSIE_ACCOUNT_ID) return process.env.NESSIE_ACCOUNT_ID;
  if (cachedAccountId) return cachedAccountId;
  const accounts = await call<NessieAccount[]>('/accounts');
  if (!accounts.length) throw new Error('No Nessie accounts found for this API key');
  cachedAccountId = accounts[0]._id;
  return cachedAccountId;
}

export const getAccount = (id: string) => call<NessieAccount>(`/accounts/${id}`);
export const listPurchases = (accountId: string) => call<NessiePurchase[]>(`/accounts/${accountId}/purchases`);
export const listMerchants = () => call<NessieMerchant[]>('/merchants');

export async function createMerchant(name: string): Promise<NessieMerchant> {
  const res = await call<{ objectCreated?: NessieMerchant } & Partial<NessieMerchant>>('/merchants', {
    method: 'POST',
    body: JSON.stringify({
      name,
      category: 'Other',
      address: { street_number: '1', street_name: 'Main St', city: 'Durham', state: 'NC', zip: '27701' },
      geocode: { lat: 35.99, lng: -78.9 },
    }),
  });
  const m = res.objectCreated ?? (res._id ? (res as NessieMerchant) : undefined);
  if (!m?._id) throw new Error(`Nessie did not return a merchant id for "${name}"`);
  return m;
}

/** Finds a merchant by case-insensitive name, creating it if missing. */
export async function ensureMerchant(name: string, known?: NessieMerchant[]): Promise<NessieMerchant> {
  const all = known ?? (await listMerchants());
  const hit = all.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (hit) return hit;
  const created = await createMerchant(name);
  known?.push(created);
  return created;
}

export async function createPurchase(
  accountId: string,
  p: { merchantId: string; amount: number; description: string; date: string },
): Promise<string> {
  const res = await call<{ objectCreated?: { _id: string }; _id?: string }>(`/accounts/${accountId}/purchases`, {
    method: 'POST',
    body: JSON.stringify({
      merchant_id: p.merchantId,
      medium: 'balance',
      purchase_date: p.date,
      amount: p.amount,
      description: p.description,
      // Required by this Nessie's Purchase model: without it, listing the account's purchases
      // fails with HTTP 400 for every purchase on the account.
      status: 'completed',
    }),
  });
  const id = res.objectCreated?._id ?? res._id;
  if (!id) throw new Error('Nessie did not return a purchase id');
  return id;
}
