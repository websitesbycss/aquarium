'use client';

import { useEffect } from 'react';

/**
 * SVG filters for liquid-glass refraction. Each lens is a displacement map: red encodes x offset,
 * green encodes y offset, 128 = no shift. Offsets ramp smoothly up near the edges, so the glass
 * bends what is behind its rim and leaves the middle readable.
 *
 * Applied via backdrop-filter: url(#...). Only Chromium honors that, so we add
 * html.can-refract there and everything else falls back to plain frosted blur.
 */
function axis(channel: 'r' | 'g', falloff: number, strength: number): string {
  const stops: string[] = [];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const d = Math.min(t, 1 - t);
    let e = Math.max(0, 1 - d / falloff);
    e = e * e * (3 - 2 * e); // smoothstep: no kink where the ramp starts
    const sign = t < 0.5 ? 1 : -1;
    const v = Math.round(128 + sign * e * 127 * strength);
    const c = channel === 'r' ? `rgb(${v},0,0)` : `rgb(0,${v},0)`;
    stops.push(`<stop offset="${(t * 100).toFixed(1)}%" stop-color="${c}"/>`);
  }
  return stops.join('');
}

function mapUri(channel: 'r' | 'g', falloff: number, strength: number): string {
  const vertical = channel === 'g';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" preserveAspectRatio="none">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">${axis(channel, falloff, strength)}</linearGradient></defs>` +
    `<rect width="400" height="400" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function Lens({ id, falloff, strength, scale }: { id: string; falloff: number; strength: number; scale: number }) {
  return (
    <filter id={id} x="0" y="0" width="1" height="1" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
      <feImage href={mapUri('r', falloff, strength)} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="mr" />
      <feImage href={mapUri('g', falloff, strength)} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="mg" />
      <feComposite in="mr" in2="mg" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  );
}

export default function LiquidDefs() {
  useEffect(() => {
    const ua = navigator.userAgent;
    // Chromium (Chrome, Edge, Brave...) supports SVG filters in backdrop-filter. Safari and Firefox do not.
    if (/Chrome\//.test(ua)) document.documentElement.classList.add('can-refract');
  }, []);

  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <Lens id="lens-pill" falloff={0.2} strength={1} scale={0.09} />
      <Lens id="lens-card" falloff={0.07} strength={1} scale={0.05} />
      <Lens id="lens-orb" falloff={0.32} strength={1} scale={0.16} />
    </svg>
  );
}
