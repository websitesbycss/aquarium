'use client';

import { useEffect, useState } from 'react';
import type { PurchaseOut, SwapResult } from '@/lib/types';
import GelButton from './GelButton';

export default function SwapDrawer({
  purchase,
  onClose,
  onResult,
}: {
  purchase: PurchaseOut;
  onClose: () => void;
  onResult: (r: SwapResult | null) => void;
}) {
  const [result, setResult] = useState<SwapResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function choose(swapId: string) {
    setBusy(swapId);
    setError(null);
    try {
      const res = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ purchaseId: purchase.id, swapId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Could not run the swap');
      setResult(j);
      onResult(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="glass drawer" role="dialog" aria-modal="true" aria-label="Swap simulator">
        <h2 className="card-title">Swap simulator</h2>
        <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 18 }}>
          {purchase.merchant} · ${purchase.amountUsd.toFixed(2)} · {purchase.kg.toFixed(1)} kg
        </p>
        <p style={{ margin: 0, fontSize: 13 }}>Pick an alternative and watch the water.</p>

        {purchase.swaps.map((s) => (
          <button key={s.id} className="swap-opt" onClick={() => choose(s.id)} disabled={busy !== null}>
            <span className="lbl">{busy === s.id ? 'Checking…' : s.label}</span>
            <span className="nt">
              ${s.newAmountUsd.toFixed(2)} · {s.newKg.toFixed(1)} kg · {s.note}
            </span>
          </button>
        ))}

        {error && <p className="err" style={{ marginTop: 12 }}>{error}</p>}

        {result && (
          <div className="ba" aria-live="polite">
            <div>
              <div className="l">Before</div>
              <div className="v">{result.before.percentile}%</div>
              <div className="l">{result.before.weekKg.toFixed(1)} kg this week</div>
            </div>
            <div>
              <div className="l">After</div>
              <div className="v">{result.after.percentile}%</div>
              <div className="l">{result.after.weekKg.toFixed(1)} kg this week</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {result && (
            <GelButton onClick={() => { setResult(null); onResult(null); }}>Reset</GelButton>
          )}
          <GelButton green onClick={onClose}>Done</GelButton>
        </div>
      </aside>
    </>
  );
}
