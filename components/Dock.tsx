'use client';

import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

export type SheetId = 'purchases' | 'breakdown' | 'tiger' | 'about';

const ICONS: Record<SheetId, ReactNode> = {
  purchases: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1.2" fill="currentColor" /><circle cx="4" cy="12" r="1.2" fill="currentColor" /><circle cx="4" cy="18" r="1.2" fill="currentColor" />
    </svg>
  ),
  breakdown: (
    <svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="12" width="4.5" height="9" rx="1.6" /><rect x="9.8" y="6" width="4.5" height="15" rx="1.6" /><rect x="16.6" y="9" width="4.5" height="12" rx="1.6" /></svg>
  ),
  tiger: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  ),
  about: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="7.4" r="0.6" fill="currentColor" />
    </svg>
  ),
};

const ITEMS: { id: SheetId; label: string; hue: string }[] = [
  { id: 'purchases', label: 'Purchases', hue: 'blue' },
  { id: 'breakdown', label: 'Breakdown', hue: 'green' },
  { id: 'tiger', label: 'Tiger Data', hue: 'orange' },
  { id: 'about', label: 'About the numbers', hue: 'purple' },
];

function DockIcon({
  id, label, hue, active, mouseX, onSelect,
}: {
  id: SheetId; label: string; hue: string; active: boolean; mouseX: MotionValue<number>; onSelect: (id: SheetId) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  // Magnification: size follows the pointer's distance to this icon's center, on a spring.
  const distance = useTransform(mouseX, (v) => {
    const r = ref.current?.getBoundingClientRect();
    return r ? v - (r.left + r.width / 2) : 9999;
  });
  const raw = useTransform(distance, [-160, -70, 0, 70, 160], [58, 70, 92, 70, 58]);
  const size = useSpring(raw, { stiffness: 320, damping: 26, mass: 0.6 });

  return (
    <motion.button
      ref={ref}
      type="button"
      className={`dock-icon ${hue} ${active ? 'active' : ''}`}
      style={{ width: size, height: size }}
      onClick={() => onSelect(id)}
      whileTap={{ scale: 0.9 }}
      aria-label={label}
      aria-pressed={active}
    >
      <span className="dock-gloss" />
      <span className="dock-glyph">{ICONS[id]}</span>
      <span className="dock-tip">{label}</span>
      {active && <span className="dock-dot" />}
    </motion.button>
  );
}

export default function Dock({ active, onSelect }: { active: SheetId | null; onSelect: (id: SheetId) => void }) {
  const mouseX = useMotionValue(Infinity);
  return (
    <div className="dock-wrap">
    <motion.nav
      className="dock lg refract"
      aria-label="Panels"
      onPointerMove={(e) => mouseX.set(e.clientX)}
      onPointerLeave={() => mouseX.set(Infinity)}
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', bounce: 0.2, duration: 0.9, delay: 0.35 }}
    >
      {ITEMS.map((it) => (
        <DockIcon key={it.id} {...it} active={active === it.id} mouseX={mouseX} onSelect={onSelect} />
      ))}
    </motion.nav>
    </div>
  );
}
