-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_goals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Bitcoin Savings Goal',
    "target_btc_amount" REAL NOT NULL,
    "target_date" DATETIME NOT NULL,
    "current_holdings" REAL NOT NULL DEFAULT 0,
    "monthly_budget" REAL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "price_scenario" TEXT NOT NULL DEFAULT 'stable',
    "scenario_growth_rate" REAL NOT NULL DEFAULT 0.0,
    "monthly_btc_needed" REAL NOT NULL,
    "monthly_fiat_needed" REAL NOT NULL,
    "total_fiat_needed" REAL NOT NULL DEFAULT 0,
    "total_months" INTEGER NOT NULL,
    "initial_btc_price" REAL NOT NULL DEFAULT 0,
    "final_btc_price" REAL NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_goals" ("completed_at", "created_at", "currency", "current_holdings", "id", "is_active", "is_completed", "monthly_btc_needed", "monthly_budget", "monthly_fiat_needed", "name", "target_btc_amount", "target_date", "total_months", "updated_at", "user_id") SELECT "completed_at", "created_at", "currency", "current_holdings", "id", "is_active", "is_completed", "monthly_btc_needed", "monthly_budget", "monthly_fiat_needed", "name", "target_btc_amount", "target_date", "total_months", "updated_at", "user_id" FROM "goals";
DROP TABLE "goals";
ALTER TABLE "new_goals" RENAME TO "goals";
CREATE INDEX "goals_user_id_idx" ON "goals"("user_id");
CREATE INDEX "goals_is_active_idx" ON "goals"("is_active");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
