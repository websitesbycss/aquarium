import Reef from './Reef';

const peak = (n: number, w: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
    return Math.max(0, 1 - d / w).toFixed(2);
  }).join(' ');

// Caustic light web: tileable noise, kept only where it crosses mid-level, so it reads as thin
// bright veins. Rendered once as an SVG image, then tiled and drifted by CSS.
const causticTile = (freq: string, seed: number, width: number) =>
  "url(\"data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='520' height='520'>` +
      `<filter id='c' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>` +
      `<feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='2' seed='${seed}' stitchTiles='stitch'/>` +
      `<feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 0'/>` +
      `<feComponentTransfer><feFuncA type='table' tableValues='${peak(41, width)}'/></feComponentTransfer>` +
      `</filter><rect width='100%' height='100%' filter='url(#c)'/></svg>`,
  ) +
  "\")";

const CAUSTIC_A = causticTile('0.011 0.016', 7, 0.07);
const CAUSTIC_B = causticTile('0.016 0.011', 19, 0.06);

const WAVE = (fill: string, amp: number) =>
  "url(\"data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='60' viewBox='0 0 1200 60' preserveAspectRatio='none'>` +
      `<path d='M0 30 C 100 ${30 - amp}, 200 ${30 - amp}, 300 30 S 500 ${30 + amp}, 600 30 S 800 ${30 - amp}, 900 30 S 1100 ${30 + amp}, 1200 30 V60 H0 Z' fill='${fill}'/></svg>`,
  ) +
  "\")";

const rnd = (n: number) => {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

type Seg = { d: string; w: number };
type Tip = { x: number; y: number; r: number };

/** A branching coral: each limb forks into thinner, shorter limbs. Deterministic per seed. */
function branchCoral(x0: number, y0: number, len: number, width: number, depth: number, seed: number) {
  const segs: Seg[] = [];
  const tips: Tip[] = [];
  const rec = (x: number, y: number, a: number, l: number, w: number, d: number, sd: number) => {
    const x1 = x + Math.cos(a) * l;
    const y1 = y + Math.sin(a) * l;
    const bend = (rnd(sd) - 0.5) * 0.7;
    const cx = x + Math.cos(a + bend) * l * 0.55;
    const cy = y + Math.sin(a + bend) * l * 0.55;
    segs.push({ d: `M${x.toFixed(1)} ${y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`, w });
    if (d === 0) {
      tips.push({ x: x1, y: y1, r: w * 0.85 });
      return;
    }
    const k = d > 1 ? 3 : 2;
    for (let i = 0; i < k; i++) {
      const spread = (i - (k - 1) / 2) * 0.62 + (rnd(sd * 7 + i) - 0.5) * 0.28;
      rec(x1, y1, a + spread, l * (0.66 + rnd(sd + i) * 0.1), w * 0.7, d - 1, sd * 3 + i + 1);
    }
  };
  rec(x0, y0, -Math.PI / 2 + (rnd(seed) - 0.5) * 0.3, len, width, depth, seed);
  return { segs, tips };
}

function Coral({ x, y, len, width, depth, seed, base, light, cls }: { x: number; y: number; len: number; width: number; depth: number; seed: number; base: string; light: string; cls: string }) {
  const { segs, tips } = branchCoral(x, y, len, width, depth, seed);
  return (
    <g className={`coral ${cls}`} style={{ transformOrigin: `${x}px ${y}px` }}>
      {segs.map((sg, i) => (
        <path key={'b' + i} d={sg.d} stroke={base} strokeWidth={sg.w} strokeLinecap="round" fill="none" />
      ))}
      {segs.map((sg, i) => (
        <path key={'h' + i} d={sg.d} stroke={light} strokeOpacity="0.55" strokeWidth={Math.max(1.2, sg.w * 0.32)} strokeLinecap="round" fill="none" transform="translate(-1.2 -1.2)" />
      ))}
      {tips.map((t, i) => (
        <g key={'t' + i}>
          <circle cx={t.x} cy={t.y} r={t.r} fill={light} />
          <circle cx={t.x - t.r * 0.3} cy={t.y - t.r * 0.3} r={t.r * 0.38} fill="#fff" fillOpacity="0.85" />
        </g>
      ))}
    </g>
  );
}

function Fan({ x, y, spread, len, seed }: { x: number; y: number; spread: number; len: number; seed: number }) {
  const rays = 11;
  const a0 = -Math.PI / 2 - spread / 2;
  const a1 = -Math.PI / 2 + spread / 2;
  return (
    <g className="coral cB" style={{ transformOrigin: `${x}px ${y}px` }}>
      {Array.from({ length: rays }, (_, i) => {
        const a = -Math.PI / 2 + (i / (rays - 1) - 0.5) * spread;
        const l = len * (0.82 + rnd(seed + i) * 0.28);
        return (
          <path key={i} d={`M${x} ${y} L${(x + Math.cos(a) * l).toFixed(1)} ${(y + Math.sin(a) * l).toFixed(1)}`} stroke="#ff5fa2" strokeOpacity="0.9" strokeWidth="3" strokeLinecap="round" />
        );
      })}
      <path
        d={`M${x + Math.cos(a0) * len} ${y + Math.sin(a0) * len} A ${len} ${len} 0 0 1 ${x + Math.cos(a1) * len} ${y + Math.sin(a1) * len}`}
        stroke="#ffb3d4"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

function Corals() {
  return (
    <>
      <Coral x={210} y={278} len={62} width={14} depth={3} seed={3} base="#ff5f93" light="#ffc4d8" cls="cA" />
      <Coral x={1170} y={278} len={58} width={13} depth={3} seed={11} base="#ff8a2e" light="#ffe0a0" cls="cB" />
      <Coral x={420} y={282} len={44} width={11} depth={3} seed={21} base="#8a63ff" light="#e0ccff" cls="cD" />
      <Coral x={1010} y={282} len={40} width={10} depth={2} seed={31} base="#17c9a8" light="#b8ffee" cls="cA" />
      <Fan x={880} y={280} spread={1.7} len={78} seed={5} />
      <g className="coral cC" style={{ transformOrigin: '720px 292px' }}>
        <ellipse cx="720" cy="272" rx="58" ry="40" fill="url(#brain)" />
        <path d="M682 264 q10 -12 20 0 t20 0 t20 0 t20 0 M676 280 q10 -10 20 0 t20 0 t20 0 t20 0 t20 0" stroke="rgba(160,70,20,0.35)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <ellipse cx="702" cy="256" rx="22" ry="9" fill="rgba(255,255,255,0.55)" />
      </g>
    </>
  );
}

/** Static, layered backdrop. Depth comes from the --pxn/--pyn parallax variables on :root. */
export default function Scene({ clarity }: { clarity: number }) {
  // 1 = crystal, down to a calm hazy green. Capped so it never looks murky or alarming.
  const haze = Math.max(0, Math.min(0.62, (1 - clarity) * 0.85));
  return (
    <div className="scene" aria-hidden style={{ ['--haze' as string]: haze }}>
      <div className="sky" />
      <div className="sun" />
      <div className="flare f1" />
      <div className="flare f2" />
      <div className="flare f3" />
      <div className="cloud c1" />
      <div className="cloud c2" />
      <div className="cloud c3" />
      <div className="cloud c4" />

      <svg className="hills" viewBox="0 0 1440 260" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="hillA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b8f08a" />
            <stop offset="1" stopColor="#5fc24a" />
          </linearGradient>
          <linearGradient id="hillB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8fdc5d" />
            <stop offset="1" stopColor="#2f9c3a" />
          </linearGradient>
          <linearGradient id="hillFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cdeff0" />
            <stop offset="1" stopColor="#8fd5c8" />
          </linearGradient>
        </defs>
        <path className="hill far" d="M0 170 C160 90 300 130 470 110 S760 60 940 100 S1250 80 1440 120 V260 H0Z" fill="url(#hillFar)" />
        <path className="hill mid" d="M0 200 C200 130 360 190 560 150 S900 120 1100 160 S1340 150 1440 170 V260 H0Z" fill="url(#hillA)" />
        <path className="hill near" d="M0 232 C220 180 420 230 640 205 S1030 170 1230 210 S1390 215 1440 205 V260 H0Z" fill="url(#hillB)" />
      </svg>

      <div className="water">
        <div className="water-body" />
        <div className="caustics a" style={{ backgroundImage: CAUSTIC_A }} />
        <div className="caustics b" style={{ backgroundImage: CAUSTIC_B }} />
        <div className="rays">
          <i /><i /><i /><i /><i />
        </div>
        <div className="haze" />
        <Reef clarity={clarity} />
        <svg className="floor" viewBox="0 0 1440 300" preserveAspectRatio="xMidYMax slice">
          <defs>
            <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff2c9" />
              <stop offset="1" stopColor="#e6c07c" />
            </linearGradient>
            <linearGradient id="weed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8af0a8" />
              <stop offset="1" stopColor="#1f9a58" />
            </linearGradient>
            <radialGradient id="brain" cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#ffe4a8" />
              <stop offset="1" stopColor="#ff9f6b" />
            </radialGradient>
          </defs>

          <g className="weed-group">
            {[60, 90, 1290, 1330, 560, 880].map((x, i) => (
              <g key={x} className={`weed w${i % 3}`} style={{ transformOrigin: `${x}px 290px` }}>
                <path d={`M${x} 290 C ${x - 26} 230, ${x + 24} 190, ${x - 6} 120 C ${x - 22} 80, ${x + 6} 56, ${x} 28`} stroke="url(#weed)" strokeWidth={9 - (i % 3) * 1.5} strokeLinecap="round" fill="none" />
                <path d={`M${x} 290 C ${x - 26} 230, ${x + 24} 190, ${x - 6} 120`} stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </g>
            ))}
          </g>

          <Corals />

          <path d="M0 262 C 220 228, 420 276, 700 250 S 1180 222, 1440 258 V300 H0Z" fill="url(#sand)" />
          <path d="M0 262 C 220 228, 420 276, 700 250 S 1180 222, 1440 258" stroke="rgba(255,255,255,0.7)" strokeWidth="2" fill="none" />
        </svg>
      </div>

      <div className="surface">
        <div className="wave back" style={{ backgroundImage: WAVE('rgba(255,255,255,0.55)', 14) }} />
        <div className="wave front" style={{ backgroundImage: WAVE('rgba(150,235,255,0.9)', 10) }} />
      </div>
    </div>
  );
}
