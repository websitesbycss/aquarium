'use client';

import { motion } from 'framer-motion';
import { CATEGORY_LABELS } from '@/lib/bubble';
import { HONESTY, type LagoonData, type PurchaseOut, type Stats } from '@/lib/types';
import AnimatedNumber from './AnimatedNumber';
import PurchaseList from './PurchaseList';

const BAR_HUE: Record<string, string> = {
  restaurants: '#ff8a5c', groceries: '#6fd44a', rideshare_taxi: '#ffc933', gasoline: '#ff6f91',
  public_transit: '#3fa9ff', entertainment: '#b97bff', apparel: '#ff8fd6', personal_care: '#ffb0c4',
  electronics: '#39e0f5', subscriptions_digital: '#7e8cff', travel_air: '#2fe0b8', other: '#a9c8e6',
};

export function PurchasesPanel({ purchases, onSwap }: { purchases: PurchaseOut[]; onSwap: (p: PurchaseOut) => void }) {
  return <PurchaseList purchases={purchases} onSwap={onSwap} />;
}

export function BreakdownPanel({ cats }: { cats: LagoonData['topCategories'] }) {
  if (!cats.length) return <p>No spending this week yet. New purchases will appear here.</p>;
  const max = Math.max(...cats.map((c) => c.kg), 0.01);
  const total = cats.reduce((a, c) => a + c.kg, 0);
  return (
    <div className="breakdown">
      <p className="lede">
        <AnimatedNumber value={total} decimals={1} /> kg CO2e over the last 7 days, by where it came from.
      </p>
      {cats.map((c, i) => (
        <div className="brow" key={c.category}>
          <span className="blabel">{CATEGORY_LABELS[c.category] ?? c.category}</span>
          <div className="btrack">
            <motion.div
              className="bfill"
              style={{ ['--hue' as string]: BAR_HUE[c.category] ?? BAR_HUE.other }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(5, (c.kg / max) * 100)}%` }}
              transition={{ type: 'spring', bounce: 0, duration: 1.1, delay: 0.1 + i * 0.07 }}
            />
          </div>
          <span className="bval">
            <AnimatedNumber value={c.kg} decimals={1} /> kg
          </span>
        </div>
      ))}
    </div>
  );
}

export function TigerBody({ stats }: { stats: Stats | null }) {
  const tile = (label: string, node: React.ReactNode, hint?: string) => (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <b className="tile-value">{node}</b>
      {hint ? <span className="tile-hint">{hint}</span> : null}
    </div>
  );
  return (
    <div>
      <p className="lede">
        The cohort lives in Tiger Data: a hypertable with continuous aggregates and columnstore compression.
        Every percentile on this page is a query against it.
      </p>
      <div className="tiles">
        {tile('Ingest', stats ? <><AnimatedNumber value={stats.rowsPerSec} /> <small>rows/sec</small></> : '…', 'live when the simulator runs')}
        {tile('Total rows', stats ? <AnimatedNumber value={stats.totalRows} /> : '…')}
        {tile('Compression', stats?.compressionRatio ? <><AnimatedNumber value={stats.compressionRatio} decimals={1} />×</> : '…', stats ? `${stats.compressedChunks} of ${stats.totalChunks} chunks in columnstore` : undefined)}
        {tile('Percentile p50', stats?.p50PercentileMs != null ? <><AnimatedNumber value={stats.p50PercentileMs} /> <small>ms</small></> : '…', 'median of recent queries')}
        {tile('Simulated accounts', stats ? <AnimatedNumber value={stats.simulatedAccounts} /> : '…')}
      </div>
    </div>
  );
}

export function AboutBody() {
  return (
    <div className="about">
      <p className="lede">{HONESTY}</p>
      <h3>How a bubble is sized</h3>
      <p>
        Each purchase is <b>spend × an EPA supply-chain emission factor</b> for its category (kg CO2e per
        dollar, cradle to shelf). It is an estimate of the carbon behind a dollar, not a measurement of
        what you bought. Tap the <i>i</i> on any purchase to see its exact math.
      </p>
      <h3>How you compare</h3>
      <p>
        Your last seven days against the same seven days for every simulated student. The cohort is
        synthetic, with spending calibrated to BLS Consumer Expenditure averages for people under 25.
      </p>
      <h3>Swaps</h3>
      <p>
        A swap is a what-if: it re-prices the purchase in another category and shows where you would
        land. Nothing is saved. Savings come from the lower factor, the lower spend, or both. Several
        ratios are assumptions and are labeled as such.
      </p>
    </div>
  );
}
