-- CreateTable
CREATE TABLE "wallets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "temperature" TEXT NOT NULL DEFAULT 'HOT',
    "emoji" TEXT,
    "color" TEXT,
    "notes" TEXT,
    "include_in_total" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "source_wallet_id" INTEGER,
    "destination_wallet_id" INTEGER,
    "transfer_category" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bitcoin_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bitcoin_transactions_source_wallet_id_fkey" FOREIGN KEY ("source_wallet_id") REFERENCES "wallets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bitcoin_transactions_destination_wallet_id_fkey" FOREIGN KEY ("destination_wallet_id") REFERENCES "wallets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_bitcoin_transactions" ("btc_amount", "created_at", "destination_address", "fees", "fees_currency", "id", "notes", "original_currency", "original_price_per_btc", "original_total_amount", "tags", "transaction_date", "transfer_type", "type", "updated_at", "user_id") SELECT "btc_amount", "created_at", "destination_address", "fees", "fees_currency", "id", "notes", "original_currency", "original_price_per_btc", "original_total_amount", "tags", "transaction_date", "transfer_type", "type", "updated_at", "user_id" FROM "bitcoin_transactions";
DROP TABLE "bitcoin_transactions";
ALTER TABLE "new_bitcoin_transactions" RENAME TO "bitcoin_transactions";
CREATE INDEX "bitcoin_transactions_user_id_idx" ON "bitcoin_transactions"("user_id");
CREATE INDEX "bitcoin_transactions_type_idx" ON "bitcoin_transactions"("type");
CREATE INDEX "bitcoin_transactions_transfer_type_idx" ON "bitcoin_transactions"("transfer_type");
CREATE INDEX "bitcoin_transactions_source_wallet_id_idx" ON "bitcoin_transactions"("source_wallet_id");
CREATE INDEX "bitcoin_transactions_destination_wallet_id_idx" ON "bitcoin_transactions"("destination_wallet_id");
CREATE INDEX "bitcoin_transactions_transfer_category_idx" ON "bitcoin_transactions"("transfer_category");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "wallets_user_id_idx" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_name_key" ON "wallets"("user_id", "name");
