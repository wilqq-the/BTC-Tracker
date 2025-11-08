-- CreateTable
CREATE TABLE "recurring_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BUY',
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "fees" REAL NOT NULL DEFAULT 0,
    "fees_currency" TEXT NOT NULL DEFAULT 'USD',
    "frequency" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME,
    "max_occurrences" INTEGER,
    "last_executed" DATETIME,
    "execution_count" INTEGER NOT NULL DEFAULT 0,
    "next_execution" DATETIME NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "goal_id" INTEGER,
    "notes" TEXT DEFAULT '',
    "tags" TEXT DEFAULT '',
    CONSTRAINT "recurring_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recurring_transactions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "recurring_transactions_user_id_idx" ON "recurring_transactions"("user_id");

-- CreateIndex
CREATE INDEX "recurring_transactions_is_active_idx" ON "recurring_transactions"("is_active");

-- CreateIndex
CREATE INDEX "recurring_transactions_next_execution_idx" ON "recurring_transactions"("next_execution");

-- CreateIndex
CREATE INDEX "recurring_transactions_goal_id_idx" ON "recurring_transactions"("goal_id");
