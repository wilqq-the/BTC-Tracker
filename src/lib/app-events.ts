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

const HIGHLIGHT_TRANSACTION = 'btc:highlight-transaction';

/**
 * Point at a transaction's day on the price chart (e.g. while its row is
 * hovered). Pass null to clear. `day` is the UTC midnight timestamp of the
 * transaction date, which is how the chart keys its data points.
 */
export function emitHighlightTransaction(day: number | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HIGHLIGHT_TRANSACTION, { detail: day }));
}

/** Subscribe to chart highlight requests. Returns an unsubscribe function. */
export function onHighlightTransaction(callback: (day: number | null) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: Event) => callback((e as CustomEvent<number | null>).detail);
  window.addEventListener(HIGHLIGHT_TRANSACTION, listener);
  return () => window.removeEventListener(HIGHLIGHT_TRANSACTION, listener);
}

/** UTC midnight of a transaction date — matches the chart's data points. */
export function transactionDay(date: string | Date): number {
  return Date.parse(new Date(date).toISOString().slice(0, 10));
}
