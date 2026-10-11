'use client';

import { motion } from 'framer-motion';
import type { Stats } from '@/lib/types';
import AnimatedNumber from './AnimatedNumber';

/** Always-visible live ticker for the Tiger Data stack. Opens the full panel. */
export default function TigerChip({ stats, onOpen }: { stats: Stats | null; onOpen: () => void }) {
  return (
    <motion.button
      type="button"
      className="tiger-chip lg refract"
      onClick={onOpen}
      aria-label="Open Tiger Data panel"
      initial={{ y: -70, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', bounce: 0.2, duration: 0.8, delay: 0.25 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
    >
      <span className="live" aria-hidden />
      <span className="tc-name">Tiger Data</span>
      <span className="tc-stat">
        <b>{stats ? <AnimatedNumber value={stats.totalRows} /> : '…'}</b> rows
      </span>
      <span className="tc-stat tc-hide">
        <b>{stats?.compressionRatio ? <AnimatedNumber value={stats.compressionRatio} decimals={1} suffix="×" /> : '…'}</b>
      </span>
      <span className="tc-stat tc-hide">
        <b>{stats?.p50PercentileMs != null ? <AnimatedNumber value={stats.p50PercentileMs} suffix=" ms" /> : '…'}</b>
      </span>
    </motion.button>
  );
}
