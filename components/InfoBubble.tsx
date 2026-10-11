'use client';

import { useId, useState } from 'react';
import type { InfoBubble as Info } from '@/lib/bubble';

/** (i) icon: hover or focus on desktop, tap on mobile. Three short lines of explanation. */
export default function InfoBubble({ info }: { info: Info }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="info-wrap"
      data-open={open}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-btn"
        aria-label={`How ${info.categoryLabel} carbon is estimated`}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      <span id={id} role="tooltip" className="info-tip">
        <span className="mono" style={{ display: 'block' }}>{info.formula}</span>
        <span className="src" style={{ display: 'block' }}>
          {info.categoryLabel} · {info.epaName} · {info.source}
        </span>
        <span className="src" style={{ display: 'block' }}>
          {info.caveat}
          {info.equivalent ? ` ${info.equivalent}` : ''}
        </span>
      </span>
    </span>
  );
}
