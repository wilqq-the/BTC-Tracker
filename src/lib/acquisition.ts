/**
 * Shape of a transaction row as far as the acquisition pool is concerned.
 * Both the portfolio service and the parallel calculators inside the API
 * routes consume this, so the rule lives in one place.
 */
export interface AcquisitionCandidate {
  type: string;
  source: string | null;
  transferType: string | null;
  originalTotalAmount: number | null;
}

/**
 * A transaction counts as an acquisition (money actually spent) when it is
 * either a real BUY or an on-chain receive valued by the importer.
 *
 * An on-chain TRANSFER_IN is the tracker's best guess of a purchase: the
 * blockchain shows BTC arriving but not the fiat side, so the row carries the
 * block-day close as an inferred cost basis. Rows without a stored basis
 * (originalTotalAmount <= 0) are excluded, as are manual/internal transfers,
 * which only move BTC that already belongs to the portfolio (counting them
 * would double-charge the invested amount).
 */
export function isOnchainAcquisition(tx: AcquisitionCandidate): boolean {
  return (
    tx.type === 'TRANSFER' &&
    tx.source === 'onchain' &&
    tx.transferType === 'TRANSFER_IN' &&
    tx.originalTotalAmount !== null &&
    tx.originalTotalAmount > 0
  );
}
