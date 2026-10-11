'use client';

import { useState } from 'react';
import type { Stats } from '@/lib/types';

const n = (v: number | null | undefined, d = 0) =>
  v === null || v === undefined ? '…' : v.toLocaleString(undefined, { maximumFractionDigits: d });

export default function TigerPanel({ stats }: { stats: Stats | null }) {
  const [open, setOpen] = useState(true);
  return (
    <aside className={`glass tiger ${open ? '' : 'collapsed'}`} aria-label="Tiger Data live stats">
      <div className="tiger-head">
        <h3>
          <span className="live" aria-hidden />
          Tiger Data
        </h3>
        <button type="button" className="gel mini" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 8 }}>
          <div className="stat"><span>Ingest</span><b className="num">{n(stats?.rowsPerSec, 0)} rows/sec</b></div>
          <div className="stat"><span>Total rows</span><b className="num">{n(stats?.totalRows)}</b></div>
          <div className="stat"><span>Compression</span><b className="num">{stats?.compressionRatio ? `${stats.compressionRatio}x` : '…'}</b></div>
          <div className="stat"><span>Percentile p50</span><b className="num">{n(stats?.p50PercentileMs)} ms</b></div>
          <div className="stat"><span>Simulated accounts</span><b className="num">{n(stats?.simulatedAccounts)}</b></div>
        </div>
      )}
    </aside>
  );
}
