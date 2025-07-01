-- CreateTable
CREATE TABLE "bitcoin_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "btc_amount" REAL NOT NULL,
    "original_price_per_btc" REAL NOT NULL,
    "original_currency" TEXT NOT NULL,
    "original_total_amount" REAL NOT NULL,
    "fees" REAL NOT NULL DEFAULT 0,
    "fees_currency" TEXT NOT NULL DEFAULT 'USD',
    "transaction_date" DATETIME NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "bitcoin_price_history" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "open_usd" REAL NOT NULL,
    "high_usd" REAL NOT NULL,
    "low_usd" REAL NOT NULL,
    "close_usd" REAL NOT NULL,
    "volume" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "bitcoin_price_intraday" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL,
    "price_usd" REAL NOT NULL,
    "volume" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "from_currency" TEXT NOT NULL,
    "to_currency" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "last_updated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "settings_data" TEXT NOT NULL,
    "last_updated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" TEXT NOT NULL DEFAULT '1.0.0'
);

-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "display_name" TEXT,
    "profile_picture" TEXT,
    "pin_hash" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "custom_currencies" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "bitcoin_current_price" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "price_usd" REAL NOT NULL,
    "price_change_24h_usd" REAL NOT NULL DEFAULT 0,
    "price_change_24h_percent" REAL NOT NULL DEFAULT 0,
    "timestamp" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'api',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "portfolio_summary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "total_btc" REAL NOT NULL DEFAULT 0,
    "total_transactions" INTEGER NOT NULL DEFAULT 0,
    "total_invested" REAL NOT NULL DEFAULT 0,
    "total_fees" REAL NOT NULL DEFAULT 0,
    "average_buy_price" REAL NOT NULL DEFAULT 0,
    "main_currency" TEXT NOT NULL DEFAULT 'USD',
    "current_btc_price_usd" REAL NOT NULL DEFAULT 0,
    "current_portfolio_value" REAL NOT NULL DEFAULT 0,
    "unrealized_pnl" REAL NOT NULL DEFAULT 0,
    "unrealized_pnl_percent" REAL NOT NULL DEFAULT 0,
    "portfolio_change_24h" REAL NOT NULL DEFAULT 0,
    "portfolio_change_24h_percent" REAL NOT NULL DEFAULT 0,
    "secondary_currency" TEXT NOT NULL DEFAULT 'EUR',
    "current_value_secondary" REAL NOT NULL DEFAULT 0,
    "last_updated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_price_update" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "bitcoin_price_history_date_key" ON "bitcoin_price_history"("date");

-- CreateIndex
CREATE INDEX "bitcoin_price_history_date_idx" ON "bitcoin_price_history"("date");

-- CreateIndex
CREATE UNIQUE INDEX "bitcoin_price_intraday_timestamp_key" ON "bitcoin_price_intraday"("timestamp");

-- CreateIndex
CREATE INDEX "bitcoin_price_intraday_timestamp_idx" ON "bitcoin_price_intraday"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_from_currency_to_currency_key" ON "exchange_rates"("from_currency", "to_currency");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "custom_currencies_code_key" ON "custom_currencies"("code");

