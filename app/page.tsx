'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import CategoryBars from '@/components/CategoryBars';
import GelButton from '@/components/GelButton';
import GlassCard from '@/components/GlassCard';
import Lagoon from '@/components/Lagoon';
import PercentileBadge from '@/components/PercentileBadge';
import PurchaseList from '@/components/PurchaseList';
import SwapDrawer from '@/components/SwapDrawer';
import TigerPanel from '@/components/TigerPanel';
import { HONESTY, type LagoonData, type PurchaseOut, type Stats, type SwapResult } from '@/lib/types';

const BOKEH = [
  { l: '6%', t: '14%', s: 90, d: 0 },
  { l: '78%', t: '10%', s: 130, d: 4 },
  { l: '90%', t: '52%', s: 70, d: 8 },
  { l: '12%', t: '62%', s: 110, d: 2 },
  { l: '48%', t: '8%', s: 60, d: 6 },
];

export default function Home() {
  const [data, setData] = useState<LagoonData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<PurchaseOut | null>(null);
  const [whatIf, setWhatIf] = useState<SwapResult | null>(null);

  const loadLagoon = useCallback(async () => {
    try {
      const res = await fetch('/api/lagoon', { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Could not load the lagoon');
      setData(j);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' });
      if (res.ok) setStats(await res.json());
    } catch {
      /* the panel just keeps its last values */
    }
  }, []);

  useEffect(() => {
    loadLagoon();
    loadStats();
    const a = setInterval(loadLagoon, 6000);
    const b = setInterval(loadStats, 3000);
    // Pull new Nessie purchases every 10s; refresh the lagoon only if something arrived.
    const c = setInterval(async () => {
      try {
        const res = await fetch('/api/nessie/sync', { method: 'POST' });
        const j = await res.json();
        if (j.inserted > 0) loadLagoon();
      } catch {
        /* retried on the next tick */
      }
    }, 10000);
    return () => {
      clearInterval(a);
      clearInterval(b);
      clearInterval(c);
    };
  }, [loadLagoon, loadStats]);

  const closeDrawer = useCallback(() => {
    setDrawer(null);
    setWhatIf(null);
  }, []);

  const clarity = whatIf?.after.clarity ?? data?.clarity ?? 1;
  const percentile = whatIf?.after.percentile ?? data?.percentile ?? 0;

  return (
    <>
      <div className="bokeh" aria-hidden>
        {BOKEH.map((b, i) => (
          <i key={i} style={{ left: b.l, top: b.t, width: b.s, height: b.s, animationDelay: `-${b.d}s` }} />
        ))}
      </div>
      <div className="flare" aria-hidden />
      <div className="hill" aria-hidden />

      <main className="shell">
        <header className="topbar">
          <div className="brand">
            <Image
              src="/aquarium-logo-purple-text.png"
              alt=""
              width={2917}
              height={677}
              priority
              className="logo"
            />
            <h1 className="sr-only">Aquarium</h1>
          </div>
          <div className="pills">
            <span className="gel static">
              Balance {data?.balance != null ? `$${data.balance.toFixed(2)}` : '…'}
            </span>
            <span className="gel green static">
              Runway {data?.runwayDays != null ? `${data.runwayDays} days` : '…'}
            </span>
            <GelButton onClick={loadLagoon}>Refresh</GelButton>
          </div>
        </header>

        {error && !data && <p className="err">{error}. Retrying shortly.</p>}

        <div className="grid">
          <GlassCard title="This week">
            {data ? (
              <>
                <div>
                  <div className="stat"><span>Your week</span><b>{(whatIf?.after.weekKg ?? data.weekKg).toFixed(1)} kg CO2e</b></div>
                  <div className="stat"><span>Typical student</span><b>{data.cohortMedianKg.toFixed(1)} kg</b></div>
                  <div className="stat"><span>Spent</span><b>${data.weekUsd.toFixed(2)}</b></div>
                  <div className="stat"><span>Compared with</span><b>{data.cohortSize.toLocaleString()} students</b></div>
                </div>
                {whatIf && <p style={{ fontWeight: 700 }}>Previewing: {whatIf.swap.label}</p>}
              </>
            ) : (
              <p>Filling the lagoon…</p>
            )}
          </GlassCard>

          <GlassCard className="lagoon-wrap">
            <Lagoon
              purchases={data?.recentPurchases ?? []}
              clarity={clarity}
              runwayDays={data?.runwayDays ?? null}
              onSelect={setDrawer}
            >
              <div className="badge-float">
                <PercentileBadge percentile={percentile} />
              </div>
            </Lagoon>
          </GlassCard>

          <GlassCard title="Recent purchases">
            <PurchaseList purchases={data?.recentPurchases ?? []} onSwap={setDrawer} />
          </GlassCard>
        </div>

        <GlassCard title="Where the carbon comes from this week" className="bottom-strip">
          <CategoryBars cats={data?.topCategories ?? []} />
        </GlassCard>

        <footer className="footer">
          <p>{HONESTY}</p>
          <p>
            <b>Aquarium</b> · useaquarium.tech
          </p>
        </footer>
      </main>

      {drawer && <SwapDrawer purchase={drawer} onClose={closeDrawer} onResult={setWhatIf} />}
      <TigerPanel stats={stats} />
    </>
  );
}
