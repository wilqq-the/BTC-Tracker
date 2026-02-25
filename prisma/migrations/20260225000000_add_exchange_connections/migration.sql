-- CreateTable
CREATE TABLE "exchange_connections" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "exchange_name" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "encrypted_api_key" TEXT NOT NULL,
    "encrypted_api_secret" TEXT NOT NULL,
    "wallet_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" DATETIME,
    "last_sync_status" TEXT,
    "last_sync_error" TEXT,
    "last_sync_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exchange_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "exchange_connections_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "exchange_connections_user_id_idx" ON "exchange_connections"("user_id");

-- CreateIndex
CREATE INDEX "exchange_connections_exchange_name_idx" ON "exchange_connections"("exchange_name");
