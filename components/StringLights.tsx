'use client';

import { motion } from 'framer-motion';

const N = 14;

/** Runway as string lights draped across the sky: one bulb per day, dimming from the right. */
export default function StringLights({ days }: { days: number | null }) {
  const lit = days === null ? N : Math.max(1, Math.min(N, days)); // never fully dark
  return (
    <div className="lights" role="img" aria-label={days === null ? 'Runway unavailable' : `${days} days of runway`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="lights-wire">
        <path d="M0 10 Q50 114 100 10" fill="none" stroke="rgba(8,50,90,0.55)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: N }, (_, i) => {
        const t = (i + 0.5) / N;
        const y = 10 + 208 * t * (1 - t); // matches the wire's quadratic curve
        const on = i < lit;
        return (
          <motion.span
            key={i}
            className="bulb-pos"
            style={{ left: `${t * 100}%`, top: y }}
            initial={{ opacity: 0, y: -24, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', bounce: 0.35, duration: 0.9, delay: 0.5 + i * 0.045 }}
          >
            <i className={`bulb ${on ? 'on' : 'off'}`} style={{ animationDelay: `${-i * 0.37}s` }} />
          </motion.span>
        );
      })}
    </div>
  );
}
