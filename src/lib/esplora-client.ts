/**
 * Minimal read-only client for an Esplora-compatible API.
 *
 * Implemented against the upstream esplora REST surface, which electrs,
 * Blockstream's public instance and the mempool.space backend all expose with
 * identical paths and JSON shapes:
 *   GET /blocks/tip/height
 *   GET /address/:address
 *   GET /address/:address/txs/chain            (confirmed only, 25 per page)
 *   GET /address/:address/txs/chain/:txid      (25 confirmed txs older than txid)
 *   GET /address/:address/txs/mempool          (unconfirmed only, 50 max)
 *   GET /address/:address/utxo
 *   GET /tx/:txid
 *
 * A 404/400 on the paged `/txs/chain` route is ambiguous: esplora answers 404
 * for an address it has never indexed, but a self-hosted mempool without a full
 * indexer answers 404 for *every* address because the route does not exist.
 * The client therefore probes the subset surface (`/address/:addr/txs` +
 * `/utxo` + `/tx/:txid`) before concluding a first page has no data; see
 * `getConfirmedTxsMempoolFallback`.
 *
 * Everything is denominated in satoshis, never BTC. The client is strictly
 * read-only: it never signs, builds or broadcasts a transaction.
 */

export interface EsploraOutput {
  scriptpubkey_address?: string;
  value: number;
  spent: boolean;
}

export interface EsploraInput {
  txid: string;
  vout: number;
  prevout: {
    scriptpubkey_address?: string;
    value: number;
  };
}

export interface EsploraTxStatus {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

export interface EsploraTx {
  txid: string;
  version: number;
  locktime: number;
  vin: EsploraInput[];
  vout: EsploraOutput[];
  size: number;
  weight: number;
  fee: number;
  status: EsploraTxStatus;
}

export interface EsploraAddressStats {
  tx_count: number;
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
}

export interface EsploraAddressInfo {
  address: string;
  chain_stats: EsploraAddressStats;
  mempool_stats: EsploraAddressStats;
}

export interface EsploraUtxo {
  txid: string;
  vout: number;
  status: EsploraTxStatus;
  value: number;
}

export class EsploraError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string
  ) {
    super(message);
    this.name = 'EsploraError';
    // tsconfig targets ES5, where extending a built-in is emulated by copying the
    // prototype chain. Without this, the three `instanceof EsploraError` checks
    // below are always false, so a 404 from an address the backend does not know
    // yet would be rethrown instead of being treated as "no data".
    Object.setPrototypeOf(this, EsploraError.prototype);
  }
}

const DEFAULT_TIMEOUT_MS = 15000;

/** Esplora caps a confirmed page at 25 txs and the mempool page at 50. */
const CONFIRMED_PAGE_SIZE = 25;
const MEMPOOL_PAGE_LIMIT = 50;

export class EsploraClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
  }

  get endpoint(): string {
    return this.baseUrl;
  }

  private async getJson<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: 'no-store',
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new EsploraError(`Request to ${url} failed: ${reason}`, 0, path);
    }

    if (!response.ok) {
      // esplora answers 404 for an address it has never seen, which is a normal
      // outcome (a freshly derived address with no history), not a failure.
      throw new EsploraError(
        `Esplora request to ${path} returned ${response.status}`,
        response.status,
        path
      );
    }

    return (await response.json()) as T;
  }

  private async getText(path: string): Promise<string> {
    const url = `${this.baseUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: 'no-store',
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new EsploraError(`Request to ${url} failed: ${reason}`, 0, path);
    }

    if (!response.ok) {
      throw new EsploraError(
        `Esplora request to ${path} returned ${response.status}`,
        response.status,
        path
      );
    }

    return response.text();
  }

  /** Current chain tip height, used to derive confirmation counts. */
  async getTipHeight(): Promise<number> {
    const body = await this.getText('/blocks/tip/height');
    const height = parseInt(body.trim(), 10);
    if (Number.isNaN(height)) {
      throw new EsploraError(`Unparseable tip height: "${body}"`, 0, '/blocks/tip/height');
    }
    return height;
  }

  /**
   * Balance and counters for a single address.
   *
   * Throws EsploraError(404) when the backend has never seen the address, which
   * callers should treat as "empty, not broken".
   */
  async getAddressInfo(address: string): Promise<EsploraAddressInfo> {
    return this.getJson<EsploraAddressInfo>(`/address/${encodeURIComponent(address)}`);
  }

  /** Never throws: an unknown address resolves to all-zero stats. */
  async getAddressInfoSafe(address: string): Promise<EsploraAddressInfo | null> {
    try {
      return await this.getAddressInfo(address);
    } catch (error) {
      if (error instanceof EsploraError && (error.status === 404 || error.status === 400)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Walk the full confirmed history of an address, newest first.
   *
   * Pages through `/txs/chain` using the last txid of the previous page as the
   * cursor, exactly as esplora intends. An unknown cursor yields an empty array
   * rather than a 404, so a stale cursor degrades to "no new data".
   */
  async getConfirmedTxs(address: string, maxTxs?: number): Promise<EsploraTx[]> {
    const collected: EsploraTx[] = [];
    let cursor: string | undefined;

    for (;;) {
      const path = cursor
        ? `/address/${encodeURIComponent(address)}/txs/chain/${encodeURIComponent(cursor)}`
        : `/address/${encodeURIComponent(address)}/txs/chain`;

      let page: EsploraTx[];
      try {
        page = await this.getJson<EsploraTx[]>(path);
      } catch (error) {
        if (error instanceof EsploraError && (error.status === 404 || error.status === 400)) {
          // A 404 on the very first page is either an address the backend never
          // saw (truly empty history) or a backend that does not implement the
          // paged route at all (self-hosted mempool without a full indexer).
          // Probe the subset surface before concluding "no history" — the first
          // sync of such an address would otherwise import nothing. On later
          // pages a missing cursor legitimately ends the walk.
          if (!cursor) {
            return this.getConfirmedTxsMempoolFallback(address, maxTxs);
          }
          break;
        }
        throw error;
      }

      if (!Array.isArray(page) || page.length === 0) {
        break;
      }

      collected.push(...page);
      cursor = page[page.length - 1]?.txid;

      if (!cursor) {
        break;
      }
      if (maxTxs !== undefined && collected.length >= maxTxs) {
        return collected.slice(0, maxTxs);
      }
      // A short page means we reached the end of the history.
      if (page.length < CONFIRMED_PAGE_SIZE) {
        break;
      }
    }

    return maxTxs !== undefined ? collected.slice(0, maxTxs) : collected;
  }

  /**
   * Recover the confirmed history of an address on an esplora-subset backend.
   *
   * Such a backend (self-hosted mempool) knows the full history in its own
   * database but only serves it through the mempool-native `/address/:addr/txs`
   * route, paginated with `?after_txid=`. Walk those pages newest first, then
   * complement with the funding transaction of every unspent output when a
   * backend serves the recent page without honouring the cursor. Only
   * confirmed transactions are kept; esplora lists them newest first, which the
   * caller relies on for its cursor bookkeeping. Never throws: an unsupported
   * route degrades to an empty list, matching esplora's 404-on-never-seen.
   */
  private async getConfirmedTxsMempoolFallback(address: string, maxTxs?: number): Promise<EsploraTx[]> {
    const byId = new Map<string, EsploraTx>();

    let after: string | undefined;
    for (let pageIndex = 0; pageIndex < 200; pageIndex++) {
      const path =
        `/address/${encodeURIComponent(address)}/txs` +
        (after ? `?after_txid=${encodeURIComponent(after)}` : '');
      const txs = await this.getJsonSafe<EsploraTx[]>(path);
      if (!Array.isArray(txs) || txs.length === 0) {
        break;
      }

      for (const tx of txs) {
        if (tx.status?.confirmed === true) {
          byId.set(tx.txid, tx);
        }
      }

      const cursor = txs[txs.length - 1]?.txid;
      // A repeated cursor means the backend ignored `after_txid` and serves the
      // same recent page again — stop before looping forever.
      if (!cursor || cursor === after) {
        break;
      }
      if (maxTxs !== undefined && byId.size >= maxTxs) {
        break;
      }
      after = cursor;
    }

    // Complement: when the recent page was not paginated, each unspent output
    // still points at its funding transaction, which `/tx/:txid` can fetch.
    const missing = (await this.getUtxos(address))
      .filter((utxo) => !byId.has(utxo.txid))
      .sort((a, b) => (b.status?.block_height ?? 0) - (a.status?.block_height ?? 0));

    for (const utxo of missing) {
      if (maxTxs !== undefined && byId.size >= maxTxs) {
        break;
      }
      const tx = await this.getJsonSafe<EsploraTx>(`/tx/${encodeURIComponent(utxo.txid)}`);
      if (tx && tx.status?.confirmed === true) {
        byId.set(tx.txid, tx);
      }
    }

    // esplora lists confirmed history newest first; match that ordering so the
    // caller can rely on the newest entry being the first one.
    const confirmed = Array.from(byId.values()).sort(
      (a, b) => (b.status?.block_height ?? 0) - (a.status?.block_height ?? 0)
    );
    return maxTxs !== undefined ? confirmed.slice(0, maxTxs) : confirmed;
  }

  /** 404/400-safe GET that resolves to null, used to probe subset endpoints. */
  private async getJsonSafe<T>(path: string): Promise<T | null> {
    try {
      return await this.getJson<T>(path);
    } catch (error) {
      if (error instanceof EsploraError && (error.status === 404 || error.status === 400)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Confirmed transactions strictly older than `lastSeenTxid`.
   *
   * This is the incremental path: pass the newest txid already stored and only
   * newer-in-block-time history comes back. Note esplora's cursor walks
   * *backwards* in time, so this returns the tail after the cursor, not
   * transactions after it in wall-clock order.
   */
  async getConfirmedTxsAfter(address: string, lastSeenTxid: string, maxPages = 4): Promise<EsploraTx[]> {
    let cursor: string | undefined = lastSeenTxid;
    const collected: EsploraTx[] = [];

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
      const path = `/address/${encodeURIComponent(address)}/txs/chain/${encodeURIComponent(cursor as string)}`;
      let page: EsploraTx[];
      try {
        page = await this.getJson<EsploraTx[]>(path);
      } catch (error) {
        if (error instanceof EsploraError && error.status === 404) {
          break;
        }
        throw error;
      }

      if (!Array.isArray(page) || page.length === 0) {
        break;
      }

      collected.push(...page);
      cursor = page[page.length - 1]?.txid;
      if (!cursor || page.length < CONFIRMED_PAGE_SIZE) {
        break;
      }
    }

    return collected;
  }

  /** Unconfirmed transactions touching the address. Never throws on 404. */
  async getMempoolTxs(address: string): Promise<EsploraTx[]> {
    try {
      const txs = await this.getJson<EsploraTx[]>(
        `/address/${encodeURIComponent(address)}/txs/mempool`
      );
      return Array.isArray(txs) ? txs.slice(0, MEMPOOL_PAGE_LIMIT) : [];
    } catch (error) {
      if (error instanceof EsploraError && (error.status === 404 || error.status === 400)) {
        return [];
      }
      throw error;
    }
  }

  async getUtxos(address: string): Promise<EsploraUtxo[]> {
    try {
      const utxos = await this.getJson<EsploraUtxo[]>(`/address/${encodeURIComponent(address)}/utxo`);
      return Array.isArray(utxos) ? utxos : [];
    } catch (error) {
      if (error instanceof EsploraError && (error.status === 404 || error.status === 400)) {
        return [];
      }
      throw error;
    }
  }

  /** Cheap liveness probe used by the settings screen and the scheduler. */
  async healthCheck(): Promise<{ reachable: boolean; tipHeight: number | null; error?: string }> {
    try {
      const tipHeight = await this.getTipHeight();
      return { reachable: true, tipHeight };
    } catch (error) {
      return {
        reachable: false,
        tipHeight: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
