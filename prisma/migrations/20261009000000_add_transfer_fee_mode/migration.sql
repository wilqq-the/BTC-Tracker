-- How a transfer's BTC network fee was paid (#168). NULL keeps the original
-- behaviour (fee taken from the amount), so existing balances don't change.
ALTER TABLE "bitcoin_transactions" ADD COLUMN "transfer_fee_mode" TEXT;
