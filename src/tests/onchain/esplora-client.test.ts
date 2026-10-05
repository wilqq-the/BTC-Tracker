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
  // A self-hosted mempool without a full indexer exposes /address/:addr/txs,
  // /utxo and /tx/:txid but 404s on the paged esplora routes. The client used
  // to read that as "this address has no history" and import nothing.
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

  let server: http.Server;
  let client: EsploraClient;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const path = (req.url || '/').split('?')[0];

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
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([recentTx]));
      }
      if (path === '/address/bc1qsubset/utxo') {
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

  it('recovers confirmed history from /txs + /utxo funding transactions', async () => {
    const txs = await client.getConfirmedTxs('bc1qsubset', 50);
    // Newest first: the recent page entry, then the funding tx of the UTXO.
    expect(txs.map((t) => t.txid)).toEqual([recentTx.txid, oldFundingTx.txid]);
  });

  it('does not duplicate a txid already present in the recent page', async () => {
    const txids = (await client.getConfirmedTxs('bc1qsubset', 50)).map((t) => t.txid);
    expect(new Set(txids).size).toBe(txids.length);
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
