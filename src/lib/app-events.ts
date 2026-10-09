'use client';

/**
 * Tiny app-wide event bus for "data changed, refetch" signals between
 * components that don't share state (header, dashboard widgets, sidebar).
 */

const TRANSACTIONS_CHANGED = 'btc:transactions-changed';

/** Announce that transactions were added/edited/removed. */
export function emitTransactionsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TRANSACTIONS_CHANGED));
}

/** Subscribe to transaction changes. Returns an unsubscribe function. */
export function onTransactionsChanged(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(TRANSACTIONS_CHANGED, callback);
  return () => window.removeEventListener(TRANSACTIONS_CHANGED, callback);
}
