-- Sessions (managed automatically by connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid"    VARCHAR    NOT NULL COLLATE "default",
  "sess"   JSON       NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
) WITH (OIDS=FALSE);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Users
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL       PRIMARY KEY,
  email      VARCHAR(255) UNIQUE NOT NULL,
  name       VARCHAR(255),
  avatar_url VARCHAR(500),
  role       VARCHAR(20)  NOT NULL DEFAULT 'member',
  status     VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
  last_login TIMESTAMP
);

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id         SERIAL       PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  token      VARCHAR(255) UNIQUE NOT NULL,
  invited_by INTEGER      REFERENCES users(id),
  status     VARCHAR(20)  NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP    NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Quotes (schema only — fully populated in Plan B)
CREATE TABLE IF NOT EXISTS quotes (
  id                   VARCHAR(20)  PRIMARY KEY,
  status               VARCHAR(20)  NOT NULL DEFAULT 'draft',
  customer_name        VARCHAR(255),
  customer_email       VARCHAR(255),
  project_name         VARCHAR(255),
  raw_input            TEXT,
  intake_record        JSONB,
  garment_data         JSONB,
  pricing_osp          JSONB,
  pricing_redwall      JSONB,
  recommended_supplier VARCHAR(20),
  qa_report            JSONB,
  email_draft          TEXT,
  gmail_draft_id       VARCHAR(255),
  pdf_url              VARCHAR(500),
  activity_log         JSONB        NOT NULL DEFAULT '[]',
  created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
  created_by           VARCHAR(255)      -- Stores user email/name (denormalized per PRD — not a FK)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_quotes_status        ON quotes (status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by    ON quotes (created_by);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_email ON quotes (customer_email);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at    ON quotes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_email    ON invitations (email);

-- Sequence for quote ID generation (atomic, concurrent-safe, deletion-safe)
CREATE SEQUENCE IF NOT EXISTS quotes_seq START 1;
