-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_app_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "settings_data" TEXT NOT NULL,
    "last_updated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    CONSTRAINT "app_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_app_settings" ("id", "last_updated", "settings_data", "version") SELECT "id", "last_updated", "settings_data", "version" FROM "app_settings";
DROP TABLE "app_settings";
ALTER TABLE "new_app_settings" RENAME TO "app_settings";
CREATE INDEX "app_settings_user_id_idx" ON "app_settings"("user_id");
CREATE TABLE "new_bitcoin_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "btc_amount" REAL NOT NULL,
    "user_id" INTEGER,
    "original_price_per_btc" REAL NOT NULL,
    "original_currency" TEXT NOT NULL,
    "original_total_amount" REAL NOT NULL,
    "fees" REAL NOT NULL DEFAULT 0,
    "fees_currency" TEXT NOT NULL DEFAULT 'USD',
    "transaction_date" DATETIME NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bitcoin_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_bitcoin_transactions" ("btc_amount", "created_at", "fees", "fees_currency", "id", "notes", "original_currency", "original_price_per_btc", "original_total_amount", "transaction_date", "type", "updated_at") SELECT "btc_amount", "created_at", "fees", "fees_currency", "id", "notes", "original_currency", "original_price_per_btc", "original_total_amount", "transaction_date", "type", "updated_at" FROM "bitcoin_transactions";
DROP TABLE "bitcoin_transactions";
ALTER TABLE "new_bitcoin_transactions" RENAME TO "bitcoin_transactions";
CREATE INDEX "bitcoin_transactions_user_id_idx" ON "bitcoin_transactions"("user_id");
CREATE TABLE "new_custom_currencies" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custom_currencies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_custom_currencies" ("code", "created_at", "id", "is_active", "name", "symbol", "updated_at") SELECT "code", "created_at", "id", "is_active", "name", "symbol", "updated_at" FROM "custom_currencies";
DROP TABLE "custom_currencies";
ALTER TABLE "new_custom_currencies" RENAME TO "custom_currencies";
CREATE INDEX "custom_currencies_user_id_idx" ON "custom_currencies"("user_id");
CREATE UNIQUE INDEX "custom_currencies_user_id_code_key" ON "custom_currencies"("user_id", "code");
CREATE TABLE "new_portfolio_summary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
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
    "last_price_update" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "portfolio_summary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_portfolio_summary" ("average_buy_price", "current_btc_price_usd", "current_portfolio_value", "current_value_secondary", "id", "last_price_update", "last_updated", "main_currency", "portfolio_change_24h", "portfolio_change_24h_percent", "secondary_currency", "total_btc", "total_fees", "total_invested", "total_transactions", "unrealized_pnl", "unrealized_pnl_percent") SELECT "average_buy_price", "current_btc_price_usd", "current_portfolio_value", "current_value_secondary", "id", "last_price_update", "last_updated", "main_currency", "portfolio_change_24h", "portfolio_change_24h_percent", "secondary_currency", "total_btc", "total_fees", "total_invested", "total_transactions", "unrealized_pnl", "unrealized_pnl_percent" FROM "portfolio_summary";
DROP TABLE "portfolio_summary";
ALTER TABLE "new_portfolio_summary" RENAME TO "portfolio_summary";
CREATE INDEX "portfolio_summary_user_id_idx" ON "portfolio_summary"("user_id");
CREATE UNIQUE INDEX "portfolio_summary_user_id_key" ON "portfolio_summary"("user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
