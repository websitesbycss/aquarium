'use client';

import { useEffect, useRef } from 'react';

type Fish = { x: number; y: number; vx: number; vy: number; fx: number; fy: number; phase: number; hue: number; size: number; side: number; band: number };
type Mote = { x: number; y: number; r: number; s: number; p: number };
type Bub = { x: number; y: number; r: number; v: number; p: number };

const FISH = 13;
const hash = (n: number) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The living layer: a school of glossy fish, plankton motes and rising ambient bubbles.
 * Clear water: fish roam the whole lagoon. Hazy water: they drift to the edges and slow down.
 * They never disappear. Fish also scatter away from the pointer.
 */
export default function Reef({ clarity }: { clarity: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const clarityRef = useRef(clarity);
  clarityRef.current = clarity;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 800, h = 500;
    const pointer = { x: -999, y: -999 };

    const fish: Fish[] = Array.from({ length: FISH }, (_, i) => ({
      x: hash(i + 1) * 800,
      y: 0,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: 0,
      phase: hash(i + 21) * 6.28,
      hue: [18, 36, 52, 192, 204, 330, 14, 44, 176, 24, 262, 160, 340][i % 13],
      size: 11 + hash(i + 31) * 13,
      side: i % 2,
      band: hash(i + 41),
    }));
    const motes: Mote[] = Array.from({ length: 46 }, (_, i) => ({ x: hash(i + 3) * 800, y: hash(i + 9) * 500, r: 0.8 + hash(i + 5) * 2.2, s: 4 + hash(i + 7) * 10, p: hash(i + 2) * 6.28 }));
    const bubs: Bub[] = Array.from({ length: 16 }, (_, i) => ({ x: hash(i + 51) * 800, y: hash(i + 61) * 500, r: 1.5 + hash(i + 71) * 5, v: 12 + hash(i + 81) * 26, p: hash(i + 91) * 6.28 }));
    const shown = { c: clarityRef.current };

    let seeded = false;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      shown.c = reduce ? clarityRef.current : shown.c + (clarityRef.current - shown.c) * (1 - Math.exp(-dt / 0.7));
      const c = shown.c;
      if (!seeded && h > 50) {
        for (const f of fish) { f.y = h * (0.2 + 0.55 * f.band); f.x = hash(f.phase) * w; }
        seeded = true;
      }
      const toEdges = clamp((0.75 - c) / 0.5, 0, 1);
      const speed = 0.35 + 0.65 * c;

      // plankton
      for (const m of motes) {
        if (!reduce) {
          m.y -= m.s * dt * 0.6;
          m.x += Math.sin(t * 0.5 + m.p) * 6 * dt;
        }
        if (m.y < -4) { m.y = h + 4; m.x = hash(m.p * 100) * w; }
        const a = (0.25 + 0.35 * Math.sin(t * 1.3 + m.p) ** 2) * (0.4 + 0.6 * c);
        ctx.beginPath();
        ctx.arc(m.x % w, m.y, m.r, 0, 6.283);
        ctx.fillStyle = `rgba(230,255,255,${a})`;
        ctx.fill();
      }

      // ambient bubbles
      for (const b of bubs) {
        if (!reduce) {
          b.y -= b.v * dt;
          b.x += Math.sin(t * 0.9 + b.p) * 10 * dt;
        }
        if (b.y < -10) { b.y = h + 10; b.x = hash(b.p * 55 + t) * w; }
        const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(0.6, 'rgba(200,245,255,0.18)');
        g.addColorStop(1, 'rgba(255,255,255,0.55)');
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, 6.283);
        ctx.fillStyle = g;
        ctx.fill();
      }

      // fish
      for (const f of fish) {
        const roam = w * (0.5 + 0.42 * Math.sin(t * 0.16 * speed + f.phase));
        const edge = f.side ? w * 0.95 : w * 0.05;
        const tx = roam * (1 - toEdges) + edge * toEdges;
        const ty = h * (0.2 + 0.55 * f.band) + Math.sin(t * 0.6 * speed + f.phase) * h * 0.04;
        // steer toward the target
        f.vx += (tx - f.x) * 0.55 * dt * speed;
        f.vy += (ty - f.y) * 0.9 * dt * speed;
        // flee the pointer
        const dx = f.x - pointer.x, dy = f.y - pointer.y;
        const d = Math.hypot(dx, dy);
        if (d < 150 && !reduce) {
          const k = (1 - d / 150) * 340 * dt;
          f.vx += (dx / (d || 1)) * k;
          f.vy += (dy / (d || 1)) * k;
        }
        f.vx *= Math.exp(-1.6 * dt);
        f.vy *= Math.exp(-2.2 * dt);
        if (!reduce) {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
        } else {
          f.x = tx;
          f.y = ty;
        }
        f.x = clamp(f.x, -20, w + 20);
        const dir = f.vx >= 0 ? 1 : -1;
        drawFish(ctx, f, dir, t, 0.5 + 0.5 * c);
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return <canvas ref={ref} className="reef" aria-hidden />;
}

function drawFish(ctx: CanvasRenderingContext2D, f: Fish, dir: number, t: number, alpha: number) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(dir, 1);
  ctx.globalAlpha = alpha;
  const s = f.size;
  const wag = Math.sin(t * 7 + f.phase) * 0.28;
  // tail
  ctx.save();
  ctx.translate(-s * 0.8, 0);
  ctx.rotate(wag);
  ctx.fillStyle = `hsl(${f.hue} 90% 52%)`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-s * 0.7, -s * 0.7, -s * 1.1, -s * 0.55);
  ctx.quadraticCurveTo(-s * 0.7, 0, -s * 1.1, s * 0.55);
  ctx.quadraticCurveTo(-s * 0.7, s * 0.7, 0, 0);
  ctx.fill();
  ctx.restore();
  // dorsal fin
  ctx.fillStyle = `hsl(${f.hue} 88% 46%)`;
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, -s * 0.45);
  ctx.quadraticCurveTo(0, -s * 1.05, s * 0.35, -s * 0.45);
  ctx.fill();
  // body
  const body = ctx.createLinearGradient(0, -s * 0.6, 0, s * 0.6);
  body.addColorStop(0, `hsl(${f.hue} 100% 82%)`);
  body.addColorStop(0.45, `hsl(${f.hue} 92% 58%)`);
  body.addColorStop(1, `hsl(${f.hue} 85% 40%)`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, s, s * 0.56, 0, 0, 6.283);
  ctx.fill();
  // gloss
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.ellipse(s * 0.05, -s * 0.24, s * 0.62, s * 0.14, 0, 0, 6.283);
  ctx.fill();
  // eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(s * 0.55, -s * 0.08, s * 0.16, 0, 6.283);
  ctx.fill();
  ctx.fillStyle = '#06293d';
  ctx.beginPath();
  ctx.arc(s * 0.58, -s * 0.08, s * 0.09, 0, 6.283);
  ctx.fill();
  ctx.restore();
}
