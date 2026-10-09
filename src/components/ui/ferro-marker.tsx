'use client';

import React, { useCallback, useEffect, useId, useRef } from 'react';

/**
 * Ferrofluid hover for chart markers — the chart's sibling of the nav's
 * FerroPill. As the pointer nears a marker, a droplet reaches out of it toward
 * the pointer; once the chart snaps to that marker the droplet is drawn back
 * in and the marker swells with a little overshoot. The same SVG "goo" filter
 * (blur + alpha threshold) fuses marker and droplet into one liquid shape.
 *
 * Markers are found in the DOM: any element inside the container with
 * `data-ferro-marker` (its centre), `data-ferro-id` and `data-ferro-color`.
 * Purely decorative: it never captures the pointer.
 */

type Spring = { k: number; c: number };
const DROP: Spring = { k: 190, c: 15 };   // droplet position (slightly underdamped)
const SWELL: Spring = { k: 260, c: 12 };  // marker radius (visible overshoot)
const REACH = 56;   // px — pointer distance at which the droplet starts reaching
const LEASH = 14;   // px — how far the droplet can stretch from the marker
const REST_R = 4;   // radius of the plain marker
const SNAP_R = 7;   // radius when snapped
const DROP_R = 3.5;

interface Sim {
  ax: number; ay: number;           // marker centre
  dx: number; dy: number; vdx: number; vdy: number;
  r: number; vr: number;
  opacity: number;
  color: string;
}

export function FerroMarkers({
  containerRef,
  snappedId,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  /** data-ferro-id of the marker the chart is currently snapped to */
  snappedId?: string | null;
}) {
  const filterId = `ferro-marker-${useId().replace(/:/g, '')}`;
  const markerRef = useRef<SVGCircleElement>(null);
  const dropRef = useRef<SVGCircleElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const snapped = useRef<string | null | undefined>(snappedId);
  const sim = useRef<Sim>({ ax: 0, ay: 0, dx: 0, dy: 0, vdx: 0, vdy: 0, r: REST_R, vr: 0, opacity: 0, color: '' });
  const raf = useRef(0);
  const last = useRef(0);

  const markerCentre = useCallback((el: Element, box: DOMRect) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
  }, []);

  /** Which marker is active, and where the droplet and radius should head */
  const targets = useCallback(() => {
    const container = containerRef.current;
    const p = pointer.current;
    if (!container) return null;
    const box = container.getBoundingClientRect();
    const markers = Array.from(container.querySelectorAll('[data-ferro-marker]'));

    let el: Element | undefined;
    if (snapped.current) {
      el = markers.find((m) => m.getAttribute('data-ferro-id') === snapped.current);
    }
    let dist = Infinity;
    if (!el && p) {
      for (const m of markers) {
        const c = markerCentre(m, box);
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < dist) { dist = d; el = m; }
      }
      if (dist > REACH) el = undefined;
    }
    if (!el) return null;

    const c = markerCentre(el, box);
    const isSnapped = el.getAttribute('data-ferro-id') === snapped.current;
    let tx = c.x;
    let ty = c.y;
    if (p) {
      const vx = p.x - c.x;
      const vy = p.y - c.y;
      const len = Math.hypot(vx, vy) || 1;
      // Reaching harder the closer the pointer gets; once snapped, only a
      // short tendril stays pointing at the pointer.
      const pull = isSnapped ? 0.45 : Math.max(0, 1 - len / REACH);
      const reach = Math.min(len, LEASH) * pull;
      tx += (vx / len) * reach;
      ty += (vy / len) * reach;
    }
    return {
      ax: c.x, ay: c.y, tx, ty,
      r: isSnapped ? SNAP_R : REST_R + 0.6,
      color: el.getAttribute('data-ferro-color') || 'currentColor',
    };
  }, [containerRef, markerCentre]);

  const paint = useCallback(() => {
    const s = sim.current;
    const marker = markerRef.current;
    const drop = dropRef.current;
    const group = groupRef.current;
    if (!marker || !drop || !group) return;
    marker.setAttribute('cx', String(s.ax));
    marker.setAttribute('cy', String(s.ay));
    marker.setAttribute('r', String(Math.max(0, s.r)));
    drop.setAttribute('cx', String(s.dx));
    drop.setAttribute('cy', String(s.dy));
    group.style.opacity = String(s.opacity);
    if (s.color) group.style.fill = s.color;
  }, []);

  const step = useCallback((now: number) => {
    const dt = Math.min(0.032, (now - (last.current || now)) / 1000) || 0.016;
    last.current = now;
    const s = sim.current;
    const t = targets();

    if (t) {
      if (s.opacity < 0.05) {
        // Appearing: start from the marker itself, not from wherever we were
        s.dx = t.ax; s.dy = t.ay; s.vdx = s.vdy = 0; s.r = REST_R; s.vr = 0;
      }
      s.ax = t.ax; s.ay = t.ay; s.color = t.color;
      s.vdx += (DROP.k * (t.tx - s.dx) - DROP.c * s.vdx) * dt;
      s.vdy += (DROP.k * (t.ty - s.dy) - DROP.c * s.vdy) * dt;
      s.vr += (SWELL.k * (t.r - s.r) - SWELL.c * s.vr) * dt;
    } else {
      // Retract into the marker and fade out
      s.vdx += (DROP.k * (s.ax - s.dx) - DROP.c * s.vdx) * dt;
      s.vdy += (DROP.k * (s.ay - s.dy) - DROP.c * s.vdy) * dt;
      s.vr += (SWELL.k * (REST_R - s.r) - SWELL.c * s.vr) * dt;
    }
    s.dx += s.vdx * dt;
    s.dy += s.vdy * dt;
    s.r += s.vr * dt;
    s.opacity += ((t ? 1 : 0) - s.opacity) * Math.min(1, dt * 12);

    paint();

    const moving =
      Math.abs(s.vdx) + Math.abs(s.vdy) + Math.abs(s.vr) > 0.5 ||
      (t ? Math.hypot(t.tx - s.dx, t.ty - s.dy) + Math.abs(t.r - s.r) > 0.2 : s.opacity > 0.01);
    raf.current = moving ? requestAnimationFrame(step) : 0;
    if (!moving) last.current = 0;
  }, [paint, targets]);

  const kick = useCallback(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (!raf.current) raf.current = requestAnimationFrame(step);
  }, [step]);

  useEffect(() => {
    snapped.current = snappedId;
    kick();
  }, [snappedId, kick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onMove = (e: PointerEvent) => {
      const box = container.getBoundingClientRect();
      pointer.current = { x: e.clientX - box.left, y: e.clientY - box.top };
      kick();
    };
    const onLeave = () => {
      pointer.current = null;
      kick();
    };
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerleave', onLeave);
    return () => {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf.current);
      raf.current = 0; // so a re-mount (or StrictMode's double effect) can start it again
      last.current = 0;
    };
  }, [containerRef, kick]);

  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
        </filter>
      </defs>
      <g ref={groupRef} filter={`url(#${filterId})`} style={{ opacity: 0 }}>
        <circle ref={markerRef} r={REST_R} />
        <circle ref={dropRef} r={DROP_R} />
      </g>
    </svg>
  );
}
