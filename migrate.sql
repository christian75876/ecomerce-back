-- Migration: advertising module
-- Run this if DATABASE_SYNCHRONIZE=false and the columns/tables do not exist yet.

-- 1. Add advertising_expires_at column to stores table
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS advertising_expires_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL;

-- 2. Create store_advertisements table
CREATE TABLE IF NOT EXISTS store_advertisements (
  id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                UUID            NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  start_date              DATE            NOT NULL,
  end_date                DATE            NOT NULL,
  paid_amount             NUMERIC(12, 2)  NOT NULL DEFAULT 0,
  payment_method          TEXT            NOT NULL DEFAULT 'CASH'
                            CHECK (payment_method IN ('CASH', 'TRANSFER', 'OTHER')),
  status                  TEXT            NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')),
  notes                   TEXT            DEFAULT NULL,
  registered_by_user_id   INTEGER         DEFAULT NULL,
  created_at              TIMESTAMP       NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP       NOT NULL DEFAULT NOW()
);
