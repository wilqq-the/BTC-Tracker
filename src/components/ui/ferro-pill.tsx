'use client';

import React, { useCallback, useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Ferrofluid highlight for a row of pills (the header nav).
 *
 * A spring simulation drives the blob's two edges separately: the edge moving
 * toward the target is stiff and fast, the trailing edge soft and slow, so the
 * blob stretches out, thins at the neck and snaps back into a pill. A small
 * droplet on an even softer spring trails behind and is fused back into the
 * blob by an SVG "goo" filter (blur + alpha threshold), which is what makes it
 * read as liquid. The blob layer is fully opaque on purpose: the threshold
 * works on alpha, so a translucent blob would give mushy edges.
 */

type Spring = { k: number; c: number };
// Tuned for a ~0.5s settle: stretch peaks ~100ms, pill reforms ~300ms.
// To change the speed, scale every k by f² and every c by f (same feel, f× faster).
const LEAD: Spring = { k: 300, c: 23.5 };  // edge travelling toward the target
const TRAIL: Spring = { k: 82, c: 11.8 };  // edge being pulled along
const DROP: Spring = { k: 38, c: 7.4 };    // the trailing droplet
// Max distance (px) of the droplet's centre beyond the blob's edge
const DROP_LEASH = 16;

interface Sim {
  l: number; r: number; vl: number; vr: number; // blob edges
  d: number; vd: number;                          // droplet centre
  opacity: number;
  ready: boolean;
}

export function useFerroPill<T extends HTMLElement>() {
  const containerRef = useRef<T>(null);
  const blobRef = useRef<HTMLSpanElement>(null);
  const dropRef = useRef<HTMLSpanElement>(null);
  const target = useRef({ l: 0, r: 0, visible: false });
  const sim = useRef<Sim>({ l: 0, r: 0, vl: 0, vr: 0, d: 0, vd: 0, opacity: 0, ready: false });
  const raf = useRef(0);
  const last = useRef(0);

  const paint = useCallback(() => {
    const s = sim.current;
    const blob = blobRef.current;
    const drop = dropRef.current;
    if (!blob || !drop) return;
    const width = Math.max(8, s.r - s.l);
    const rest = Math.max(8, target.current.r - target.current.l);
    // Stretched liquid thins at the neck
    const squash = Math.min(1, Math.max(0.62, 1 - (width - rest) / 420));
    blob.style.width = `${width}px`;
    blob.style.transform = `translateX(${s.l}px) scaleY(${squash})`;
    blob.style.opacity = String(s.opacity);
    drop.style.transform = `translateX(${s.d - 11}px)`;
    drop.style.opacity = String(s.opacity);
  }, []);

  const step = useCallback((now: number) => {
    const dt = Math.min(0.032, (now - (last.current || now)) / 1000) || 0.016;
    last.current = now;
    const s = sim.current;
    const t = target.current;

    const centre = (s.l + s.r) / 2;
    const goal = (t.l + t.r) / 2;
    const movingRight = goal >= centre;
    const left = movingRight ? TRAIL : LEAD;
    const right = movingRight ? LEAD : TRAIL;

    s.vl += (left.k * (t.l - s.l) - left.c * s.vl) * dt;
    s.vr += (right.k * (t.r - s.r) - right.c * s.vr) * dt;
    s.l += s.vl * dt;
    s.r += s.vr * dt;
    s.vd += (DROP.k * ((s.l + s.r) / 2 - s.d) - DROP.c * s.vd) * dt;
    s.d += s.vd * dt;
    // Keep the droplet on a short leash behind the blob: close enough that the
    // goo filter always fuses it into a tendril, never a detached floating dot
    // (long edge-to-edge moves would otherwise leave it 100px+ behind).
    if (s.d < s.l - DROP_LEASH) { s.d = s.l - DROP_LEASH; s.vd = s.vl; }
    if (s.d > s.r + DROP_LEASH) { s.d = s.r + DROP_LEASH; s.vd = s.vr; }
    s.opacity += ((t.visible ? 1 : 0) - s.opacity) * Math.min(1, dt * 14);

    paint();

    const moving =
      Math.abs(s.vl) + Math.abs(s.vr) + Math.abs(s.vd) > 1 ||
      Math.abs(t.l - s.l) + Math.abs(t.r - s.r) + Math.abs((s.l + s.r) / 2 - s.d) > 0.5 ||
      Math.abs((t.visible ? 1 : 0) - s.opacity) > 0.01;
    raf.current = moving ? requestAnimationFrame(step) : 0;
    if (!moving) last.current = 0;
  }, [paint]);

  const kick = useCallback(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const s = sim.current;
    const t = target.current;
    if (reduce || !s.ready) {
      // First appearance (or reduced motion): place it, don't fly in from 0
      s.l = t.l; s.r = t.r; s.d = (t.l + t.r) / 2;
      s.vl = s.vr = s.vd = 0;
      s.opacity = t.visible ? 1 : 0;
      s.ready = true;
      paint();
      return;
    }
    if (!raf.current) raf.current = requestAnimationFrame(step);
  }, [paint, step]);

  /** Pull the blob onto an element inside the container */
  const moveTo = useCallback((el: HTMLElement | null | undefined) => {
    const parent = containerRef.current;
    if (!parent || !el) return;
    const p = parent.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    target.current = { l: r.left - p.left, r: r.right - p.left, visible: true };
    kick();
  }, [kick]);

  /** Fade the blob out where it is (e.g. on a page that isn't in the nav) */
  const hide = useCallback(() => {
    target.current = { ...target.current, visible: false };
    kick();
  }, [kick]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return { containerRef, blobRef, dropRef, moveTo, hide };
}

/** The blob layer — render it as the first child of the pill row */
export function FerroPillLayer({
  blobRef,
  dropRef,
  className,
}: {
  blobRef: React.RefObject<HTMLSpanElement | null>;
  dropRef: React.RefObject<HTMLSpanElement | null>;
  className?: string;
}) {
  const filterId = `ferro-${useId().replace(/:/g, '')}`;
  return (
    <>
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <filter id={filterId} x="-20%" y="-80%" width="140%" height="260%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" />
          </filter>
        </defs>
      </svg>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ filter: `url(#${filterId})` }}>
        <span
          ref={blobRef}
          className={cn('absolute inset-y-0 left-0 rounded-full bg-tint-orange will-change-transform', className)}
          style={{ width: 0, opacity: 0, transformOrigin: 'center' }}
        />
        <span
          ref={dropRef}
          className={cn('absolute left-0 top-1/2 -mt-[11px] size-[22px] rounded-full bg-tint-orange will-change-transform', className)}
          style={{ opacity: 0 }}
        />
      </div>
    </>
  );
}
