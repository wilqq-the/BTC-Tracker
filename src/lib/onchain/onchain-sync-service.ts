/**
 * Reads the Bitcoin chain through an Esplora backend and turns what it finds
 * into `BitcoinTransaction` rows.
 *
 * The service is strictly read-only. It never builds, signs or broadcasts a
 * transaction, and it never asks for a private key: an xpub is enough to derive
 * every receive and change address, and esplora answers instantly for any
 * address, so no gap-limit *scan* is required.
 *
 * Three rules drive the whole design:
 *
 *  1. A txid is a natural key, unique per user (`@@unique([userId, txid])`), so a
 *     re-sync can never create a duplicate.
 *  2. Flows are aggregated per txid across *all* watched addresses before a row
 *     is written, so a transaction between two of the user's own wallets is one
 *     row, not two half-rows that would corrupt the portfolio.
 *  3. Every read and every write is scoped by `userId`. Watching a public address
 *     must not expose it to anybody else.
 */

import { prisma } from '@/lib/prisma';
import {
  EsploraClient,
  EsploraError,
  EsploraTx,
  EsploraAddressInfo,
  EsploraUtxo,
} from '@/lib/esplora-client';
import { EncryptionService } from '@/lib/encryption-service';
import { SettingsService } from '@/lib/settings-service';
import { ExchangeRateService } from '@/lib/exchange-rate-service';
import { BitcoinPriceService } from '@/lib/bitcoin-price-service';
import { TransferFeeMode } from '@/lib/transfer-fees';
import {
  deriveAddresses,
  parseXpub,
  ScriptType,
  Chain,
  MAX_GAP_LIMIT,
} from '@/lib/onchain/address-derivation';

const SATS_PER_BTC = 100_000_000;

/** esplora is polled, never pushed; a long backfill still has to terminate. */
const MAX_CONFIRMED_TXS_PER_ADDRESS = 2000;

/**
 * How much recent history is re-read on every sync once a cursor exists.
 *
 * Confirmations of already-imported transactions still have to move, and they can
 * only do so if the transaction is re-read, so a cursor alone is not enough. The
 * window covers reorgs and a few blocks of latency; the cursor covers everything
 * older than the window.
 */
const RECENT_WINDOW_TXS_PER_ADDRESS = 100;

/**
 * Tolerance when comparing a stored amount with a freshly classified one.
 *
 * Both are IEEE-754 doubles converted from integer satoshis, so an exact
 * comparison would flag a row as drifted on every single sync.
 */
const AMOUNT_EPSILON_BTC = 1e-8;

/** The script types `address-derivation` can actually encode. */
const VALID_SCRIPT_TYPES: ScriptType[] = ['p2pkh', 'p2wpkh-p2sh', 'p2wpkh'];

export interface OnchainSyncResult {
  watchedAddressId: number;
  label: string;
  ok: boolean;
  addressesScanned: number;
  txsSeen: number;
  txsImported: number;
  confirmationsUpdated: number;
  replacedMarked: number;
  balanceSats: string;
  error?: string;
}

export interface OnchainSyncSummary {
  users: number;
  addresses: number;
  succeeded: number;
  failed: number;
  txsImported: number;
  results: OnchainSyncResult[];
}

/** One address we track, and which wallet (if any) it rolls up into. */
interface AddressContext {
  address: string;
  walletId: number | null;
  watchedAddressId: number;
  /** The address the user typed by hand, as opposed to a derived one. */
  isPrimary: boolean;
}

/** The columns of `watched_addresses` the sync reads, as one named shape. */
type WatchedRecord = {
  id: number;
  userId: number;
  label: string;
  address: string;
  xpub: string | null;
  scriptType: string;
  gapLimit: number;
  chain: string;
  walletId: number | null;
  isActive: boolean;
  lastSyncedTxid: string | null;
  lastSyncedAddress: string | null;
};

interface FlowLeg {
  address: string;
  valueSats: number;
  /**
   * Position in the transaction. A transaction can pay the same address twice
   * (two vouts of equal or different value), so the address alone is not an
   * identity: keying the dedup on it would silently drop the second output and
   * under-report the amount received.
   */
  index: number;
}

interface AggregatedTx {
  tx: EsploraTx;
  inputsFromMine: FlowLeg[];
  outputsToMine: FlowLeg[];
  spentSats: number;
  receivedSats: number;
  feeSats: number;
  /** Union of the watched addresses this tx touched. */
  touched: Set<number>;
  fromWalletId: number | null;
  toWalletId: number | null;
}

function satsToBtc(sats: number): number {
  return sats / SATS_PER_BTC;
}

/**
 * Read an xpub out of storage.
 *
 * The xpub is stored encrypted (it is a privacy-sensitive artefact even though
 * it cannot spend). Values written before encryption existed are detected by
 * their plain Base58Check shape and used as-is, so enabling the feature on an
 * existing database does not orphan the rows already there.
 */
function readStoredXpub(stored: string | null): string | null {
  if (!stored) {
    return null;
  }
  if (/^[1-9A-HJ-NP-Za-km-z]{100,120}$/.test(stored)) {
    return stored;
  }
  try {
    return EncryptionService.decrypt(stored);
  } catch {
    return null;
  }
}

export class OnchainSyncService {
  private static inFlight = new Set<string>();

  /** Guard so two schedulers, or a scheduler and a manual click, cannot collide. */
  private static isSyncing(userId: number, watchedAddressId: number): boolean {
    return OnchainSyncService.inFlight.has(`${userId}:${watchedAddressId}`);
  }

  static buildClient(endpoint: string, timeoutMs?: number): EsploraClient {
    return new EsploraClient(endpoint, timeoutMs);
  }

  /**
   * Expand a WatchedAddress row into the full set of addresses to query.
   *
   * When an xpub is present the receive and change chains are derived up to the
   * gap limit, because the change address of a spend is only knowable from the
   * xpub. The hand-entered address is always included, even if the derivation
   * also covers it, so a user who pasted an address from a different derivation
   * path is never silently ignored.
   */
  static async resolveAddresses(
    record: {
      id: number;
      walletId: number | null;
      address: string;
      xpub: string | null;
      scriptType: string;
      gapLimit: number;
      chain: string;
    }
  ): Promise<AddressContext[]> {
    const contexts = new Map<string, AddressContext>();

    contexts.set(record.address, {
      address: record.address,
      walletId: record.walletId,
      watchedAddressId: record.id,
      isPrimary: true,
    });

    const xpub = readStoredXpub(record.xpub);
    if (xpub) {
      try {
        const info = parseXpub(xpub);

        // The stored xpub is normalised to the plain BIP32 prefix so that
        // @scure/bip32 accepts it, which means re-parsing it would report
        // `p2pkh` and derive legacy 1... addresses for what is really a zpub.
        // The `script_type` column is therefore the authority; the prefix is
        // only a fallback for rows that predate that column.
        const declared = VALID_SCRIPT_TYPES.indexOf(record.scriptType as ScriptType);
        const scriptType: ScriptType = declared >= 0 ? (record.scriptType as ScriptType) : info.scriptType;

        const gapLimit = Math.min(Math.max(record.gapLimit || 20, 1), MAX_GAP_LIMIT);
        // A record explicitly tagged testnet wins over the key's own prefix,
        // so a testnet xpub stored on a mainnet-configured instance still works.
        const chain: Chain =
          record.chain === 'testnet' || record.chain === 'signet' || record.chain === 'regtest'
            ? 'testnet'
            : info.chain === 'testnet'
              ? 'testnet'
              : 'mainnet';

        for (const derived of deriveAddresses(info.xpub, scriptType, gapLimit, chain)) {
          if (!contexts.has(derived.address)) {
            contexts.set(derived.address, {
              address: derived.address,
              walletId: record.walletId,
              watchedAddressId: record.id,
              isPrimary: false,
            });
          }
        }
      } catch (error) {
        // A corrupt xpub must not take the plain address down with it: the user
        // still gets history for the address they typed, plus an error message.
        throw new Error(
          `Could not derive addresses from the stored xpub: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return Array.from(contexts.values());
  }

  /**
   * Fold a batch of esplora transactions into one entry per txid.
   *
   * A transaction is discovered once per address that touches it, so without
   * this the same txid would be counted several times — and a send to oneself
   * would look like a huge inflow.
   */
  static aggregate(
    txs: EsploraTx[],
    contexts: AddressContext[]
  ): Map<string, AggregatedTx> {
    const mine = new Map<string, AddressContext>();
    for (const ctx of contexts) {
      mine.set(ctx.address, ctx);
    }

    const result = new Map<string, AggregatedTx>();

    for (const tx of txs) {
      const inputsFromMine: FlowLeg[] = [];
      const outputsToMine: FlowLeg[] = [];
      const touched = new Set<number>();
      const fromWallets = new Set<number>();
      const toWallets = new Set<number>();

      const vinList = tx.vin || [];
      for (let vinIndex = 0; vinIndex < vinList.length; vinIndex++) {
        const input = vinList[vinIndex];
        const address = input.prevout?.scriptpubkey_address;
        const ctx = address ? mine.get(address) : undefined;
        if (!ctx || !address) {
          continue;
        }
        const value = Number(input.prevout?.value ?? 0);
        inputsFromMine.push({ address, valueSats: value, index: vinIndex });
        touched.add(ctx.watchedAddressId);
        if (ctx.walletId !== null) {
          fromWallets.add(ctx.walletId);
        }
      }

      const voutList = tx.vout || [];
      for (let voutIndex = 0; voutIndex < voutList.length; voutIndex++) {
        const output = voutList[voutIndex];
        const address = output.scriptpubkey_address;
        const ctx = address ? mine.get(address) : undefined;
        if (!ctx || !address) {
          continue;
        }
        const value = Number(output.value ?? 0);
        outputsToMine.push({ address, valueSats: value, index: voutIndex });
        touched.add(ctx.watchedAddressId);
        if (ctx.walletId !== null) {
          toWallets.add(ctx.walletId);
        }
      }

      if (inputsFromMine.length === 0 && outputsToMine.length === 0) {
        continue;
      }

      const spentSats = inputsFromMine.reduce((sum, leg) => sum + leg.valueSats, 0);
      const receivedSats = outputsToMine.reduce((sum, leg) => sum + leg.valueSats, 0);
      // esplora's `fee` is null for coinbase and for anything it cannot price.
      const feeSats = Number(tx.fee ?? 0);

      const existing = result.get(tx.txid);
      if (existing) {
        // The same txid reached us through another of our addresses, or through
        // two overlapping queries on the same one. Legs are identified by their
        // position in the transaction, so a repeat is dropped while a genuine
        // second payment to the same address is kept.
        const knownInputs = new Set(existing.inputsFromMine.map((l) => l.index));
        for (const leg of inputsFromMine) {
          if (!knownInputs.has(leg.index)) {
            knownInputs.add(leg.index);
            existing.inputsFromMine.push(leg);
            existing.spentSats += leg.valueSats;
          }
        }
        const knownOutputs = new Set(existing.outputsToMine.map((l) => l.index));
        for (const leg of outputsToMine) {
          if (!knownOutputs.has(leg.index)) {
            knownOutputs.add(leg.index);
            existing.outputsToMine.push(leg);
            existing.receivedSats += leg.valueSats;
          }
        }
        for (const id of Array.from(touched)) {
          existing.touched.add(id);
        }
        for (const w of Array.from(fromWallets)) {
          if (existing.fromWalletId === null) {
            existing.fromWalletId = w;
          }
        }
        for (const w of Array.from(toWallets)) {
          if (existing.toWalletId === null) {
            existing.toWalletId = w;
          }
        }
        continue;
      }

      result.set(tx.txid, {
        tx,
        inputsFromMine,
        outputsToMine,
        spentSats,
        receivedSats,
        feeSats: Number.isFinite(feeSats) && feeSats >= 0 ? feeSats : 0,
        touched,
        fromWalletId: fromWallets.size === 1 ? Array.from(fromWallets)[0] : null,
        toWalletId: toWallets.size === 1 ? Array.from(toWallets)[0] : null,
      });
    }

    return result;
  }

  /**
   * Turn one aggregated transaction into the row shape the portfolio expects.
   *
   * The amount recorded is the *net* change in the user's control, and the fee is
   * recorded separately with the `ON_TOP` fee mode (lib/transfer-fees): the
   * recipients got `btcAmount` and `btcAmount + fees` left the wallet, so the
   * portfolio removes exactly the value that left, no more and no less.
   * Receives carry no fee (the sender paid it) and keep the default mode.
   *
   * A send to one of the user's own addresses is detected by both sides being
   * known wallets; the arithmetic collapses to zero on its own, which is the
   * correct outcome for a change-address spend.
   */
  static classify(agg: AggregatedTx): {
    type: 'TRANSFER_IN' | 'TRANSFER_OUT';
    transferType: 'TRANSFER_IN' | 'TRANSFER_OUT';
    btcAmount: number;
    fees: number;
    transferFeeMode: TransferFeeMode | null;
    selfTransfer: boolean;
  } {
    const net = agg.receivedSats - agg.spentSats;

    if (net > 0) {
      return {
        type: 'TRANSFER_IN',
        transferType: 'TRANSFER_IN',
        btcAmount: satsToBtc(net),
        fees: 0,
        transferFeeMode: null,
        selfTransfer: false,
      };
    }

    const leavingControl = agg.spentSats - agg.receivedSats;
    const btcAmount = satsToBtc(Math.max(0, leavingControl - agg.feeSats));

    return {
      type: 'TRANSFER_OUT',
      transferType: 'TRANSFER_OUT',
      btcAmount,
      fees: satsToBtc(agg.feeSats),
      transferFeeMode: 'ON_TOP',
      selfTransfer: false,
    };
  }

  /** YYYY-MM-DD in UTC, the shape `BitcoinPriceService.getPriceForDate` expects. */
  private static toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Value a transaction at the price of the day it was mined.
   *
   * Historical closes come from `bitcoin_price_history` (Yahoo Finance); when
   * the block date predates the stored ~365-day window, the daily history is
   * backfilled on demand first. An unconfirmed transaction has no block date
   * yet, so it falls back to the live price. If neither is available the row is
   * still written, with a zero cost basis, rather than dropped: a missing price
   * must never make real on-chain history disappear.
   */
  private static async valueTransaction(
    btcAmount: number,
    blockTime: Date | null,
    mainCurrency: string
  ): Promise<{ pricePerBtc: number; total: number; currency: string }> {
    let priceUsd: number | null = null;

    if (blockTime) {
      try {
        // Block-day close price. When the day is older than the stored price
        // window, the daily history is backfilled from Yahoo on demand so old
        // transactions are not silently valued at the current price.
        priceUsd = await BitcoinPriceService.getOrFetchPriceForDate(OnchainSyncService.toDateKey(blockTime));
      } catch {
        priceUsd = null;
      }
    }

    if (priceUsd === null) {
      try {
        const current = await BitcoinPriceService.getCurrentPriceFromTable();
        priceUsd = current?.price ?? null;
      } catch {
        priceUsd = null;
      }
    }

    if (priceUsd === null || !Number.isFinite(priceUsd)) {
      return { pricePerBtc: 0, total: 0, currency: mainCurrency };
    }

    let rate = 1;
    if (mainCurrency !== 'USD') {
      try {
        rate = await ExchangeRateService.getExchangeRate('USD', mainCurrency);
      } catch {
        rate = 1;
      }
      if (!Number.isFinite(rate) || rate <= 0) {
        rate = 1;
      }
    }

    const price = priceUsd * rate;
    return {
      pricePerBtc: price,
      total: price * btcAmount,
      currency: mainCurrency,
    };
  }

  /**
   * Sync one watched address now, and return its result.
   *
   * The aggregation set is the caller's *whole* active watch list, not just this
   * record. A send from a watched wallet to another watched wallet is only
   * correctly recognised as a near-zero internal move when both sides are known;
   * aggregating per record would import the full amount as a TRANSFER_OUT the
   * first time the sending address was scanned, and the unique txid index would
   * then lock that wrong row in forever. Only the requested record gets its
   * balance snapshot written.
   */
  static async syncWatchedAddress(
    userId: number,
    watchedAddressId: number,
    endpoint: string,
    timeoutMs?: number
  ): Promise<OnchainSyncResult> {
    const records = await OnchainSyncService.loadRecords(userId);
    const target = records.find((r) => r.id === watchedAddressId);

    if (!target) {
      return OnchainSyncService.failure(
        watchedAddressId,
        target ? '' : 'Watched address not found'
      );
    }

    const outcome = await OnchainSyncService.syncBatch(userId, records, endpoint, timeoutMs, [
      watchedAddressId,
    ]);

    return (
      outcome.results.find((r) => r.watchedAddressId === watchedAddressId) ??
      OnchainSyncService.failure(watchedAddressId, 'Sync produced no result for this address')
    );
  }

  /**
   * Fetch, aggregate, import and snapshot in one pass over a user's addresses.
   *
   * One pass per user rather than per record is what makes cross-wallet flows
   * come out right; see `syncWatchedAddress`. Requests stay sequential on
   * purpose: the default endpoint is a shared public one, and parallel fan-out
   * is how a self-hoster gets rate-limited.
   */
  private static async syncBatch(
    userId: number,
    records: WatchedRecord[],
    endpoint: string,
    timeoutMs: number | undefined,
    snapshotIds: number[]
  ): Promise<{ results: OnchainSyncResult[] }> {
    const key = `user:${userId}`;

    const buildResults = (): OnchainSyncResult[] =>
      records
        .filter((r) => snapshotIds.indexOf(r.id) >= 0)
        .map((r) => ({
          watchedAddressId: r.id,
          label: r.label || r.address,
          ok: false,
          addressesScanned: 0,
          txsSeen: 0,
          txsImported: 0,
          confirmationsUpdated: 0,
          replacedMarked: 0,
          balanceSats: '0',
        }));

    if (OnchainSyncService.inFlight.has(key)) {
      return {
        results: buildResults().map((r) => ({
          ...r,
          error: 'A sync is already running for this account',
        })),
      };
    }

    OnchainSyncService.inFlight.add(key);
    const client = OnchainSyncService.buildClient(endpoint, timeoutMs);
    const results = buildResults();
    const byId = new Map(results.map((r) => [r.watchedAddressId, r]));

    // Per-record accumulators, so each row keeps its own numbers even though the
    // transactions are aggregated globally.
    const stats = new Map<
      number,
      { balance: number; funded: number; spent: number; txCount: number; utxos: number }
    >();
    // Cursor per derived address, not per record: an account-level xpub derives
    // several addresses, and esplora only accepts a cursor txid that belongs to
    // the address it is being asked for. Keyed by `${recordId}:${address}`.
    const cursors = new Map<string, { txid: string; address: string; blockHeight: number | null } | null>();

    const recordError = (message: string) => {
      for (const result of results) {
        result.ok = false;
        result.error = message.slice(0, 500);
      }
    };

    try {
      // All active records of the user, so a transaction spanning two of them is
      // resolved with both sides known.
      const allContexts: AddressContext[] = [];
      for (const record of records) {
        const contexts = await OnchainSyncService.resolveAddresses(record);
        const own = byId.get(record.id);
        if (own) {
          own.addressesScanned = contexts.length;
        }
        allContexts.push(...contexts);
      }

      if (allContexts.length === 0) {
        recordError('No address to scan');
        return { results };
      }

      const tipHeight = await client.getTipHeight();
      const allTxs: EsploraTx[] = [];

      for (const ctx of allContexts) {
        const record = records.find((r) => r.id === ctx.watchedAddressId)!;
        const [info, confirmed, mempool, utxos] = await OnchainSyncService.fetchForAddress(
          client,
          ctx,
          record,
          cursors
        );

        const current = stats.get(record.id) ?? {
          balance: 0,
          funded: 0,
          spent: 0,
          txCount: 0,
          utxos: 0,
        };

        if (info) {
          current.balance +=
            info.chain_stats.funded_txo_sum -
            info.chain_stats.spent_txo_sum +
            (info.mempool_stats.funded_txo_sum - info.mempool_stats.spent_txo_sum);
          current.funded += info.chain_stats.funded_txo_sum + info.mempool_stats.funded_txo_sum;
          current.spent += info.chain_stats.spent_txo_sum + info.mempool_stats.spent_txo_sum;
          current.txCount += info.chain_stats.tx_count + info.mempool_stats.tx_count;
        }
        current.utxos += utxos.length;
        stats.set(record.id, current);

        allTxs.push(...confirmed, ...mempool);
      }

      const aggregated = OnchainSyncService.aggregate(allTxs, allContexts);
      const settings = await SettingsService.loadSettings();
      const mainCurrency = settings.currency.mainCurrency;

      // One lookup for the whole batch instead of one per record.
      const existing = await prisma.bitcoinTransaction.findMany({
        where: { userId, txid: { in: Array.from(aggregated.keys()) } },
        select: {
          id: true,
          txid: true,
          confirmations: true,
          isReplaced: true,
          blockHeight: true,
          btcAmount: true,
          fees: true,
          transferType: true,
          transferFeeMode: true,
          fromWalletId: true,
          toWalletId: true,
          watchedAddressId: true,
        },
      });
      const existingByTxid = new Map(existing.map((row) => [row.txid as string, row]));
      const seenTxids = new Set<string>();
      const valuationCache = new Map<string, Promise<{ pricePerBtc: number; total: number; currency: string }>>();

      for (const agg of Array.from(aggregated.values())) {
        seenTxids.add(agg.tx.txid);

        // Count the transaction against every record it touched, so the UI can
        // say "this address has history" even when the row is attributed to the
        // other end of an internal move.
        const touchedIds = Array.from(agg.touched).sort((a, b) => a - b);
        for (const id of touchedIds) {
          const result = byId.get(id);
          if (result) {
            result.txsSeen++;
          }
        }

        const confirmedTx = agg.tx.status?.confirmed === true;
        const blockHeight = agg.tx.status?.block_height ?? null;
        const blockTime =
          typeof agg.tx.status?.block_time === 'number'
            ? new Date(agg.tx.status.block_time * 1000)
            : null;
        const confirmations =
          confirmedTx && blockHeight !== null ? Math.max(0, tipHeight - blockHeight + 1) : 0;

        // A row created by an earlier sync may have been attributed from a
        // narrower view of the wallet, e.g. a send imported before the receiving
        // address was also being watched. Comparing the shape we would write now
        // against what is stored repairs those rows instead of leaving a wrong
        // TRANSFER_OUT in the portfolio forever.
        const { btcAmount, fees, transferType, transferFeeMode } = OnchainSyncService.classify(agg);
        const ownerId = touchedIds.length > 0 ? touchedIds[0] : null;
        const known = existingByTxid.get(agg.tx.txid);

        if (known) {
          const drifted =
            Math.abs(known.btcAmount - btcAmount) > AMOUNT_EPSILON_BTC ||
            Math.abs(known.fees - fees) > AMOUNT_EPSILON_BTC ||
            known.transferType !== transferType;

          const needsUpdate =
            known.confirmations !== confirmations ||
            known.isReplaced ||
            (blockHeight !== null && known.blockHeight !== blockHeight) ||
            drifted ||
            // Rows imported before fee modes existed have none; without the
            // mode a send would no longer count its network fee.
            (known.transferFeeMode ?? null) !== transferFeeMode ||
            known.fromWalletId !== agg.fromWalletId ||
            known.toWalletId !== agg.toWalletId ||
            known.watchedAddressId !== ownerId;

          if (needsUpdate) {
            const data: Record<string, unknown> = {
              confirmations,
              blockHeight,
              blockTime,
              isReplaced: false,
            };

            if (drifted) {
              data.btcAmount = btcAmount;
              data.fees = fees;
              data.transferType = transferType;
              data.type = 'TRANSFER';
              data.feesCurrency = 'BTC';
              data.fromWalletId = agg.fromWalletId;
              data.toWalletId = agg.toWalletId;
              // The cost basis of a corrected row was computed from a wrong
              // amount, so it is revalued at the price of the block it is in.
              if (blockTime) {
                const valuation = await OnchainSyncService.valuationFor(
                  valuationCache,
                  btcAmount,
                  blockTime,
                  mainCurrency
                );
                data.originalPricePerBtc = valuation.pricePerBtc;
                data.originalTotalAmount = valuation.total;
                data.originalCurrency = valuation.currency;
              }
            }

            data.transferFeeMode = transferFeeMode;
            data.fromWalletId = agg.fromWalletId;
            data.toWalletId = agg.toWalletId;
            data.watchedAddressId = ownerId;

            await prisma.bitcoinTransaction.update({ where: { id: known.id }, data });

            const ownerResult = ownerId !== null ? byId.get(ownerId) : undefined;
            if (ownerResult) {
              ownerResult.confirmationsUpdated++;
            }
          }
          continue;
        }

        if (btcAmount <= 0 && fees <= 0) {
          continue;
        }

        const valuation = await OnchainSyncService.valuationFor(
          valuationCache,
          btcAmount,
          blockTime,
          mainCurrency
        );

        try {
          await prisma.bitcoinTransaction.create({
            data: {
              type: 'TRANSFER',
              btcAmount,
              fees,
              feesCurrency: 'BTC',
              userId,
              originalCurrency: valuation.currency,
              originalPricePerBtc: valuation.pricePerBtc,
              originalTotalAmount: valuation.total,
              transactionDate: blockTime ?? new Date(),
              transferType,
              transferFeeMode,
              fromWalletId: agg.fromWalletId,
              toWalletId: agg.toWalletId,
              source: 'onchain',
              txid: agg.tx.txid,
              blockHeight,
              blockTime,
              confirmations,
              fromAddress: agg.inputsFromMine[0]?.address ?? null,
              toAddress: agg.outputsToMine[0]?.address ?? null,
              watchedAddressId: ownerId,
              notes: null,
            },
          });
          const ownerResult = ownerId !== null ? byId.get(ownerId) : undefined;
          if (ownerResult) {
            ownerResult.txsImported++;
          }
        } catch (error) {
          // The unique index is the real guard against a concurrent import.
          const isDuplicate =
            typeof error === 'object' &&
            error !== null &&
            (error as { code?: string }).code === 'P2002';
          if (!isDuplicate) {
            throw error;
          }
        }
      }

      // Pending transactions that are neither pending nor confirmed any more have
      // left the mempool: almost always an RBF replacement. The sweep covers every
      // record of the batch, otherwise a sync that saw no transaction at all would
      // compute an empty key set and flag nothing, which is exactly the case where
      // an eviction needs to be detected.
      const stalePending = await prisma.bitcoinTransaction.findMany({
        where: {
          userId,
          watchedAddressId: { in: records.map((r) => r.id) },
          source: 'onchain',
          confirmations: 0,
          isReplaced: false,
          txid: { not: null },
        },
        select: { id: true, txid: true, watchedAddressId: true },
      });

      for (const row of stalePending) {
        if (!row.txid || seenTxids.has(row.txid)) {
          continue;
        }
        await prisma.bitcoinTransaction.update({
          where: { id: row.id },
          data: { isReplaced: true },
        });
        const ownerResult = row.watchedAddressId ? byId.get(row.watchedAddressId) : undefined;
        if (ownerResult) {
          ownerResult.replacedMarked++;
        }
      }

      for (const result of results) {
        const current = stats.get(result.watchedAddressId);

        // A record keeps the cursor of whichever of its derived addresses has
        // the most recent confirmed transaction: that is the only anchor that a
        // later sync could have persisted, and it is what the UI reports.
        const recordPrefix = `${result.watchedAddressId}:`;
        const bestCursor = Array.from(cursors.entries())
          .filter(([key, value]) => key.startsWith(recordPrefix) && value !== null)
          .map(([, value]) => value)
          .sort((a, b) => (a.blockHeight ?? -1) - (b.blockHeight ?? -1))
          .pop();

        result.balanceSats = String(current?.balance ?? 0);
        result.ok = true;

        const data: Record<string, unknown> = {
          balanceSats: BigInt(current?.balance ?? 0),
          fundedSats: BigInt(current?.funded ?? 0),
          spentSats: BigInt(current?.spent ?? 0),
          txCount: current?.txCount ?? 0,
          utxoCount: current?.utxos ?? 0,
          balanceSyncedAt: new Date(),
          lastSyncAt: new Date(),
          lastSyncBlock: tipHeight,
          lastSyncCount: result.txsImported,
          lastSyncError: null,
          lastSyncedTxid: bestCursor?.txid ?? null,
          lastSyncedAddress: bestCursor?.address ?? null,
        };

        // userId stays in the filter even though the id is unique on its own:
        // it is the guard that stops a stale id from another account being
        // written to if this call were ever re-pointed at a shared id space.
        await prisma.watchedAddress.updateMany({
          where: { id: result.watchedAddressId, userId },
          data,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordError(message);

      // Persist the failure so the settings screen can surface it, without
      // clobbering the balances from the last successful sync.
      try {
        await prisma.watchedAddress.updateMany({
          where: { id: { in: snapshotIds }, userId },
          data: { lastSyncError: message.slice(0, 500), lastSyncAt: new Date() },
        });
      } catch {
        // Nothing left to do; the original error is what the caller sees.
      }
    } finally {
      OnchainSyncService.inFlight.delete(key);
    }

    return { results };
  }

  /**
   * One address: statistics, unconfirmed transactions, UTXOs and confirmed
   * history.
   *
   * When the record already carries a cursor, the full history is not re-read:
   * only a recent window (to keep confirmations moving) plus whatever is newer
   * than the cursor (to catch up after downtime) is fetched. If the backend
   * rejects the cursor query, the full read is used instead, so an endpoint that
   * does not implement it degrades to the slow path rather than to missing
   * transactions.
   */
  private static async fetchForAddress(
    client: EsploraClient,
    ctx: AddressContext,
    record: WatchedRecord,
    cursors: Map<string, { txid: string; address: string; blockHeight: number | null } | null>
  ): Promise<[
    EsploraAddressInfo | null,
    EsploraTx[],
    EsploraTx[],
    EsploraUtxo[]
  ]> {
    const [info, mempool, utxos] = await Promise.all([
      client.getAddressInfoSafe(ctx.address),
      client.getMempoolTxs(ctx.address),
      client.getUtxos(ctx.address),
    ]);

    const key = `${record.id}:${ctx.address}`;

    // A stored cursor is only usable for the address it was recorded on: a txid
    // that belongs to another derived address is not in this address's history,
    // and esplora rejects it. The address column acts as the tie-breaker; a bare
    // cursor written by an older version falls back to the only address it could
    // have referred to, which is the one being read.
    const stored: { txid: string; address: string; blockHeight: number | null } | null =
      record.lastSyncedTxid && (!record.lastSyncedAddress || record.lastSyncedAddress === ctx.address)
        ? { txid: record.lastSyncedTxid, address: ctx.address, blockHeight: null }
        : null;
    const cursor = cursors.get(key) ?? stored;

    if (!cursor) {
      const confirmed = await client.getConfirmedTxs(ctx.address, MAX_CONFIRMED_TXS_PER_ADDRESS);
      OnchainSyncService.rememberCursor(cursors, key, confirmed, ctx.address);
      return [info, confirmed, mempool, utxos];
    }

    let confirmed: EsploraTx[] = [];
    try {
      const [recent, after] = await Promise.all([
        client.getConfirmedTxs(ctx.address, RECENT_WINDOW_TXS_PER_ADDRESS),
        client.getConfirmedTxsAfter(ctx.address, cursor.txid),
      ]);
      confirmed = [...recent, ...after];
    } catch (error) {
      // A cursor the backend does not know about, or a txid it has pruned, must
      // not silently shrink the history: fall back to reading it all.
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[ONCHAIN] Cursor read failed for ${ctx.address}, falling back to a full history read: ${message}`
      );
      cursors.set(key, null);
      confirmed = await client.getConfirmedTxs(ctx.address, MAX_CONFIRMED_TXS_PER_ADDRESS);
    }

    if (!cursors.has(key)) {
      OnchainSyncService.rememberCursor(cursors, key, confirmed, ctx.address);
    }

    return [info, confirmed, mempool, utxos];
  }

  /**
   * Remember the newest confirmed transaction seen on an address.
   *
   * esplora lists the newest first, so the first entry is the one a later
   * `after_txid` query should start from. A record with several derived
   * addresses keeps one cursor per address; the final persistence step picks the
   * address that moved most recently as the record's single stored anchor.
   */
  private static rememberCursor(
    cursors: Map<string, { txid: string; address: string; blockHeight: number | null } | null>,
    key: string,
    confirmed: EsploraTx[],
    address: string
  ): void {
    const newest = confirmed.reduce<EsploraTx | null>((best, tx) => {
      if (tx.status?.confirmed !== true) {
        return best;
      }
      if (!best) {
        return tx;
      }
      return (tx.status?.block_height ?? 0) > (best.status?.block_height ?? 0) ? tx : best;
    }, null);

    if (!newest) {
      return;
    }

    const previous = cursors.get(key);
    if (previous && previous.txid === newest.txid) {
      return;
    }
    cursors.set(key, {
      txid: newest.txid,
      address,
      blockHeight: newest.status?.block_height ?? null,
    });
  }

  /** Memoised valuation: a batch has at most one transaction per block date. */
  private static async valuationFor(
    cache: Map<string, Promise<{ pricePerBtc: number; total: number; currency: string }>>,
    btcAmount: number,
    blockTime: Date | null,
    mainCurrency: string
  ): Promise<{ pricePerBtc: number; total: number; currency: string }> {
    const key = `${mainCurrency}:${blockTime ? OnchainSyncService.toDateKey(blockTime) : 'pending'}:${btcAmount.toFixed(8)}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = OnchainSyncService.valueTransaction(btcAmount, blockTime, mainCurrency);
      cache.set(key, pending);
    }
    return pending;
  }

  private static failure(watchedAddressId: number, error: string): OnchainSyncResult {
    return {
      watchedAddressId,
      label: '',
      ok: false,
      addressesScanned: 0,
      txsSeen: 0,
      txsImported: 0,
      confirmationsUpdated: 0,
      replacedMarked: 0,
      balanceSats: '0',
      error,
    };
  }

  /** Active records of a user, newest id last, as the sync needs them. */
  private static async loadRecords(userId: number): Promise<WatchedRecord[]> {
    return prisma.watchedAddress.findMany({
      where: { userId, isActive: true },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Sync every active watched address of one user, in a single batch.
   *
   * One batch instead of one pass per address: see `syncWatchedAddress` for why
   * the aggregation has to span the whole watch list.
   */
  static async syncUser(
    userId: number,
    endpoint: string,
    timeoutMs?: number
  ): Promise<OnchainSyncResult[]> {
    const records = await OnchainSyncService.loadRecords(userId);
    if (records.length === 0) {
      return [];
    }
    const outcome = await OnchainSyncService.syncBatch(userId, records, endpoint, timeoutMs, records.map((r) => r.id));
    return outcome.results;
  }

  /**
   * Sync every active watched address of every active user.
   *
   * Users are processed one after another and addresses within a user are
   * sequential: the scheduler is an in-memory `setInterval`, and hammering a
   * public esplora endpoint with hundreds of parallel requests is how you get
   * rate-limited.
   */
  static async syncAllUsers(
    endpoint: string,
    timeoutMs?: number
  ): Promise<OnchainSyncSummary> {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    const summary: OnchainSyncSummary = {
      users: users.length,
      addresses: 0,
      succeeded: 0,
      failed: 0,
      txsImported: 0,
      results: [],
    };

    for (const user of users) {
      const results = await OnchainSyncService.syncUser(user.id, endpoint, timeoutMs);
      summary.results.push(...results);
      for (const result of results) {
        summary.addresses++;
        if (result.ok) {
          summary.succeeded++;
        } else {
          summary.failed++;
        }
        summary.txsImported += result.txsImported;
      }
    }

    return summary;
  }

  /**
   * Re-derive the stored xpub with new parameters and persist the result.
   *
   * The normalised plain-BIP32 form is what the derivation expects, so it is
   * stored encrypted alongside the display path. Callers keep the user's
   * original string in `xpubDerivationPath` context, never in the xpub column.
   */
  static encryptXpubForStorage(xpub: string): string {
    return EncryptionService.encrypt(xpub);
  }

  static isEsploraReachable(endpoint: string, timeoutMs?: number) {
    return OnchainSyncService.buildClient(endpoint, timeoutMs).healthCheck();
  }
}

/** Every WatchedAddress id touched by the aggregated batch, for the RBF sweep. */
function aggTouched(aggregated: Map<string, AggregatedTx>): Set<number> {
  const ids = new Set<number>();
  for (const agg of Array.from(aggregated.values())) {
    for (const id of Array.from(agg.touched)) {
      ids.add(id);
    }
  }
  return ids;
}

export { EsploraError };
