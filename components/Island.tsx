'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useState } from 'react';
import type { LagoonData } from '@/lib/types';
import AnimatedNumber from './AnimatedNumber';

const SPRING = { type: 'spring' as const, bounce: 0.18, duration: 0.55 };

/** Dynamic-Island-style pill: balance and runway at rest, the week's numbers when you open it. */
export default function Island({ data, weekKg }: { data: LagoonData | null; weekKg: number | null }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      layout
      className="island lg refract"
      style={{ borderRadius: 34 }}
      transition={SPRING}
      initial={{ y: -90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <motion.button
        layout="position"
        type="button"
        className="island-row"
        aria-expanded={open}
        aria-label={open ? 'Hide this week' : 'Show this week'}
        onClick={() => setOpen((o) => !o)}
      >
        <Image src="/aquarium-logo-purple-text.png" alt="Aquarium" width={2917} height={677} priority className="island-logo" />
        <span className="chip">
          <span className="lbl">Balance</span> <b>{data?.balance != null ? <AnimatedNumber value={data.balance} decimals={2} prefix="$" /> : '…'}</b>
        </span>
        <span className="chip good">
          <span className="lbl">Runway</span> <b>{data?.runwayDays != null ? <AnimatedNumber value={data.runwayDays} suffix=" days" /> : '…'}</b>
        </span>
        <motion.span className="chev" animate={{ rotate: open ? 180 : 0 }} transition={SPRING} aria-hidden>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 6l4.5 4.5L12.5 6" /></svg>
        </motion.span>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && data && (
          <motion.div
            className="island-grid"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING}
          >
            <div>
              <span>Your week</span>
              <b><AnimatedNumber value={weekKg ?? data.weekKg} decimals={1} suffix=" kg" /></b>
            </div>
            <div>
              <span>Typical student</span>
              <b><AnimatedNumber value={data.cohortMedianKg} decimals={1} suffix=" kg" /></b>
            </div>
            <div>
              <span>Spent</span>
              <b><AnimatedNumber value={data.weekUsd} decimals={0} prefix="$" /></b>
            </div>
            <div>
              <span>Compared with</span>
              <b><AnimatedNumber value={data.cohortSize} /></b>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
