'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { PurchaseOut, SwapResult } from '@/lib/types';
import AnimatedNumber from './AnimatedNumber';
import GelButton from './GelButton';

/**
 * The tapped orb morphs into this card (shared layoutId), so the card visibly comes FROM the
 * purchase. Previewing a swap drives the vial and the scene behind it; nothing is saved.
 */
export default function SwapCard({
  purchase,
  onClose,
  onResult,
}: {
  purchase: PurchaseOut;
  onClose: () => void;
  onResult: (r: SwapResult | null) => void;
}) {
  const reduce = useReducedMotion();
  const [result, setResult] = useState<SwapResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
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
      setPicked(swapId);
      onResult(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const saved = result ? Math.max(0, result.purchase.oldKg - result.purchase.newKg) : 0;

  return (
    <>
      <motion.div
        className="scrim light"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.section
        layoutId={`orb-${purchase.id}`}
        className="swapcard lg refract-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Swap simulator"
        style={{ borderRadius: 30 }}
        transition={reduce ? { duration: 0.15 } : { type: 'spring', bounce: 0.1, duration: 0.6 }}
      >
        <motion.div
          className="swap-inner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ delay: 0.12, duration: 0.25 }}
        >
          <header className="sheet-head">
            <div>
              <span className="eyebrow">Swap simulator</span>
              <h2>
                {purchase.merchant} <span className="muted">· ${purchase.amountUsd.toFixed(2)}</span>
              </h2>
              <p className="mono">{purchase.info.formula}</p>
            </div>
            <button type="button" className="close-gel" onClick={onClose} aria-label="Close">×</button>
          </header>

          <p className="lede">Pick an alternative and watch the water.</p>

          <div className="swap-opts">
            {purchase.swaps.map((s) => (
              <motion.button
                key={s.id}
                type="button"
                className={`swap-opt ${picked === s.id ? 'picked' : ''}`}
                onClick={() => choose(s.id)}
                disabled={busy !== null}
                whileTap={{ scale: 0.98 }}
                whileHover={{ y: -2 }}
              >
                <span className="lbl">{busy === s.id ? 'Checking…' : s.label}</span>
                <span className="nt">
                  ${s.newAmountUsd.toFixed(2)} · {s.newKg.toFixed(1)} kg · {s.note}
                </span>
              </motion.button>
            ))}
            {purchase.swaps.length === 0 && <p>No lower-carbon swap is defined for this category yet.</p>}
          </div>

          {error && <p className="err">{error}</p>}

          {result && (
            <motion.div
              className="ba"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', bounce: 0.15, duration: 0.6 }}
              aria-live="polite"
            >
              <div>
                <span className="l">Before</span>
                <span className="v"><AnimatedNumber value={result.before.percentile} suffix="%" /></span>
                <span className="l">{result.before.weekKg.toFixed(1)} kg this week</span>
              </div>
              <div className="arrow" aria-hidden>→</div>
              <div className="after">
                <span className="l">After</span>
                <span className="v"><AnimatedNumber value={result.after.percentile} suffix="%" /></span>
                <span className="l">{result.after.weekKg.toFixed(1)} kg this week</span>
              </div>
              <p className="saved">
                Saves about <b><AnimatedNumber value={saved} decimals={1} /> kg</b> on this purchase.
              </p>
            </motion.div>
          )}

          <div className="swap-actions">
            {result && (
              <GelButton onClick={() => { setResult(null); setPicked(null); onResult(null); }}>Reset</GelButton>
            )}
            <GelButton green onClick={onClose}>Done</GelButton>
          </div>
        </motion.div>
      </motion.section>
    </>
  );
}
