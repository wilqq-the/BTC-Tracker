'use client';

import { flushSync } from 'react-dom';
import { applyPresetForMode } from '@/components/ui/ThemeProvider';

/**
 * Light/dark switch as a circular reveal: the new theme grows out of the
 * point that was clicked (View Transitions API). Falls back to an instant
 * switch where the API is missing or reduced motion is on.
 */

type ViewTransitionDoc = Document & {
  startViewTransition?: (update: () => Promise<void> | void) => { ready: Promise<void>; finished: Promise<void> };
};

// Where the last click happened, so callers without the event (e.g. a
// SegmentedControl's onChange) still reveal from the right spot.
let lastPointer: { x: number; y: number } | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => { lastPointer = { x: e.clientX, y: e.clientY }; }, { capture: true, passive: true });
}

export function switchThemeWithReveal(
  mode: 'light' | 'dark',
  apply: () => void,
  origin?: { x: number; y: number }
): void {
  const doc = document as ViewTransitionDoc;
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    apply();
    return;
  }

  // Keyboard toggles (no recent pointer) reveal from the centre
  const { x, y } = origin ?? lastPointer ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  lastPointer = null;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  // Surfaces animate their colours; freeze that during the switch so the
  // "after" snapshot holds final colours, not a half-faded grey
  const freeze = document.createElement('style');
  freeze.textContent = '*, *::before, *::after { transition: none !important; }';
  document.head.appendChild(freeze);

  // The reveal itself is a CSS animation (globals.css) driven by these
  // variables, so it is clipped from the very first frame. Starting it from
  // JS after `ready` left one unclipped frame: a full-screen flash.
  const root = document.documentElement;
  root.style.setProperty('--reveal-x', `${x}px`);
  root.style.setProperty('--reveal-y', `${y}px`);
  root.style.setProperty('--reveal-r', `${radius}px`);
  root.setAttribute('data-theme-reveal', '');

  const transition = doc.startViewTransition(() => {
    flushSync(apply);
    // Rendering is paused until this callback returns, so frame callbacks
    // never fire here (waiting on one stalls the page for seconds). Apply the
    // colour preset synchronously so the "after" snapshot has final colours.
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(mode);
    applyPresetForMode(mode);
  });

  transition.ready.catch(() => {
    // Transition skipped (e.g. tab hidden): the theme is already applied
  });
  transition.finished.finally(() => {
    freeze.remove();
    root.removeAttribute('data-theme-reveal');
  });
}
