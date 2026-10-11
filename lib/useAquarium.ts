'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LagoonData, Stats } from './types';

/** Polls the lagoon and stats, and pulls new Nessie purchases every 10s. */
export function useAquarium() {
  const [data, setData] = useState<LagoonData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      /* keep the last values */
    }
  }, []);

  useEffect(() => {
    loadLagoon();
    loadStats();
    const a = setInterval(loadLagoon, 6000);
    const b = setInterval(loadStats, 3000);
    const c = setInterval(async () => {
      try {
        const res = await fetch('/api/nessie/sync', { method: 'POST' });
        const j = await res.json();
        if (j.inserted > 0) loadLagoon();
      } catch {
        /* retried next tick */
      }
    }, 10000);
    return () => {
      clearInterval(a);
      clearInterval(b);
      clearInterval(c);
    };
  }, [loadLagoon, loadStats]);

  return { data, stats, error, refresh: loadLagoon };
}

/** Pointer-driven CSS variables: parallax (--pxn/--pyn in -1..1) and a per-element glass sheen. */
export function usePointerFx() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.documentElement;
    let tx = 0, ty = 0, cx = 0, cy = 0, mx = -999, my = -999;
    let raf = 0;
    let sheenQueued = false;

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      mx = e.clientX;
      my = e.clientY;
      if (!sheenQueued) {
        sheenQueued = true;
        requestAnimationFrame(() => {
          sheenQueued = false;
          document.querySelectorAll<HTMLElement>('.lg').forEach((el) => {
            const r = el.getBoundingClientRect();
            el.style.setProperty('--lx', `${mx - r.left}px`);
            el.style.setProperty('--ly', `${my - r.top}px`);
          });
        });
      }
    };
    const tick = () => {
      // Ease the parallax so layers glide instead of tracking the cursor rigidly.
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      root.style.setProperty('--pxn', cx.toFixed(4));
      root.style.setProperty('--pyn', cy.toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
}
