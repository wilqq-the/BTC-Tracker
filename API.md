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
