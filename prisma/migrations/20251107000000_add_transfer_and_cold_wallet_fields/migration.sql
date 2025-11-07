-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Add new fields to bitcoin_transactions table
CREATE TABLE "new_bitcoin_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "btc_amount" REAL NOT NULL,
    "user_id" INTEGER,
    "original_price_per_btc" REAL NOT NULL DEFAULT 0,
    "original_currency" TEXT NOT NULL,
    "original_total_amount" REAL NOT NULL DEFAULT 0,
    "fees" REAL NOT NULL DEFAULT 0,
    "fees_currency" TEXT NOT NULL DEFAULT 'USD',
    "transaction_date" DATETIME NOT NULL,
    "notes" TEXT,
    "tags" TEXT,
    "transfer_type" TEXT,
    "destination_address" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bitcoin_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Copy existing data
INSERT INTO "new_bitcoin_transactions" (
    "id", "type", "btc_amount", "user_id", "original_price_per_btc", 
    "original_currency", "original_total_amount", "fees", "fees_currency", 
    "transaction_date", "notes", "tags", "created_at", "updated_at"
)
SELECT 
    "id", "type", "btc_amount", "user_id", "original_price_per_btc", 
    "original_currency", "original_total_amount", "fees", "fees_currency", 
    "transaction_date", "notes", "tags", "created_at", "updated_at"
FROM "bitcoin_transactions";

-- Drop old table
DROP TABLE "bitcoin_transactions";

-- Rename new table
ALTER TABLE "new_bitcoin_transactions" RENAME TO "bitcoin_transactions";

-- Recreate indexes
CREATE INDEX "bitcoin_transactions_user_id_idx" ON "bitcoin_transactions"("user_id");
CREATE INDEX "bitcoin_transactions_type_idx" ON "bitcoin_transactions"("type");
CREATE INDEX "bitcoin_transactions_transfer_type_idx" ON "bitcoin_transactions"("transfer_type");

-- Add new fields to portfolio_summary table
CREATE TABLE "new_portfolio_summary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "total_btc" REAL NOT NULL DEFAULT 0,
    "total_transactions" INTEGER NOT NULL DEFAULT 0,
    "cold_wallet_btc" REAL NOT NULL DEFAULT 0,
    "hot_wallet_btc" REAL NOT NULL DEFAULT 0,
    "total_invested" REAL NOT NULL DEFAULT 0,
    "total_fees" REAL NOT NULL DEFAULT 0,
    "total_fees_btc" REAL NOT NULL DEFAULT 0,
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
    "last_price_update" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "portfolio_summary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Copy existing data from portfolio_summary
INSERT INTO "new_portfolio_summary" (
    "id", "user_id", "total_btc", "total_transactions", "total_invested", 
    "total_fees", "average_buy_price", "main_currency", "current_btc_price_usd", 
    "current_portfolio_value", "unrealized_pnl", "unrealized_pnl_percent", 
    "portfolio_change_24h", "portfolio_change_24h_percent", "secondary_currency", 
    "current_value_secondary", "last_updated", "last_price_update"
)
SELECT 
    "id", "user_id", "total_btc", "total_transactions", "total_invested", 
    "total_fees", "average_buy_price", "main_currency", "current_btc_price_usd", 
    "current_portfolio_value", "unrealized_pnl", "unrealized_pnl_percent", 
    "portfolio_change_24h", "portfolio_change_24h_percent", "secondary_currency", 
    "current_value_secondary", "last_updated", "last_price_update"
FROM "portfolio_summary";

-- Drop old table
DROP TABLE "portfolio_summary";

-- Rename new table
ALTER TABLE "new_portfolio_summary" RENAME TO "portfolio_summary";

-- Recreate indexes and unique constraints
CREATE UNIQUE INDEX "portfolio_summary_user_id_key" ON "portfolio_summary"("user_id");
CREATE INDEX "portfolio_summary_user_id_idx" ON "portfolio_summary"("user_id");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
