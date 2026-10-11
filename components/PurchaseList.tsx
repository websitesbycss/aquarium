'use client';

import type { PurchaseOut } from '@/lib/types';
import GelButton from './GelButton';
import InfoBubble from './InfoBubble';

function when(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function PurchaseList({
  purchases,
  onSwap,
}: {
  purchases: PurchaseOut[];
  onSwap: (p: PurchaseOut) => void;
}) {
  if (!purchases.length) return <p>No purchases yet. New ones will float up here.</p>;
  return (
    <ul className="plist">
      {purchases.map((p) => (
        <li key={p.id} className="pitem">
          <span className="m">{p.merchant}</span>
          <span className="kg">
            {p.kg.toFixed(1)} kg
            <InfoBubble info={p.info} />
          </span>
          <span className="sub">
            ${p.amountUsd.toFixed(2)} · {p.info.categoryLabel} · {when(p.ts)}
          </span>
          <span />
          {p.swaps.length > 0 && (
            <span className="actions">
              {p.swaps.map((s) => (
                <GelButton key={s.id} mini green onClick={() => onSwap(p)} title={s.note}>
                  {s.label}
                </GelButton>
              ))}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
