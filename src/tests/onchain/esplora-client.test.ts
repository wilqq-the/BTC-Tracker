/**
 * Esplora client tests.
 *
 * The client's contract with a backend is mostly about failure: a fresh address
 * that has never been seen must read as "no data" rather than as an error, and
 * paging must stop cleanly at the end of an address's history. Those paths are
 * `instanceof EsploraError` checks, and under the project's ES5 target a
 * subclassed Error loses its prototype, so they are covered here explicitly.
 */

import http from 'http';
import { AddressInfo } from 'net';
import { EsploraClient, EsploraError } from '@/lib/esplora-client';

describe('EsploraClient error handling', () => {
  let server: http.Server;
  let client: EsploraClient;
  let paths: string[];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const path = (req.url || '/').split('?')[0];
      paths.push(path);

      if (path === '/blocks/tip/height') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end('800000');
      }
      if (path.startsWith('/address/boom')) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'backend exploded' }));
      }
      if (path === '/address/unknown') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'not found' }));
      }
      if (path === '/address/unknown/txs/mempool') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'not found' }));
      }
      if (path.startsWith('/address/known/txs/chain/')) {
        // A cursor the backend has never heard of.
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'not found' }));
      }
      if (path === '/address/known') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            address: 'known',
            chain_stats: {
              tx_count: 3,
              funded_txo_count: 3,
              funded_txo_sum: 300,
              spent_txo_count: 1,
              spent_txo_sum: 100,
            },
            mempool_stats: {
              tx_count: 0,
              funded_txo_count: 0,
              funded_txo_sum: 0,
              spent_txo_count: 0,
              spent_txo_sum: 0,
            },
          })
        );
      }
      if (path === '/address/known/txs/chain' || path === '/address/known/txs/mempool') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('[]');
      }
      if (path === '/address/known/utxo') {
        return res.end('[]');
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    client = new EsploraClient(`http://127.0.0.1:${address.port}`, 2000);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    paths = [];
  });

  it('treats a 404 as an address with no history', async () => {
    // An address the backend has never indexed is the normal case for a freshly
    // added watch, not a failure.
    await expect(client.getConfirmedTxs('unknown', 10)).resolves.toEqual([]);
  });

  it('propagates a server failure instead of hiding it as empty history', async () => {
    // The dangerous failure mode: a broken backend reported as "this address has
    // never been used", which would look like an empty wallet to the user.
    let caught: EsploraError | null = null;
    try {
      await client.getConfirmedTxs('boom', 10);
    } catch (error) {
      caught = error as EsploraError;
    }

    expect(caught).not.toBeNull();
    expect(caught).toBeInstanceOf(EsploraError);
    expect(caught!.status).toBe(500);
    expect(caught!.path).toContain('boom');
  });

  it('propagates a server failure from the safe variant too', async () => {
    await expect(client.getAddressInfoSafe('boom')).rejects.toBeInstanceOf(EsploraError);
  });

  it('reads an unknown address as "no data" instead of failing', async () => {
    await expect(client.getAddressInfoSafe('unknown')).resolves.toBeNull();
  });

  it('reads an empty mempool for an unknown address', async () => {
    await expect(client.getMempoolTxs('unknown')).resolves.toEqual([]);
  });

  it('stops paging when the cursor is not found', async () => {
    // Would loop on the 404 rather than stop if instanceof failed.
    await expect(client.getConfirmedTxsAfter('known', 'a'.repeat(64))).resolves.toEqual([]);
  });

  it('returns the real statistics for a known address', async () => {
    const info = await client.getAddressInfo('known');
    expect(info.chain_stats.tx_count).toBe(3);
    expect(info.chain_stats.funded_txo_sum).toBe(300);
  });

  it('reads the tip height as a number', async () => {
    await expect(client.getTipHeight()).resolves.toBe(800000);
  });
});

describe('EsploraClient mempool subset fallback', () => {
  // A self-hosted mempool without a full indexer exposes the mempool-native
  // /address/:addr/txs (paginated with after_txid), /utxo and /tx/:txid but
  // 404s on the paged esplora routes. The client used to read that as "this
  // address has no history" and import nothing.
  const recentTx: any = {
    txid: 'bb'.repeat(32),
    version: 2,
    locktime: 0,
    size: 225,
    weight: 900,
    fee: 200,
    status: { confirmed: true, block_height: 800001, block_time: 1700000001 },
    vin: [
      {
        txid: 'aa'.repeat(32),
        vout: 0,
        prevout: { scriptpubkey_address: 'bc1qother', value: 200000 },
      },
    ],
    vout: [
      {
        value: 100000,
        scriptpubkey: '0014',
        scriptpubkey_address: 'bc1qsubset',
      },
    ],
  };
  const oldFundingTx: any = {
    txid: 'cc'.repeat(32),
    version: 2,
    locktime: 0,
    size: 226,
    weight: 904,
    fee: 200,
    status: { confirmed: true, block_height: 750000, block_time: 1600000000 },
    vin: [
      {
        txid: 'dd'.repeat(32),
        vout: 0,
        prevout: { scriptpubkey_address: 'bc1qother', value: 300000 },
      },
    ],
    vout: [
      {
        value: 150000,
        scriptpubkey: '0014',
        scriptpubkey_address: 'bc1qsubset',
      },
    ],
  };
  // Three txs spread over two after_txid pages for the paging walk.
  const pageTxs = [0, 1, 2].map((i) => ({
    ...recentTx,
    txid: `f${i}${'f'.repeat(62)}`.slice(0, 64),
    status: { confirmed: true, block_height: 800000 - i, block_time: 1700000001 - i },
  }));

  let server: http.Server;
  let client: EsploraClient;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const full = req.url || '/';
      const path = full.split('?')[0];
      const query = new URLSearchParams(full.split('?')[1] || '');

      if (path === '/address/bc1qsubset') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            address: 'bc1qsubset',
            chain_stats: {
              tx_count: 2,
              funded_txo_count: 2,
              funded_txo_sum: 250000,
              spent_txo_count: 0,
              spent_txo_sum: 0,
            },
            mempool_stats: {
              tx_count: 0,
              funded_txo_count: 0,
              funded_txo_sum: 0,
              spent_txo_count: 0,
              spent_txo_sum: 0,
            },
          })
        );
      }
      if (path === '/address/bc1qsubset/txs') {
        // Honest after_txid paging: page 1 = pageTxs[0..1], page 2 = pageTxs[2].
        const after = query.get('after_txid');
        const page = after ? pageTxs.slice(2) : pageTxs.slice(0, 2);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(page));
      }
      if (path === '/address/bc1qsubset/utxo') {
        return res.end('[]');
      }
      // A backend that never honours after_txid: /txs always returns the recent
      // page, so only the /utxo funding transactions reveal the older history.
      if (path === '/address/bc1qfunded/txs') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('[]');
      }
      if (path === '/address/bc1qfunded/utxo') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify([
            {
              txid: oldFundingTx.txid,
              vout: 0,
              status: oldFundingTx.status,
              value: 150000,
            },
          ])
        );
      }
      if (path === `/tx/${oldFundingTx.txid}`) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(oldFundingTx));
      }
      if (
        path === '/address/bc1qsubset/txs/chain' ||
        path.startsWith('/address/bc1qsubset/txs/chain/') ||
        path === '/address/bc1qsubset/txs/mempool'
      ) {
        // The paged esplora routes are not implemented on this backend.
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'not found' }));
      }
      if (path.startsWith('/address/bc1qboom')) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'backend exploded' }));
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    client = new EsploraClient(`http://127.0.0.1:${address.port}`, 2000);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('walks the after_txid pages and recovers the full confirmed history', async () => {
    const txs = await client.getConfirmedTxs('bc1qsubset', 50);
    const txids = txs.map((t) => t.txid);
    // Both pages (2 + 1), newest first, no utxo funding mixed in.
    expect(txids).toEqual([pageTxs[0].txid, pageTxs[1].txid, pageTxs[2].txid]);
    expect(new Set(txids).size).toBe(txids.length);
  });

  it('complements with the utxo funding transaction when not paginated', async () => {
    // A backend that ignores after_txid still serves the utxo funding txs.
    const txs = await client.getConfirmedTxs('bc1qfunded', 50);
    expect(txs.map((t) => t.txid)).toEqual([oldFundingTx.txid]);
  });

  it('still reads a truly unknown address as empty on a subset backend', async () => {
    await expect(client.getConfirmedTxs('bc1qneverseen', 10)).resolves.toEqual([]);
  });

  it('still propagates a server failure instead of hiding it', async () => {
    let caught: EsploraError | null = null;
    try {
      await client.getConfirmedTxs('bc1qboom', 10);
    } catch (error) {
      caught = error as EsploraError;
    }
    expect(caught).toBeInstanceOf(EsploraError);
    expect(caught).not.toBeNull();
  });
});
