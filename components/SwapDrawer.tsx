'use client';

import { motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { PurchaseOut, SwapResult } from '@/lib/types';
import GelButton from './GelButton';

const OFFSCREEN = 480; // drawer enters from and exits to the right (same path both ways)
const DECELERATION = 0.998;

// Where a flick would come to rest: exponential-decay projection (Apple's scroll deceleration).
const project = (velocity: number) => ((velocity / 1000) * DECELERATION) / (1 - DECELERATION);

export default function SwapDrawer({
  purchase,
  onClose,
  onResult,
}: {
  purchase: PurchaseOut;
  onClose: () => void;
  onResult: (r: SwapResult | null) => void;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(reduce ? 0 : OFFSCREEN);
  // The scrim follows the drawer 1:1, so dragging, entering and exiting all dim the page together.
  const scrim = useTransform(x, [0, OFFSCREEN * 0.8], [1, 0]);

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

  function onDragEnd(_: unknown, info: PanInfo) {
    // Decide from where the flick is GOING, not where the finger let go.
    const projected = info.offset.x + project(info.velocity.x);
    if (projected > 160) onClose();
  }

  // Critically damped by default: no overshoot on a plain tap. Reduced motion: a short cross-fade.
  const spring = reduce ? { duration: 0.15 } : { type: 'spring' as const, bounce: 0, duration: 0.42 };

  return (
    <>
      <motion.div
        className="drawer-scrim"
        style={{ opacity: reduce ? 1 : scrim }}
        initial={reduce ? { opacity: 0 } : undefined}
        animate={reduce ? { opacity: 1 } : undefined}
        exit={reduce ? { opacity: 0 } : undefined}
        onClick={onClose}
      />
      <motion.aside
        className="glass drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Swap simulator"
        style={{ x }}
        initial={reduce ? { opacity: 0 } : undefined}
        animate={reduce ? { opacity: 1 } : { x: 0 }}
        exit={reduce ? { opacity: 0 } : { x: OFFSCREEN }}
        transition={spring}
        drag={reduce ? false : 'x'}
        dragConstraints={{ left: 0 }}
        dragElastic={{ left: 0.1, right: 1 }} // rubber-band on the side with nowhere to go
        dragMomentum={false}
        dragSnapToOrigin
        onDragEnd={onDragEnd}
      >
        <div className="grabber" aria-hidden />
        <h2 className="card-title">Swap simulator</h2>
        <p className="drawer-purchase">
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
      </motion.aside>
    </>
  );
}
