/**
 * Transfer fee accounting (#168).
 *
 * A transfer's BTC network fee is either
 *   - ON_TOP:   btcAmount arrives, btcAmount + fee leaves the source
 *               (how exchanges like Kraken and Coinbase show withdrawals), or
 *   - DEDUCTED: btcAmount leaves the source, btcAmount - fee arrives
 *               (the original behaviour; null/unknown values mean this).
 *
 * Either way the fee is burned, so total holdings drop by the fee; only how
 * the amount splits between the two wallets differs. Every balance
 * calculation should go through these helpers.
 */

export type TransferFeeMode = 'ON_TOP' | 'DEDUCTED';

export const TRANSFER_FEE_MODES: readonly TransferFeeMode[] = ['ON_TOP', 'DEDUCTED'];

/** Default for transfers created in the app */
export const DEFAULT_TRANSFER_FEE_MODE: TransferFeeMode = 'ON_TOP';

interface TransferLike {
  btcAmount: number;
  fees: number;
  feesCurrency: string;
  transferFeeMode?: string | null;
}

export function isTransferFeeMode(value: unknown): value is TransferFeeMode {
  return value === 'ON_TOP' || value === 'DEDUCTED';
}

/** The fee in BTC (fees in fiat don't move bitcoin) */
export function transferFeeBtc(tx: TransferLike): number {
  return (tx.feesCurrency || '').toUpperCase() === 'BTC' ? tx.fees || 0 : 0;
}

/** BTC that leaves the source wallet */
export function btcLeaving(tx: TransferLike): number {
  return tx.transferFeeMode === 'ON_TOP' ? tx.btcAmount + transferFeeBtc(tx) : tx.btcAmount;
}

/** BTC that arrives in the destination wallet */
export function btcArriving(tx: TransferLike): number {
  return tx.transferFeeMode === 'ON_TOP' ? tx.btcAmount : tx.btcAmount - transferFeeBtc(tx);
}
