-- Migration: add approval tracking columns to quotes table
-- Run once against your Postgres database:
--   psql $DATABASE_URL -f server/db/migrations/002_add_approval_columns.sql

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_by  VARCHAR(255);
