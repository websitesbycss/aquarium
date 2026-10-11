'use client';

import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import Dock, { type SheetId } from '@/components/Dock';
import Gauge from '@/components/Gauge';
import Island from '@/components/Island';
import LiquidDefs from '@/components/LiquidDefs';
import Orbs from '@/components/Orbs';
import { AboutBody, BreakdownPanel, PurchasesPanel, TigerBody } from '@/components/Panels';
import Scene from '@/components/Scene';
import Sheet from '@/components/Sheet';
import StringLights from '@/components/StringLights';
import SwapCard from '@/components/SwapCard';
import TigerChip from '@/components/TigerChip';
import { usePointerFx, useAquarium } from '@/lib/useAquarium';
import { HONESTY, type PurchaseOut, type SwapResult } from '@/lib/types';

const TITLES: Record<SheetId, string> = {
  purchases: 'Recent purchases',
  breakdown: 'Where the carbon comes from',
  tiger: 'Tiger Data, live',
  about: 'About the numbers',
};

function noteFor(clarity: number): string {
  if (clarity >= 0.85) return 'Clear skies. Your lagoon is sparkling this week.';
  if (clarity >= 0.55) return 'Clear skies ahead: swap one ride to bring the sparkle back.';
  return 'Your lagoon is resting this week.';
}

function useCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const set = () => setCompact(mq.matches);
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  }, []);
  return compact;
}

export default function Home() {
  const { data, stats, error } = useAquarium();
  usePointerFx();
  const compact = useCompact();

  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [swap, setSwap] = useState<PurchaseOut | null>(null);
  const [whatIf, setWhatIf] = useState<SwapResult | null>(null);

  const openSwap = useCallback((p: PurchaseOut) => {
    setSheet(null);
    setSwap(p);
  }, []);
  const closeSwap = useCallback(() => {
    setSwap(null);
    setWhatIf(null);
  }, []);
  const toggleSheet = useCallback((id: SheetId) => {
    setSwap(null);
    setWhatIf(null);
    setSheet((cur) => (cur === id ? null : id));
  }, []);

  const clarity = whatIf?.after.clarity ?? data?.clarity ?? 1;
  const percentile = whatIf?.after.percentile ?? data?.percentile ?? 0;
  const weekKg = whatIf?.after.weekKg ?? data?.weekKg ?? null;
  const dimmed = sheet !== null || swap !== null;

  return (
    <LayoutGroup>
      <LiquidDefs />
      <Scene clarity={clarity} />

      <main className={`stage ${dimmed ? 'pushed' : ''}`}>
        <StringLights days={data?.runwayDays ?? null} />

        <div className="top-row">
          <Island data={data} weekKg={weekKg} />
        </div>
        <TigerChip stats={stats} onOpen={() => toggleSheet('tiger')} />

        <motion.div
          className={`hero ${swap ? 'lifted' : ''}`}
          initial={{ opacity: 0, scale: 0.7, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', bounce: 0.2, duration: 1.2, delay: 0.2 }}
        >
          <Gauge percentile={percentile} previewing={whatIf !== null} />
          <p className="hero-note lg refract" aria-live="polite">
            {whatIf ? `Previewing: ${whatIf.swap.label}` : noteFor(clarity)}
          </p>
        </motion.div>

        {data ? (
          <Orbs purchases={data.recentPurchases} selectedId={swap?.id ?? null} onSelect={openSwap} max={compact ? 6 : 12} compact={compact} />
        ) : (
          <p className="loading">Filling the lagoon…</p>
        )}
        {error && !data && <p className="err toast">{error}. Retrying shortly.</p>}
      </main>

      <Dock active={sheet} onSelect={toggleSheet} />

      <AnimatePresence>
        {sheet && (
          <Sheet key={sheet} title={TITLES[sheet]} onClose={() => setSheet(null)}>
            {sheet === 'purchases' && <PurchasesPanel purchases={data?.recentPurchases ?? []} onSwap={openSwap} />}
            {sheet === 'breakdown' && <BreakdownPanel cats={data?.topCategories ?? []} />}
            {sheet === 'tiger' && <TigerBody stats={stats} />}
            {sheet === 'about' && <AboutBody />}
          </Sheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {swap && <SwapCard key={swap.id} purchase={swap} onClose={closeSwap} onResult={setWhatIf} />}
      </AnimatePresence>

      <footer className="honesty">
        <span>{HONESTY}</span>
        <span className="sep"> · </span>
        <b>Aquarium</b> · useaquarium.tech
      </footer>
    </LayoutGroup>
  );
}
