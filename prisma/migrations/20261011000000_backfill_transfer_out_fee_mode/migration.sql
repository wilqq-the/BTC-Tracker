-- Before fee modes existed (#168), this fork counted a TRANSFER_OUT as
-- btcAmount + fee leaving the portfolio: btcAmount is what the recipient got
-- and the fee was paid on top. That is the ON_TOP mode. Without this backfill
-- those rows would fall back to the DEDUCTED default and every send would stop
-- counting its network fee. Rows that already have a mode are left alone.
UPDATE "bitcoin_transactions"
SET "transfer_fee_mode" = 'ON_TOP'
WHERE "type" = 'TRANSFER'
  AND "transfer_type" = 'TRANSFER_OUT'
  AND "transfer_fee_mode" IS NULL;
