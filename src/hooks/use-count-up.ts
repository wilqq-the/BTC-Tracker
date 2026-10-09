'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number toward `target` with an ease-out curve.
 * First run counts up from 0; later changes glide from the previous value
 * (so live price updates tick rather than jump). Honors reduced motion.
 */
export function useCountUp(target: number, { duration = 1300, delay = 150 } = {}): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const firstRun = useRef(true);

  useEffect(() => {
    if (!Number.isFinite(target)) return;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    const wait = firstRun.current ? delay : 0;
    const length = firstRun.current ? duration : Math.min(duration, 700);
    firstRun.current = false;

    let raf = 0;
    const start = performance.now() + wait;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / length));
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (target - from) * eased;
      fromRef.current = current;
      setValue(current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);

  return value;
}
