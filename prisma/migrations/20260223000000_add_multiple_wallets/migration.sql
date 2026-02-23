-- CreateTable: wallets
CREATE TABLE "wallets" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "emoji" TEXT,
  "note" TEXT,
  "include_in_portfolio" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "wallets_user_id_idx" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallets_type_idx" ON "wallets"("type");

-- AddColumn: from_wallet_id to bitcoin_transactions
ALTER TABLE "bitcoin_transactions" ADD COLUMN "from_wallet_id" INTEGER REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddColumn: to_wallet_id to bitcoin_transactions
ALTER TABLE "bitcoin_transactions" ADD COLUMN "to_wallet_id" INTEGER REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "bitcoin_transactions_from_wallet_id_idx" ON "bitcoin_transactions"("from_wallet_id");

-- CreateIndex
CREATE INDEX "bitcoin_transactions_to_wallet_id_idx" ON "bitcoin_transactions"("to_wallet_id");
