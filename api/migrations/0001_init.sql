-- ============================================================
-- 0001_init.sql: Initial database schema for AbodeLedger
-- Cloudflare D1 enforces foreign keys by default.
-- ============================================================

-- ------------------------------------------------------------
-- HOMES
-- ------------------------------------------------------------
CREATE TABLE homes (
  id         TEXT PRIMARY KEY NOT NULL,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- MEMBERS
-- Deterministic position ordering per home
-- ------------------------------------------------------------
CREATE TABLE members (
  id         TEXT PRIMARY KEY NOT NULL,
  home_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  CONSTRAINT fk_members_home
    FOREIGN KEY (home_id) REFERENCES homes (id),

  CONSTRAINT uq_members_position
    UNIQUE (home_id, position)
);

CREATE INDEX idx_members_home_id ON members (home_id);

-- ------------------------------------------------------------
-- BILLS
-- total_cents must be a positive integer
-- ------------------------------------------------------------
CREATE TABLE bills (
  id          TEXT PRIMARY KEY NOT NULL,
  home_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),

  CONSTRAINT fk_bills_home
    FOREIGN KEY (home_id) REFERENCES homes (id),

  CONSTRAINT ck_bills_total_positive
    CHECK (total_cents > 0 AND total_cents = CAST(total_cents AS INTEGER))
);

CREATE INDEX idx_bills_home_id ON bills (home_id);

-- ------------------------------------------------------------
-- SHARES
-- amount_cents can be >= 0 (zero-cent shares are valid for small amounts)
-- Exactly one share per member per bill
-- ------------------------------------------------------------
CREATE TABLE shares (
  id              TEXT PRIMARY KEY NOT NULL,
  bill_id         TEXT NOT NULL,
  member_id       TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,
  paid_at         TEXT,
  idempotency_key TEXT,

  CONSTRAINT fk_shares_bill
    FOREIGN KEY (bill_id) REFERENCES bills (id),

  CONSTRAINT fk_shares_member
    FOREIGN KEY (member_id) REFERENCES members (id),

  CONSTRAINT ck_shares_amount_not_negative
    CHECK (amount_cents >= 0 AND amount_cents = CAST(amount_cents AS INTEGER)),

  CONSTRAINT uq_shares_bill_member
    UNIQUE (bill_id, member_id)
);

CREATE INDEX idx_shares_bill_id ON shares (bill_id);
CREATE INDEX idx_shares_member_id ON shares (member_id);
