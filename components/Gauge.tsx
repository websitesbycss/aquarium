'use client';

import { motion, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import AnimatedNumber from './AnimatedNumber';

const WAVE = 'M-200 0 q50 -10 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 v320 h-800 z';

/**
 * A glass vial of water. The water level IS the percentile: 71% cleaner than the cohort means the
 * vial is 71% full. During a swap preview the level rises on a critically damped spring.
 */
export default function Gauge({ percentile, previewing }: { percentile: number; previewing: boolean }) {
  const reduce = useReducedMotion();
  const level = useSpring(0, { stiffness: 36, damping: 12.5, mass: 1 });
  useEffect(() => {
    if (reduce) level.jump(percentile);
    else level.set(percentile);
  }, [percentile, reduce, level]);
  // Surface y inside the vial (viewBox 0..200, usable 14..186).
  const surface = useTransform(level, (v) => 186 - (Math.max(0, Math.min(100, v)) / 100) * 172);

  return (
    <div className={`gauge ${previewing ? 'previewing' : ''}`} role="img" aria-label={`Cleaner than ${percentile}% of students like you`}>
      <svg viewBox="0 0 200 200" className="gauge-svg">
        <defs>
          <radialGradient id="gl-body" cx="0.5" cy="0.45" r="0.55">
            <stop offset="0" stopColor="#fff" stopOpacity="0.04" />
            <stop offset="0.75" stopColor="#dff8ff" stopOpacity="0.12" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.5" />
          </radialGradient>
          <linearGradient id="gl-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9bf6ff" />
            <stop offset="0.35" stopColor="#35cfe8" />
            <stop offset="1" stopColor="#0a63a8" />
          </linearGradient>
          <linearGradient id="gl-water2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d6fcff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#4fd8ec" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="gl-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.25" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.9" />
          </linearGradient>
          <clipPath id="gl-clip">
            <circle cx="100" cy="100" r="88" />
          </clipPath>
        </defs>

        <circle cx="100" cy="100" r="96" fill="url(#gl-body)" />

        <g clipPath="url(#gl-clip)">
          <motion.g style={{ y: surface }}>
            <g className="gw gw2"><path d={WAVE} transform="translate(0 4)" fill="url(#gl-water2)" /></g>
            <g className="gw gw1"><path d={WAVE} fill="url(#gl-water)" /></g>
          </motion.g>
          {[34, 70, 108, 142, 168].map((x, i) => (
            <circle key={x} className={`gb gb${i}`} cx={x} cy="186" r={2 + (i % 3)} fill="rgba(255,255,255,0.75)" />
          ))}
        </g>

        {/* glass: rim, refraction crescent, specular */}
        <circle cx="100" cy="100" r="96" fill="none" stroke="url(#gl-rim)" strokeWidth="3.2" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <path d="M34 88 A 70 70 0 0 1 96 30" stroke="rgba(255,255,255,0.9)" strokeWidth="7" strokeLinecap="round" fill="none" />
        <ellipse cx="62" cy="52" rx="14" ry="7" transform="rotate(-38 62 52)" fill="rgba(255,255,255,0.95)" />
        <path d="M150 162 A 70 70 0 0 1 112 176" stroke="rgba(255,255,255,0.55)" strokeWidth="4" strokeLinecap="round" fill="none" />
      </svg>

      <div className="gauge-text">
        <span className="gauge-top">Cleaner than</span>
        <span className="gauge-num">
          <AnimatedNumber value={percentile} />
          <small>%</small>
        </span>
        <span className="gauge-bot">of students like you</span>
      </div>
    </div>
  );
}
