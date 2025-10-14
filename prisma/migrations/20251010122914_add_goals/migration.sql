-- CreateTable
CREATE TABLE "goals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Bitcoin Savings Goal',
    "target_btc_amount" REAL NOT NULL,
    "target_date" DATETIME NOT NULL,
    "current_holdings" REAL NOT NULL DEFAULT 0,
    "monthly_budget" REAL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "monthly_btc_needed" REAL NOT NULL,
    "monthly_fiat_needed" REAL NOT NULL,
    "total_months" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "goals_user_id_idx" ON "goals"("user_id");

-- CreateIndex
CREATE INDEX "goals_is_active_idx" ON "goals"("is_active");
