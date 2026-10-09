'use client';

import React, { useCallback, useEffect, useId, useRef } from 'react';

/**
 * Ferrofluid pointer for chart markers — the chart's sibling of the nav's
 * FerroPill. Inside the container the pointer becomes a small liquid drop that
 * trails the mouse. Near a marker the drop is magnetically pulled toward it
 * (and a droplet reaches out of the marker to meet it); when the chart snaps
 * to the marker the drop flows into it and the two merge into one swollen
 * blob. Pull away and the liquid neck stretches, thins and breaks.
 *
 * All shapes share one SVG "goo" filter (blur + alpha threshold), which is
 * what fuses separate circles into a single liquid outline.
 *
 * Markers are found in the DOM: any element inside the container with
 * `data-ferro-marker` (its centre), `data-ferro-id` and `data-ferro-color`.
 * Decorative only: it never captures the pointer, and with reduced motion it
 * stays off and the normal cursor is kept.
 */

type Spring = { k: number; c: number };
const CURSOR: Spring = { k: 210, c: 17 };  // the pointer drop: a little lag reads as liquid
const DROP: Spring = { k: 190, c: 15 };    // droplet reaching out of the marker
const SWELL: Spring = { k: 260, c: 12 };   // radii (visible overshoot)
const REACH = 56;     // px — pointer distance at which the magnetism starts
const LEASH = 14;     // px — how far the marker's droplet can stretch
const REST_R = 4;     // plain marker
const SNAP_R = 7.5;   // merged marker
const DROP_R = 3.5;
const CURSOR_R = 5;
const FREE_COLOR = 'hsl(var(--foreground))';

interface Sim {
  mx: number; my: number; mr: number; vmr: number;              // marker blob
  dx: number; dy: number; vdx: number; vdy: number; dr: number; vdr: number; // marker droplet
  cx: number; cy: number; vcx: number; vcy: number; cr: number; vcr: number; // pointer drop
  opacity: number;
  markerColor: string;
  cursorColor: string;
  placed: boolean;
}

const springStep = (x: number, v: number, target: number, s: Spring, dt: number) => {
  const nv = v + (s.k * (target - x) - s.c * v) * dt;
  return [x + nv * dt, nv] as const;
};

export function FerroMarkers({
  containerRef,
  snappedId,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  /** data-ferro-id of the marker the chart is currently snapped to */
  snappedId?: string | null;
}) {
  const filterId = `ferro-marker-${useId().replace(/:/g, '')}`;
  const groupRef = useRef<SVGGElement>(null);
  const markerRef = useRef<SVGCircleElement>(null);
  const dropRef = useRef<SVGCircleElement>(null);
  const cursorRef = useRef<SVGCircleElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const snapped = useRef<string | null | undefined>(snappedId);
  const enabled = useRef(false);
  const sim = useRef<Sim>({
    mx: 0, my: 0, mr: 0, vmr: 0,
    dx: 0, dy: 0, vdx: 0, vdy: 0, dr: 0, vdr: 0,
    cx: 0, cy: 0, vcx: 0, vcy: 0, cr: 0, vcr: 0,
    opacity: 0, markerColor: '', cursorColor: FREE_COLOR, placed: false,
  });
  const raf = useRef(0);
  const last = useRef(0);

  /** The active marker (snapped, or nearest within reach) and its centre */
  const activeMarker = useCallback(() => {
    const container = containerRef.current;
    const p = pointer.current;
    if (!container || !p) return null;
    const box = container.getBoundingClientRect();
    const centre = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    };
    const markers = Array.from(container.querySelectorAll('[data-ferro-marker]'));

    const snappedEl = snapped.current
      ? markers.find((m) => m.getAttribute('data-ferro-id') === snapped.current)
      : undefined;
    if (snappedEl) {
      const c = centre(snappedEl);
      return { ...c, dist: Math.hypot(p.x - c.x, p.y - c.y), snapped: true, color: snappedEl.getAttribute('data-ferro-color') || FREE_COLOR };
    }
    let best: { x: number; y: number; dist: number; color: string } | null = null;
    for (const m of markers) {
      const c = centre(m);
      const dist = Math.hypot(p.x - c.x, p.y - c.y);
      if (dist <= REACH && (!best || dist < best.dist)) {
        best = { ...c, dist, color: m.getAttribute('data-ferro-color') || FREE_COLOR };
      }
    }
    return best ? { ...best, snapped: false } : null;
  }, [containerRef]);

  const paint = useCallback(() => {
    const s = sim.current;
    const g = groupRef.current;
    const m = markerRef.current;
    const d = dropRef.current;
    const c = cursorRef.current;
    if (!g || !m || !d || !c) return;
    m.setAttribute('cx', String(s.mx)); m.setAttribute('cy', String(s.my)); m.setAttribute('r', String(Math.max(0, s.mr)));
    d.setAttribute('cx', String(s.dx)); d.setAttribute('cy', String(s.dy)); d.setAttribute('r', String(Math.max(0, s.dr)));
    c.setAttribute('cx', String(s.cx)); c.setAttribute('cy', String(s.cy)); c.setAttribute('r', String(Math.max(0, s.cr)));
    if (s.markerColor) { m.style.fill = s.markerColor; d.style.fill = s.markerColor; }
    c.style.fill = s.cursorColor;
    g.style.opacity = String(s.opacity);
  }, []);

  const step = useCallback((now: number) => {
    const dt = Math.min(0.032, (now - (last.current || now)) / 1000) || 0.016;
    last.current = now;
    const s = sim.current;
    const p = pointer.current;
    const t = activeMarker();

    // Pointer drop: follows the mouse; a marker's magnetism bends its path,
    // and once snapped it flows into the marker.
    let ctx = p ? p.x : s.cx;
    let cty = p ? p.y : s.cy;
    let ctr = p ? CURSOR_R : 0;
    if (p && !s.placed) {
      s.cx = p.x; s.cy = p.y; s.vcx = s.vcy = 0; s.placed = true;
    }
    if (t && p) {
      if (t.snapped) {
        ctx = t.x; cty = t.y; ctr = 3;
      } else {
        const pull = Math.pow(1 - t.dist / REACH, 2) * 0.6;
        ctx = p.x + (t.x - p.x) * pull;
        cty = p.y + (t.y - p.y) * pull;
      }
    }
    [s.cx, s.vcx] = springStep(s.cx, s.vcx, ctx, CURSOR, dt);
    [s.cy, s.vcy] = springStep(s.cy, s.vcy, cty, CURSOR, dt);
    [s.cr, s.vcr] = springStep(s.cr, s.vcr, ctr, SWELL, dt);
    s.cursorColor = t ? t.color : FREE_COLOR;

    // Marker blob and its droplet
    if (t) {
      if (s.mr < 0.5 || s.mx !== t.x || s.my !== t.y) {
        if (s.mr < 0.5) { s.dx = t.x; s.dy = t.y; s.vdx = s.vdy = 0; s.mr = REST_R; s.vmr = 0; }
        s.mx = t.x; s.my = t.y;
      }
      s.markerColor = t.color;
      // The droplet reaches toward the pointer drop; harder the closer it is
      const vx = s.cx - t.x;
      const vy = s.cy - t.y;
      const len = Math.hypot(vx, vy) || 1;
      const pull = t.snapped ? 0.5 : Math.max(0, 1 - t.dist / REACH);
      const reach = Math.min(len, LEASH) * pull;
      [s.dx, s.vdx] = springStep(s.dx, s.vdx, t.x + (vx / len) * reach, DROP, dt);
      [s.dy, s.vdy] = springStep(s.dy, s.vdy, t.y + (vy / len) * reach, DROP, dt);
      [s.mr, s.vmr] = springStep(s.mr, s.vmr, t.snapped ? SNAP_R : REST_R + 0.6, SWELL, dt);
      [s.dr, s.vdr] = springStep(s.dr, s.vdr, DROP_R, SWELL, dt);
    } else {
      // Let go: droplet retracts, the overlay marker shrinks away (the real
      // marker underneath stays)
      [s.dx, s.vdx] = springStep(s.dx, s.vdx, s.mx, DROP, dt);
      [s.dy, s.vdy] = springStep(s.dy, s.vdy, s.my, DROP, dt);
      [s.mr, s.vmr] = springStep(s.mr, s.vmr, 0, SWELL, dt);
      [s.dr, s.vdr] = springStep(s.dr, s.vdr, 0, SWELL, dt);
    }
    s.opacity += ((p ? 1 : 0) - s.opacity) * Math.min(1, dt * 12);
    if (!p && s.opacity < 0.02) s.placed = false;

    paint();

    const speed = Math.abs(s.vcx) + Math.abs(s.vcy) + Math.abs(s.vcr) + Math.abs(s.vdx) + Math.abs(s.vdy) + Math.abs(s.vmr) + Math.abs(s.vdr);
    const off = Math.hypot(ctx - s.cx, cty - s.cy) + Math.abs(ctr - s.cr);
    const moving = speed > 0.5 || off > 0.2 || Math.abs((p ? 1 : 0) - s.opacity) > 0.01 || (!t && s.mr > 0.05);
    raf.current = moving ? requestAnimationFrame(step) : 0;
    if (!moving) last.current = 0;
  }, [activeMarker, paint]);

  const kick = useCallback(() => {
    if (!enabled.current) return;
    if (!raf.current) raf.current = requestAnimationFrame(step);
  }, [step]);

  useEffect(() => {
    snapped.current = snappedId;
    kick();
  }, [snappedId, kick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Only for a real mouse, and never with reduced motion
    enabled.current =
      !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
      !!window.matchMedia?.('(pointer: fine)').matches;
    if (!enabled.current) return;

    const previousCursor = container.style.cursor;
    container.style.cursor = 'none';
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
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
      container.style.cursor = previousCursor;
      cancelAnimationFrame(raf.current);
      raf.current = 0; // so a re-mount (or StrictMode's double effect) can start it again
      last.current = 0;
    };
  }, [containerRef, kick]);

  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
        </filter>
      </defs>
      <g ref={groupRef} filter={`url(#${filterId})`} style={{ opacity: 0 }}>
        <circle ref={markerRef} r={0} />
        <circle ref={dropRef} r={0} />
        <circle ref={cursorRef} r={0} style={{ transition: 'fill 160ms ease-out' }} />
      </g>
    </svg>
  );
}
