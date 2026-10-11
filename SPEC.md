# Aquarium: build spec

A web app that turns your spending into a calm, glossy Frutiger Aero lagoon. Each purchase gets an estimated carbon footprint, the lagoon reflects your week, and a percentile tells you how you compare to a simulated cohort of students. Built for HackNC 2026.

Solo build. Claude Code should do everything it can. Section 3 lists the few things only the human can do (accounts, keys, domain).

Tracks: General, Frutiger Aero, Nessie (Capital One), Tiger Data (MLH). Also opt into Gemini (MLH), .Tech domain (MLH), DEV writing challenge, and Commit Fellowship. Only 4 prizes can be awarded per team.

Devpost submission requires a GitHub link and a demo video (2 minutes max). Both are mandatory.

## 1. Product in one paragraph

A student connects a bank account (Nessie mock). Every purchase becomes a bubble that floats up in a lagoon. Hovering a bubble shows merchant, cost, estimated kg CO2e, and an info icon explaining the math (spend x EPA emission factor). The weekly total sets the water clarity. A badge says "Cleaner than 71% of students like you", computed in Tiger Data against a simulated cohort of about 50,000 students whose spending is calibrated to BLS averages. A swap simulator lets you pick a lower-carbon alternative for any bubble and watch the water clear and the percentile rise. A runway gauge shows how many days your money lasts.

## 2. Non-negotiable product rules

1. **Nothing dies, shrinks, or suffers.** No dead fish, no bleaching, no skulls, no guilt copy. A high-carbon week makes the lagoon hazy and quiet: fish drift to the edges and rest, coral looks muted. A good week makes it clear and lively: fish return, coral brightens. Copy examples: "Your lagoon is resting this week." "Clear skies ahead: swap one ride to bring the sparkle back."
2. **Be honest about data.** Footer and info panel must say: "Cohort is simulated (50,000 students), calibrated to BLS Consumer Expenditure averages. Carbon values are spend-based estimates using EPA supply chain emission factors." Never present estimates as measurements.
3. **Emission factors come from the downloaded EPA file, not from memory.** Never hard-code a factor Claude Code made up. Example numbers in this spec are placeholders.
4. **Database credentials never reach the browser.** All Tiger Data, Nessie, and Gemini calls happen in server routes.

## 3. Human-only tasks (do these first)

These need accounts or clicks that Claude Code cannot do.

1. **Tiger Data:** create an account and a free service, copy the Postgres connection string into `.env` as `DATABASE_URL`. Ask in the MLH/Tiger Data sponsor channel if the free tier limits storage or extensions (Toolkit for approximate percentiles is optional).
2. **Nessie:** get an API key at http://api.nessieisreal.com (Capital One hackathon page) and set `NESSIE_API_KEY`.
3. **Gemini:** get an API key from Google AI Studio and set `GEMINI_API_KEY`.
4. **Vercel:** create a project linked to the GitHub repo. Set the same env vars in Vercel project settings.
5. **Domain (optional):** the product is called Aquarium and the domain is `useaquarium.tech`. Claim it via the MLH .Tech prize flow (check the MLH sponsor channel for the claim link and rules), then in Vercel go to Project, Settings, Domains, add `useaquarium.tech`, and add the DNS records Vercel shows you at the registrar. Let it propagate in the background. Also add `www.useaquarium.tech` as a redirect to the apex if Vercel offers it.
6. **Datasets:** download the three files in section 5 into `data/raw/` (Claude Code can then process them).

## 4. Stack

- **Next.js (App Router) + TypeScript**, deployed on Vercel. Server routes for all data access.
- **Postgres client:** `pg` (or `postgres`). Tiger Data is Postgres plus TimescaleDB, so plain SQL works.
- **UI:** React, SVG and canvas for the lagoon, plain CSS for Aero styling (no heavy 3D). Framer Motion is fine for the small animations.
- **Gemini:** `@google/genai`, a current Flash model (check https://ai.google.dev/gemini-api/docs/models for the latest ID), JSON output mode.
- **Scripts:** `tsx` for `scripts/*.ts`.
- **Validation:** `zod`.

Tiger Data docs for syntax: https://docs.tigerdata.com . Claude Code must read the current docs before writing hypertable, continuous aggregate, and compression SQL, because newer versions rename some features (columnstore vs compression). Anything marked VERIFY below must be checked.

## 5. Datasets (where to find them)

Download into `data/raw/`. Do not commit large files to git (add to `.gitignore`).

1. **EPA Supply Chain GHG Emission Factors for US Industries and Commodities** (kg CO2e per dollar, by category).
   - Search catalog.data.gov for "Supply Chain Greenhouse Gas Emission Factors for US Industries and Commodities". The v1.1 xlsx download is linked from the catalog entry, and the code repo is at https://github.com/USEPA/supply-chain-factors .
   - Newer factor sets (v1.2 to v1.4, 2023 data) exist. The v1.4 set is hosted on Zenodo (search "Supply Chain Greenhouse Gas Emission Factors for U.S. Commodities v1.4.0"). Prefer the newest version you can download.
   - Use the **"with margins"** factors (cradle to shelf). EPA says these fit end consumers best.
   - Use commodity-level factors, summary or detail level, whichever is easier to map to about 12 consumer categories.
2. **BLS Consumer Expenditure Survey**, table "Age of reference person", column "Under 25 years".
   - Start at https://www.bls.gov/cex/tables.htm . 2024 data is published. Older tables follow the URL pattern `bls.gov/cex/tables/calendar-year/mean-item-share-average-standard-error/reference-person-age-ranges-<year>.pdf`, so try `...-2024.pdf`, and fall back to 2023 or 2022 if 2024 is not at that path.
   - Needed lines: food at home, food away from home, gasoline and motor oil, public and other transportation, entertainment, apparel, personal care, subscriptions/communications. These are household figures, so scale down for a single student.
3. **(Optional) merchant realism:** the simulated credit card transactions dataset on Kaggle (1,000 customers, 800 merchants, 2019 to 2020, with merchant category per row). Search Kaggle for "simulated credit card transaction dataset". Check its license before bundling. It is optional, since the simulator can use a hand-written merchant list.

Claude Code deliverable from this section: `scripts/build-factors.ts` that reads the EPA file and outputs `data/processed/category_factors.json` mapping each Aquarium category to `{ epaCode, epaName, kgPerUsd, source, year }`. Aquarium categories (adjust if the EPA table suggests better splits):
`restaurants, groceries, rideshare_taxi, gasoline, public_transit, entertainment, apparel, personal_care, electronics, subscriptions_digital, travel_air, other`.

And `scripts/build-spend-profile.ts` producing `data/processed/cohort_profile.json`: weekly mean spend per category for a student, scaled from the BLS under-25 numbers. Document the scaling assumptions in the file header.

## 6. Database schema (Tiger Data)

Claude Code must VERIFY syntax against current docs before running.

```sql
-- merchants and categories
CREATE TABLE category_factors (
  category TEXT PRIMARY KEY,
  epa_code TEXT, epa_name TEXT,
  kg_per_usd DOUBLE PRECISION NOT NULL,
  source TEXT, year INT
);

CREATE TABLE merchant_category (
  merchant TEXT PRIMARY KEY,       -- normalized (lowercase, trimmed)
  category TEXT NOT NULL REFERENCES category_factors(category),
  classified_by TEXT NOT NULL      -- 'rule' | 'gemini' | 'seed'
);

CREATE TABLE accounts (
  account_id BIGINT PRIMARY KEY,
  kind TEXT NOT NULL,              -- 'demo' (Nessie-backed) | 'cohort' (simulated)
  archetype TEXT                   -- commuter, home_cook, delivery_heavy, subscription_heavy, balanced
);

-- the hypertable
CREATE TABLE purchases (
  ts TIMESTAMPTZ NOT NULL,
  account_id BIGINT NOT NULL,
  merchant TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_usd NUMERIC(10,2) NOT NULL,
  kg_co2e DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL             -- 'nessie' | 'sim'
);
-- make it a hypertable on ts; VERIFY current syntax
-- (e.g. SELECT create_hypertable('purchases','ts') or the newer CREATE TABLE ... WITH (...) form)
CREATE INDEX ON purchases (account_id, ts DESC);

-- continuous aggregate: weekly totals per account (drives percentile + lagoon)
-- CREATE MATERIALIZED VIEW weekly_account_totals WITH (timescaledb.continuous) AS
--   SELECT time_bucket('7 days', ts) AS week, account_id,
--          SUM(kg_co2e) AS kg, SUM(amount_usd) AS usd, COUNT(*) AS n
--   FROM purchases GROUP BY week, account_id;
-- add a refresh policy (short schedule, so the demo updates within seconds; VERIFY real-time aggregation option)

-- continuous aggregate: daily per account per category (drives breakdown + swaps)
-- CREATE MATERIALIZED VIEW daily_category_totals ... time_bucket('1 day', ts), account_id, category

-- compression: segment by account_id, order by ts; policy for chunks older than ~7 days
-- (VERIFY naming: compression vs columnstore)
```

Also create one view or query for the percentile (section 8) and a small `db_stats` helper (section 9).

## 7. Simulator (the scale story)

`scripts/simulate-cohort.ts` has two modes.

**Backfill mode** (run once, before the demo): 50,000 simulated accounts, 12 weeks of history, about 5 to 8 purchases per account per week, so roughly 3 to 5 million rows. Use `COPY` (via `pg-copy-streams`) or multi-row batched inserts. Print rows/sec.

**Live mode** (run during the demo): trickle new purchases for random cohort accounts at an adjustable rate (default 500 rows/sec, flag to raise). Print a running counter. This is what drives the on-screen ingest panel.

Realism rules:
- Each account gets an archetype with category weights multiplied against `cohort_profile.json` means. Add per-account lognormal noise so weekly totals form a realistic right-skewed distribution. No uniform random data.
- Merchant names come from a hand-written list per category (about 8 to 15 per category, e.g. restaurants: Chipotle, Chick-fil-A, local pizza; rideshare: Uber, Lyft).
- Amount distributions per category (lognormal around a typical ticket size).
- `kg_co2e = amount_usd * kg_per_usd` using `category_factors`.
- Mark rows `source='sim'`, accounts `kind='cohort'`.
- The demo account is NOT simulated. It comes from Nessie.

## 8. Percentile query

Rank the demo account's current-week kg against all accounts' kg for the same week using the weekly continuous aggregate. Plain SQL is fine at this scale:

```sql
-- sketch; adapt to the aggregate's real-time behavior
WITH w AS (
  SELECT account_id, kg FROM weekly_account_totals
  WHERE week = $1
)
SELECT 100.0 * (1 - percent_rank() OVER (ORDER BY kg)) AS pct_dirtier_than_you
FROM w WHERE account_id = $2;
```

The user-facing number is "cleaner than X% of students like you" (X = share of cohort accounts with higher kg than the demo account). Return the query's measured latency with the response for the stats panel.

Edge: a partial current week makes everyone look cleaner early in the week. Compare against the cohort at the same elapsed point of the week (use a day-aligned window), or compare the last full week plus the current pace. Pick one, document it in code comments.

## 9. API routes (Next.js, server only)

- `GET /api/lagoon` : returns `{ weekKg, cohortMedianKg, clarity (0..1), percentile, runwayDays, balance, recentPurchases[], topCategories[], queryMs }`.
- `GET /api/purchases?limit=50` : the demo account's recent purchases with category, kg, factor, and the info-bubble payload (section 10).
- `POST /api/swap` : body `{ purchaseId, swapId }`, returns the recalculated `weekKg`, `clarity`, `percentile` as if swapped (read-only what-if, no writes).
- `GET /api/stats` : Tiger Data panel data: total rows in `purchases`, rows/sec over the last 10s, compression ratio (from the compression stats view; VERIFY name), p50 latency of the last 20 percentile queries, number of simulated accounts.
- `POST /api/nessie/sync` : pulls new Nessie purchases for the demo account, normalizes merchants, classifies (section 11), inserts into `purchases`. Also called by a small interval in the client (every 10s) during demo, or by a Vercel cron.
- `POST /api/dev/purchase` : creates a Nessie purchase with `{merchant, amount}` then runs sync, for demo triggers. Protect with a simple secret header and disable outside demo.

All routes return JSON and handle errors with a clear message (never crash the page).

## 10. The info bubble (no extra Gemini cost)

For each purchase, the API returns:

```ts
type InfoBubble = {
  formula: string;      // "$42.10 × 0.43 kg/$ = 18.1 kg CO2e"
  categoryLabel: string;// "Restaurants"
  epaName: string;      // EPA category name from the factors file
  source: string;       // "EPA supply chain factors v1.x (cradle to shelf)"
  caveat: string;       // "Spend-based estimate, treat as a ballpark."
  equivalent?: string;  // optional: "≈ driving 45 miles"  (use EPA avg passenger car ~400 g CO2/mile; VERIFY current value)
};
```

Everything is built in code from the stored factor, with no model call. UI: an (i) icon next to the kg value; on hover (desktop) or tap (mobile) show a small glass tooltip with the formula in a monospace line, the category and source in small text, and the caveat. Keep it to 3 short lines. Accessible: focusable, `aria-describedby`.

## 11. Gemini usage (minimal credits)

1. **Merchant classification (required).** For a merchant not in `merchant_category`: first try keyword rules (uber|lyft -> rideshare_taxi, chipotle|mcdonald|restaurant|pizza|cafe -> restaurants, etc.). If no rule matches, call Gemini once with the merchant name and the category list, JSON schema `{category: enum}`, tiny output. Store the result in `merchant_category` (`classified_by='gemini'`). Never classify the same merchant twice. Validate with zod; on failure fall back to `other`.
2. **Weekly one-liner (optional).** One call per week per demo account, cached, producing one friendly sentence of insight, under 25 words, no guilt.

No Gemini calls in the hover bubble, percentile, or swap simulator.

## 12. Swap simulator

Static table `swaps` in code (or DB): for a source category/merchant pattern, one or two lower-carbon alternatives, each with a category whose factor is lower, plus a friendly label.

Examples: Uber trip -> "Take the bus" (public_transit), delivery order -> "Cook at home" (groceries), new gadget -> "Buy refurbished" (electronics, factor scaled by a documented refurbished multiplier or just use a used-goods category if the EPA table has one).

`POST /api/swap` recomputes the week's total with the swapped purchase using the target category's factor and the same or an adjusted amount (define in the swap row, e.g. cheaper amount), then recomputes clarity and percentile. UI shows before/after clarity and percentile and animates the water clearing.

## 13. UI: Frutiger Aero, done properly

Visual rules (all required):
- **Background:** sky-blue to aqua vertical gradient, soft diagonal light rays, subtle bokeh orbs, and a lush green hill or grass strip along the bottom of the page.
- **Panels:** frosted glass cards (backdrop blur, 1px bright border, strong top highlight, soft inner glow, soft drop shadow). Rounded corners, squircle-ish (about 22 to 28px radius).
- **Buttons:** glossy gel pills with a hard highlight across the top half, gradient fill, inner shadow, pressed state.
- **Icons:** slightly skeuomorphic, squircle containers with gloss.
- **Details:** water droplets on glass, a lens flare in one corner, bubbles.
- **Type:** SF Pro Display / Helvetica Neue stack with system fallbacks. Slight text shadow on glass for legibility.
- **Motion:** gentle, slow. Bubbles rise, fish drift, light rays shimmer. Respect `prefers-reduced-motion`.
- **Reference vibe:** iOS 6 skeuomorphism plus Windows Vista/7 Aero.

Layout (desktop first, must also work on a phone for judges viewing links):
- Top bar: app name, glossy balance pill, runway pill.
- Center: the lagoon scene (SVG/canvas, about 60% of the viewport height).
- Left glass card: "Cleaner than 71% of students like you" badge and a weekly summary.
- Right glass card: recent purchase list with kg values and the (i) info icon.
- Bottom strip: category breakdown as glossy pill bars.
- Floating "Tiger Data" panel (collapsible, bottom right): live ingest rows/sec, total rows, compression ratio, p50 percentile latency, simulated accounts count. This panel exists to win the Tiger Data prize, so make it visible and attractive.
- Footer: honesty statement from section 2, plus the product name and `useaquarium.tech`.

Lagoon scene elements, each driven by one data signal:
- **Water clarity:** `clarity` 0..1 maps weekKg vs cohort median (clear when at or below the median, hazy green-brown tint and reduced visibility when well above, capped so it never looks gross or alarming).
- **Fish:** a school of about 8 to 12 simple glossy fish. They roam the center when clarity is high and drift toward the edges and slow down when low. They never disappear.
- **Coral and plants:** grow fuller with a streak of low-carbon weeks, look muted when hazy. No bleaching imagery.
- **Bubbles:** one per recent purchase, size by dollar amount, rising slowly. Hover shows the purchase tooltip. Click opens the swap drawer.
- **Runway:** a row of glowing lanterns (or a sun gauge) along the shore, one per day of runway (cap at about 14), dimming from the right as days drop. Nothing goes dark entirely.
- **Percentile badge:** a glossy gel badge floating on the water.

Implementation hint for Claude Code: build the scene as a single React component with layered SVG for static elements and one `<canvas>` for animated bubbles and fish, driven by the `/api/lagoon` payload. Keep the animation loop under about 60 lines. Get a static version working first, then add motion.

## 14. File layout

```
app/
  page.tsx                  // dashboard
  api/lagoon/route.ts
  api/purchases/route.ts
  api/swap/route.ts
  api/stats/route.ts
  api/nessie/sync/route.ts
  api/dev/purchase/route.ts
components/
  Lagoon.tsx  GlassCard.tsx  GelButton.tsx  PercentileBadge.tsx
  PurchaseList.tsx  InfoBubble.tsx  SwapDrawer.tsx
  RunwayLanterns.tsx  TigerPanel.tsx  CategoryBars.tsx
lib/
  db.ts  nessie.ts  gemini.ts  carbon.ts  classify.ts  swaps.ts  clarity.ts
scripts/
  build-factors.ts  build-spend-profile.ts
  migrate.ts  seed-nessie.ts  simulate-cohort.ts
data/raw/  data/processed/
SPEC_AQUARIUM.md
.env.example
```

## 15. Build order (sequence only, no time limits)

Each step depends on the one before it. Move on when the checkpoint passes.

1. **Scaffold:** Next.js app, `.env.example`, git repo, first Vercel deploy. Checkpoint: the deploy URL loads.
2. **Data foundations:** `build-factors`, `build-spend-profile`, `migrate` (schema, hypertable, aggregates, compression), `seed-nessie`, Nessie sync. Checkpoint: demo account purchases appear in `purchases` with kg values.
3. **Cohort and queries:** `simulate-cohort` backfill, percentile query, `/api/lagoon`, `/api/purchases`. Checkpoint: percentile returns quickly and the numbers look plausible.
4. **Static UI:** Aero styling, dashboard layout, static lagoon, purchase list, info bubble, percentile badge. Checkpoint: the full page looks right with real data, no animation yet.
5. **Motion and features:** lagoon animation (bubbles, fish, clarity), runway lanterns, swap simulator, Tiger Data panel, live simulator mode. Checkpoint: a live purchase makes a bubble rise and the numbers update.
6. **Intelligence and polish:** Gemini classification cache, domain, mobile layout, bug fixes, README, `.env.example` check, fresh demo data.
7. **Demo and submission:** run the demo script end to end a few times, record the demo video, write the Devpost text, push final code, submit.

Cut order if scope needs trimming: Gemini weekly one-liner, then fish animation (keep bubbles and clarity), then mobile polish, then the domain. Never cut: Nessie data in the app, the Tiger Data panel, the percentile, the info bubble, a deployed URL.

## 16. Demo script (keep the video at 2 minutes or less)

1. "Students can't see the carbon cost of what they buy, so we built a lagoon that shows it."
2. Open the app: lagoon, bubbles for recent purchases, percentile badge. Hover the (i) on a bubble to show the formula.
3. Trigger `POST /api/dev/purchase` for an Uber ride. A new bubble rises, the water hazes slightly, the percentile drops.
4. Open the swap drawer on that bubble, choose "Take the bus", and watch the water clear and the percentile climb.
5. Open the Tiger Data panel while the simulator streams: live rows/sec, millions of rows, compression ratio, percentile query latency. State clearly that the cohort is simulated and calibrated to BLS data.
6. Close: Nessie for the bank data, Gemini for classification, Tiger Data for scale, and where it goes next (real bank connections via an aggregator, campus-level challenges).

## 17. Judging alignment (what to say if asked)

- **Impact:** makes an invisible cost visible, in a way that is calming and not guilt-inducing; benchmarks you against peers.
- **Technical complexity:** hypertable, continuous aggregates with real-time queries, compression policy, millions of simulated rows, caching classification, deterministic explainability.
- **Creativity:** carbon plus peer benchmarking in a living scene, instead of a dashboard of numbers.
- **Honesty:** simulated cohort and estimates are labeled in the product.

## 18. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Tiger Data free tier blocks an extension or size | Skip the Toolkit, use plain `percent_rank()`; reduce backfill to 10,000 accounts; say the real number in the pitch |
| Continuous aggregate refresh lag in the demo | Use real-time aggregation or query the hypertable directly for the demo account's current week |
| Nessie shapes or limits differ | Seed the demo account directly into `purchases` as `source='nessie_fixture'`, keep the Nessie code path for the prize but label the fixture honestly |
| EPA file mapping takes too long | Use a smaller set of about 8 categories; document which EPA commodity each maps to |
| Animation takes too long | Ship static scene plus rising bubbles and a clarity tint; fish are optional |
| Vercel function timeouts on heavy queries | Percentile query reads from the aggregate, not the raw hypertable; cache the response for 5 seconds |
| Domain DNS slow | Submit with the `*.vercel.app` URL; add the domain after |