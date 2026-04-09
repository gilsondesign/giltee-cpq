-- Migration: add profit_mode and profit_value to quotes table
-- Run once against your Postgres database:
--   psql $DATABASE_URL -f server/db/migrations/001_add_profit_columns.sql

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS profit_mode  TEXT    NOT NULL DEFAULT 'per_shirt',
  ADD COLUMN IF NOT EXISTS profit_value NUMERIC NOT NULL DEFAULT 0;
