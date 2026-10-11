# BTC Tracker API

BTC Tracker has a REST API for automation — adding transactions from n8n, scripts, or any HTTP client.

## Authentication

All API requests need a Bearer token.

### Generate a token

```bash
curl -X POST http://your-btc-tracker:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "yourpassword", "expiresIn": "30d"}'
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "tokenType": "Bearer",
  "expiresAt": "2025-03-24T10:00:00.000Z"
}
```

`expiresIn` accepts `1h`, `7d`, `30d`, etc. Default is `7d`.

You can also generate a token from within the app — go to **Settings → API Access**.

### Use the token

Add it to every request:

```
Authorization: Bearer eyJhbGci...
```

API keys created in **Settings → API Access** (`btct_...`) work the same way.

Every endpoint except `/api/auth/*` (sign-in, registration) and `/api/health` requires authentication. Server-wide operations — changing price-data or on-chain settings, resetting or replacing settings, managing custom currencies, refreshing price/historical data, scheduler control, backups and user administration — require an admin account and return `403` otherwise.

---

## Transactions

### Add a transaction

```bash
curl -X POST http://your-btc-tracker:3000/api/transactions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "BUY",
    "btc_amount": "0.001",
    "price_per_btc": "67000",
    "currency": "EUR",
    "transaction_date": "2025-02-22",
    "fees": "0.50",
    "notes": "Weekly DCA"
  }'
```

**Field reference:**

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | `BUY`, `SELL`, or `TRANSFER` |
| `btc_amount` | Yes | Amount in BTC |
| `price_per_btc` | Yes | Price per BTC in `currency` (use `"0"` for internal transfers) |
| `currency` | Yes | Fiat currency code, e.g. `EUR`, `USD` |
| `transaction_date` | Yes | Date in `YYYY-MM-DD` format |
| `fees` | No | Fee amount |
| `fees_currency` | No | Fee currency (defaults to `currency`) |
| `notes` | No | Free text note |
| `tags` | No | Free text tags |
| `transfer_type` | For TRANSFER | `TO_COLD_WALLET`, `FROM_COLD_WALLET`, `TRANSFER_IN`, `TRANSFER_OUT` |
| `transfer_fee_mode` | No | For transfers that leave a wallet: `ON_TOP` (the amount arrives, amount + fee leaves) or `DEDUCTED` (the amount leaves, amount − fee arrives). Omitted means `DEDUCTED`; the app's form defaults to `ON_TOP`. Ignored for `TRANSFER_IN` |
| `destination_address` | No | Wallet address for transfers |

**SELL example:**
```json
{
  "type": "SELL",
  "btc_amount": "0.05",
  "price_per_btc": "70000",
  "currency": "EUR",
  "transaction_date": "2025-02-22"
}
```

**TRANSFER to cold storage:**
```json
{
  "type": "TRANSFER",
  "btc_amount": "0.5",
  "price_per_btc": "0",
  "currency": "EUR",
  "transaction_date": "2025-02-22",
  "transfer_type": "TO_COLD_WALLET"
}
```

### List transactions

```bash
curl http://your-btc-tracker:3000/api/transactions \
  -H "Authorization: Bearer <token>"
```

Optional query parameters:

| Parameter | Description |
|-----------|-------------|
| `type` | Filter by `BUY`, `SELL`, `TRANSFER`, or `ALL` |
| `date_from` | Start date (`YYYY-MM-DD`) |
| `date_to` | End date (`YYYY-MM-DD`) |
| `limit` | Results per page (default: `50`) |
| `page` | Page number (default: `1`) |

### Get a single transaction

```bash
curl http://your-btc-tracker:3000/api/transactions/42 \
  -H "Authorization: Bearer <token>"
```

### Update a transaction

```bash
curl -X PUT http://your-btc-tracker:3000/api/transactions/42 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Updated note"}'
```

### Delete a transaction

```bash
curl -X DELETE http://your-btc-tracker:3000/api/transactions/42 \
  -H "Authorization: Bearer <token>"
```

---

## Portfolio

```bash
curl http://your-btc-tracker:3000/api/portfolio-metrics \
  -H "Authorization: Bearer <token>"
```

Key fields in the response:

```json
{
  "totalBtc": 1.25,
  "portfolioValue": 83750,
  "currentBtcPrice": 67000,
  "avgBuyPrice": 45000,
  "unrealizedPnL": 27500,
  "roi": 48.8,
  "mainCurrency": "EUR",
  "lastUpdated": "2025-02-22T10:30:00.000Z"
}
```

Add `?detailed=true` for monthly breakdown and additional analytics.

### Add on-chain receives to the DCA analysis

On-chain receives are imported as `TRANSFER` rows valued at the block-day close. If one was really a purchase, promote it to a `BUY` so the DCA analysis counts it:

```bash
# One transaction (and its undo)
curl -X POST http://your-btc-tracker:3000/api/transactions/42/include-in-dca -H "Authorization: Bearer <token>"
curl -X POST http://your-btc-tracker:3000/api/transactions/42/exclude-from-dca -H "Authorization: Bearer <token>"

# Several at once; ineligible or foreign ids are skipped, not an error
curl -X POST http://your-btc-tracker:3000/api/transactions/bulk-include-in-dca \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"ids": [42, 43, 44]}'
```

`bulk-exclude-from-dca` takes the same body. Bulk responses report `{ "included" | "excluded", "skipped", "totalSelected" }`.

---

## On-chain tracking

Read-only and opt-in: an admin turns it on and sets the endpoint in **Settings → On-chain** (or `PATCH /api/settings` with an `onchain` block, admin only). Every user then manages their own watched addresses.

### Watch an address or an xpub

```bash
curl -X POST http://your-btc-tracker:3000/api/onchain/addresses \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"xpub": "zpub6r...", "label": "Cold storage", "walletId": 3}'
```

| Field | Required | Description |
|-------|----------|-------------|
| `address` | One of the two | A single Bitcoin address |
| `xpub` | One of the two | Extended **public** key (`xpub`, `ypub`, `zpub`, `tpub`, `upub`, `vpub`). Private keys are refused |
| `label` | No | Free text, up to 100 characters |
| `walletId` | No | One of your wallets to attach imported transactions to |
| `chain` | No | `mainnet` (default) or `testnet` |
| `gapLimit` | No | Addresses derived per chain from an xpub, 1–200 (default `20`) |

The xpub is stored encrypted and never returned: responses only say `hasXpub: true`.

### Other endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/onchain/addresses` | Your watched addresses with balances and last sync |
| `GET` | `/api/onchain/addresses/:id` | One watched address |
| `PATCH` | `/api/onchain/addresses/:id` | Change `label`, `isActive`, `gapLimit`, `walletId` or replace the `xpub` |
| `DELETE` | `/api/onchain/addresses/:id` | Stop watching; imported transactions are kept |
| `POST` | `/api/onchain/addresses/:id/sync` | Sync one address now |
| `POST` | `/api/onchain/sync` | Sync all your addresses now |
| `GET` | `/api/onchain/status` | Scheduler state and counts; add `?test=1` to probe the endpoint |

---

## Automation example (n8n)

**Goal:** Automatically log a BTC purchase when your lightning node or exchange triggers a webhook.

1. Create an **HTTP Request** node in n8n:
   - **Method:** `POST`
   - **URL:** `http://your-btc-tracker:3000/api/transactions`
   - **Authentication:** Choose *Header Auth*, set header name `Authorization`, value `Bearer <your-token>`
   - **Body:** JSON with the transaction fields above, mapped from your webhook payload

2. Store your token securely in n8n under **Credentials → Header Auth** so it's not hardcoded in the workflow.

**Example n8n body mapping:**

```json
{
  "type": "BUY",
  "btc_amount": "{{ $json.sats / 100000000 }}",
  "price_per_btc": "{{ $json.btc_price }}",
  "currency": "EUR",
  "transaction_date": "{{ $now.format('yyyy-MM-dd') }}",
  "notes": "Auto-logged via n8n"
}
```

---

## Error reference

| Code | Meaning |
|------|---------|
| `200` | OK |
| `201` | Transaction created |
| `400` | Invalid request body — check required fields |
| `401` | Missing or invalid token |
| `403` | Forbidden — admin-only endpoint |
| `404` | Transaction not found |
| `500` | Server error |

Error responses follow this format:

```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```
