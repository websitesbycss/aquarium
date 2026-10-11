'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PurchaseOut } from '@/lib/types';
import RunwayLanterns from './RunwayLanterns';

type Bubble = { x: number; y: number; r: number; vy: number; p: PurchaseOut };
type Fish = { x: number; y: number; phase: number; hue: number; size: number; side: number; dir: number };

const FISH_COUNT = 10;
const hash = (n: number) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function noteFor(clarity: number): string {
  if (clarity >= 0.85) return 'Clear skies. Your lagoon is sparkling this week.';
  if (clarity >= 0.55) return 'Clear skies ahead: swap one ride to bring the sparkle back.';
  return 'Your lagoon is resting this week.';
}

export default function Lagoon({
  purchases,
  clarity,
  runwayDays,
  onSelect,
  children,
}: {
  purchases: PurchaseOut[];
  clarity: number;
  runwayDays: number | null;
  onSelect: (p: PurchaseOut) => void;
  children?: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clarityRef = useRef(clarity);
  const bubbles = useRef(new Map<number, Bubble>());
  const fish = useRef<Fish[]>([]);
  const size = useRef({ w: 800, h: 480 });
  const hoverId = useRef<number | null>(null);
  const firstLoad = useRef(true);
  const [tip, setTip] = useState<{ p: PurchaseOut; x: number; y: number } | null>(null);

  clarityRef.current = clarity;

  // Bubbles: one per recent purchase. New ones rise from the bottom; first load is spread out.
  useEffect(() => {
    const { w, h } = size.current;
    const live = new Set(purchases.map((p) => p.id));
    for (const id of [...bubbles.current.keys()]) if (!live.has(id)) bubbles.current.delete(id);
    for (const p of purchases) {
      if (bubbles.current.has(p.id)) continue;
      const r = clamp(10 + Math.sqrt(p.amountUsd) * 3.2, 12, 40);
      bubbles.current.set(p.id, {
        p,
        r,
        x: w * (0.08 + 0.84 * hash(p.id)),
        y: firstLoad.current ? h * (0.15 + 0.7 * hash(p.id + 7)) : h + r,
        vy: 14 + 14 * hash(p.id + 3),
      });
    }
    firstLoad.current = false;
  }, [purchases]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    fish.current = Array.from({ length: FISH_COUNT }, (_, i) => ({
      x: size.current.w * hash(i + 1),
      y: size.current.h * (0.25 + 0.5 * hash(i + 11)),
      phase: hash(i + 21) * 6.28,
      hue: [18, 32, 48, 190, 200, 330, 12, 40, 175, 25][i % 10],
      size: 14 + hash(i + 31) * 12,
      side: i % 2,
      dir: 1,
    }));

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size.current = { w: r.width, h: r.height };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const { w, h } = size.current;
      const c = clarityRef.current;
      ctx.clearRect(0, 0, w, h);

      // Fish: roam the middle when clear, drift to the edges and slow when hazy. Never disappear.
      const toEdges = clamp((0.75 - c) / 0.5, 0, 1);
      const speed = 0.35 + 0.65 * c;
      for (const f of fish.current) {
        const roam = w * (0.5 + 0.4 * Math.sin(t * 0.18 * speed + f.phase));
        const edge = f.side ? w * 0.93 : w * 0.07;
        const tx = roam * (1 - toEdges) + edge * toEdges;
        const px = f.x;
        f.x += (tx - f.x) * 0.6 * dt * speed;
        f.y = h * (0.28 + 0.4 * hash(f.phase)) + Math.sin(t * 0.7 * speed + f.phase) * h * 0.05;
        if (Math.abs(f.x - px) > 0.01) f.dir = f.x >= px ? 1 : -1;
        drawFish(ctx, f, 0.55 + 0.45 * c);
      }
      // Bubbles
      for (const b of bubbles.current.values()) {
        if (!reduce) b.y -= b.vy * dt;
        if (b.y < -b.r) b.y = h + b.r;
        drawBubble(ctx, b, hoverId.current === b.p.id);
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const pick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      let best: Bubble | null = null;
      for (const b of bubbles.current.values()) {
        if (Math.hypot(b.x - x, b.y - y) <= b.r + 4) best = b;
      }
      return { best, x, y };
    };
    const onMove = (e: MouseEvent) => {
      const { best, x, y } = pick(e);
      hoverId.current = best?.p.id ?? null;
      setTip(best ? { p: best.p, x, y } : null);
      if (reduce) frame(performance.now());
    };
    const onClick = (e: MouseEvent) => {
      const { best } = pick(e);
      if (best) onSelect(best.p);
    };
    const onLeave = () => {
      hoverId.current = null;
      setTip(null);
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [onSelect]);

  const coral = 0.72 + 0.28 * clarity;
  const sat = 0.4 + 0.6 * clarity;

  return (
    <div ref={wrapRef} className="lagoon">
      <svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bff6ff" />
            <stop offset="0.45" stopColor="#4fcfe6" />
            <stop offset="1" stopColor="#0f8fb8" />
          </linearGradient>
          <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbeec0" />
            <stop offset="1" stopColor="#e8c98a" />
          </linearGradient>
          <linearGradient id="shaft" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="1000" height="560" fill="url(#water)" />
        <g opacity={0.35 + 0.4 * clarity}>
          <polygon points="140,0 260,0 420,560 220,560" fill="url(#shaft)" />
          <polygon points="470,0 560,0 760,560 620,560" fill="url(#shaft)" />
          <polygon points="760,0 830,0 1000,420 940,560" fill="url(#shaft)" />
        </g>
        <path d="M0 500 Q 200 470 420 495 T 1000 480 V560 H0 Z" fill="url(#sand)" />
        <g style={{ filter: `saturate(${sat})`, transformOrigin: '50% 100%', transform: `scale(${coral})`, transition: 'filter 1.4s, transform 1.4s' }}>
          <g fill="#ff7a8a"><path d="M90 500 q-20 -70 10 -110 q10 40 30 20 q0 50 -10 90z" /><path d="M130 500 q10 -50 40 -70 q-5 40 10 70z" fill="#ffb347" /></g>
          <g fill="#ff9ed0"><path d="M820 505 q-10 -80 30 -120 q20 50 40 10 q10 60 -20 110z" /><path d="M880 505 q30 -40 60 -50 q-20 30 -10 50z" fill="#c78bff" /></g>
          <g fill="#4ad6a3"><path d="M520 500 q-12 -60 5 -90 q14 40 40 5 q-8 50 -12 85z" /></g>
        </g>
        <g fill="none" stroke="#2fb86a" strokeWidth="7" strokeLinecap="round" opacity={0.6 + 0.4 * clarity}>
          <path d="M250 500 q-12 -50 4 -95 q10 -30 -2 -60" />
          <path d="M268 502 q14 -45 -2 -80" />
          <path d="M700 498 q-14 -50 6 -90 q8 -28 -4 -58" />
          <path d="M720 500 q10 -40 -4 -70" />
        </g>
      </svg>

      <div className="haze" style={{ opacity: clamp((1 - clarity) * 0.9, 0, 0.7) }} />
      <canvas ref={canvasRef} aria-label="Lagoon: each bubble is a recent purchase. Select one to open the swap simulator." />

      {children}
      <div className="lagoon-note" aria-live="polite">{noteFor(clarity)}</div>
      <RunwayLanterns days={runwayDays} />

      {tip && (
        <div
          className="bubble-tip"
          style={{ left: clamp(tip.x + 14, 8, size.current.w - 270), top: clamp(tip.y - 70, 8, size.current.h - 150) }}
        >
          <div className="big">{tip.p.merchant}</div>
          <div>
            ${tip.p.amountUsd.toFixed(2)} · {tip.p.kg.toFixed(1)} kg CO2e
          </div>
          <div className="mono">{tip.p.info.formula}</div>
          <div style={{ fontSize: 11 }}>Select to try a swap</div>
        </div>
      )}
    </div>
  );
}

function drawBubble(ctx: CanvasRenderingContext2D, b: Bubble, hot: boolean) {
  const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.1, b.x, b.y, b.r);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(190,240,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0.5)');
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = hot ? 3 : 1.5;
  ctx.strokeStyle = hot ? '#fff' : 'rgba(255,255,255,0.85)';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.28, b.r * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
}

function drawFish(ctx: CanvasRenderingContext2D, f: Fish, alpha: number) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.dir, 1);
  ctx.globalAlpha = alpha;
  const s = f.size;
  const body = ctx.createLinearGradient(0, -s * 0.6, 0, s * 0.6);
  body.addColorStop(0, `hsl(${f.hue} 95% 78%)`);
  body.addColorStop(0.5, `hsl(${f.hue} 90% 55%)`);
  body.addColorStop(1, `hsl(${f.hue} 85% 42%)`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.85, 0);
  ctx.lineTo(-s * 1.55, -s * 0.5);
  ctx.lineTo(-s * 1.55, s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(s * 0.05, -s * 0.22, s * 0.6, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#073047';
  ctx.beginPath();
  ctx.arc(s * 0.55, -s * 0.1, s * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
