'use client';

import { motion } from 'framer-motion';
import { useRef } from 'react';
import type { PurchaseOut } from '@/lib/types';

// Resting spots inside the water field, as percentages. Each purchase keeps its slot for life,
// so a new arrival never makes the others jump.
const SLOTS: [number, number][] = [
  [22, 30], [54, 20], [80, 34], [36, 58], [66, 52], [90, 62],
  [14, 74], [48, 82], [78, 80], [34, 12], [92, 16], [60, 70],
];

const COMPACT_SLOTS: [number, number][] = [
  [20, 24], [52, 16], [82, 26], [24, 72], [54, 78], [84, 70], [50, 46], [14, 48],
];

const TINT: Record<string, string> = {
  restaurants: '#ff8a5c', groceries: '#6fd44a', rideshare_taxi: '#ffd23f', gasoline: '#ff6f91',
  public_transit: '#3fa9ff', entertainment: '#b97bff', apparel: '#ff8fd6', personal_care: '#ffb0c4',
  electronics: '#39e0f5', subscriptions_digital: '#7e8cff', travel_air: '#2fe0b8', other: '#a9c8e6',
};

const hash = (n: number) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

export default function Orbs({
  purchases,
  selectedId,
  onSelect,
  max,
  compact,
}: {
  purchases: PurchaseOut[];
  selectedId: number | null;
  onSelect: (p: PurchaseOut) => void;
  max: number;
  compact: boolean;
}) {
  const field = useRef<HTMLDivElement>(null);
  const slots = useRef(new Map<number, number>());

  const shown = purchases.slice(0, max);
  // Free slots whose purchase left the list, then give new purchases the first free slot.
  const live = new Set(shown.map((p) => p.id));
  for (const id of [...slots.current.keys()]) if (!live.has(id)) slots.current.delete(id);
  const used = new Set(slots.current.values());
  for (const p of shown) {
    if (slots.current.has(p.id)) continue;
    let s = 0;
    while (used.has(s) && s < SLOTS.length - 1) s++;
    slots.current.set(p.id, s);
    used.add(s);
  }

  return (
    <div className="orb-field" ref={field}>
      {shown.map((p, i) => {
        const set = compact ? COMPACT_SLOTS : SLOTS;
        const [x, y] = set[Math.min(slots.current.get(p.id) ?? 0, set.length - 1)];
        const size = compact
          ? Math.round(Math.min(104, Math.max(68, 56 + Math.sqrt(p.amountUsd) * 4.6)))
          : Math.round(Math.min(150, Math.max(86, 72 + Math.sqrt(p.amountUsd) * 6.5)));
        const tint = TINT[p.category] ?? TINT.other;
        const r = hash(p.id);
        return (
          <div
            key={p.id}
            className="orb-slot"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              ['--bx' as string]: `${Math.round((r - 0.5) * 22)}px`,
              ['--by' as string]: `${Math.round(-10 - r * 16)}px`,
              ['--bd' as string]: `${(6 + r * 5).toFixed(1)}s`,
              ['--bdelay' as string]: `-${(r * 6).toFixed(1)}s`,
            }}
          >
            <motion.button
              type="button"
              layoutId={`orb-${p.id}`}
              className="orb"
              aria-label={`${p.merchant}, $${p.amountUsd.toFixed(2)}, ${p.kg.toFixed(1)} kilograms CO2e. Open swap simulator.`}
              style={{ width: size, height: size, borderRadius: 999, ['--tint' as string]: tint }}
              initial={{ y: 420, scale: 0.35, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: selectedId === p.id ? 0 : 1 }}
              transition={{ type: 'spring', bounce: 0.12, duration: 1.7, delay: Math.min(i, 8) * 0.08 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              drag
              dragConstraints={field}
              dragElastic={0.22}
              dragTransition={{ bounceStiffness: 220, bounceDamping: 22, power: 0.35 }}
              onTap={() => onSelect(p)}
            >
              <span className="orb-glass" />
              <span className="orb-spec" />
              <span className="orb-arc" />
              <span className="orb-label">
                <b>${p.amountUsd < 100 ? p.amountUsd.toFixed(0) : Math.round(p.amountUsd)}</b>
                <i>{p.merchant}</i>
                <em>{p.kg.toFixed(1)} kg</em>
              </span>
            </motion.button>
          </div>
        );
      })}
    </div>
  );
}
