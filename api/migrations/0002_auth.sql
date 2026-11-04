-- ============================================================
-- 0002_auth.sql: Authentication, Sessions & Household RBAC
-- Cloudflare D1 enforces foreign keys by default.
-- ============================================================

-- ------------------------------------------------------------
-- 1. USERS
-- Normalized email addresses and production-grade password hashes
-- ------------------------------------------------------------
CREATE TABLE users (
  id              TEXT PRIMARY KEY NOT NULL,
  email           TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),

  CONSTRAINT uq_users_email
    UNIQUE (email),

  CONSTRAINT ck_users_email_nonempty
    CHECK (length(email) > 3 AND email LIKE '%@%.%'),

  CONSTRAINT ck_users_email_verified_bool
    CHECK (email_verified IN (0, 1))
);

CREATE INDEX idx_users_email ON users (email);

-- ------------------------------------------------------------
-- 2. SESSIONS
-- Stores SHA-256 hashes of session tokens
-- ------------------------------------------------------------
CREATE TABLE sessions (
  id              TEXT PRIMARY KEY NOT NULL,
  user_id         TEXT NOT NULL,
  token_hash      TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at  TEXT NOT NULL DEFAULT (datetime('now')),

  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,

  CONSTRAINT uq_sessions_token_hash
    UNIQUE (token_hash)
);

CREATE INDEX idx_sessions_token_hash ON sessions (token_hash);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

-- ------------------------------------------------------------
-- 3. HOME MEMBERSHIPS
-- Bridges authenticated users with households and roles:
-- 'owner' (full control), 'admin' (manage members & bills), 'member' (view & pay)
-- ------------------------------------------------------------
CREATE TABLE home_memberships (
  id          TEXT PRIMARY KEY NOT NULL,
  home_id     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  member_id   TEXT,
  role        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),

  CONSTRAINT fk_home_memberships_home
    FOREIGN KEY (home_id) REFERENCES homes (id) ON DELETE CASCADE,

  CONSTRAINT fk_home_memberships_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,

  CONSTRAINT fk_home_memberships_member
    FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE SET NULL,

  CONSTRAINT ck_home_memberships_role
    CHECK (role IN ('owner', 'admin', 'member')),

  CONSTRAINT uq_home_memberships_user_home
    UNIQUE (home_id, user_id)
);

CREATE INDEX idx_home_memberships_home_id ON home_memberships (home_id);
CREATE INDEX idx_home_memberships_user_id ON home_memberships (user_id);

-- ------------------------------------------------------------
-- 4. HOME INVITATIONS
-- Secure token-based invitation system with SHA-256 token hashing
-- ------------------------------------------------------------
CREATE TABLE home_invitations (
  id              TEXT PRIMARY KEY NOT NULL,
  home_id         TEXT NOT NULL,
  inviter_user_id TEXT NOT NULL,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL,
  token_hash      TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  accepted_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),

  CONSTRAINT fk_home_invitations_home
    FOREIGN KEY (home_id) REFERENCES homes (id) ON DELETE CASCADE,

  CONSTRAINT fk_home_invitations_inviter
    FOREIGN KEY (inviter_user_id) REFERENCES users (id) ON DELETE CASCADE,

  CONSTRAINT ck_home_invitations_role
    CHECK (role IN ('admin', 'member')),

  CONSTRAINT uq_home_invitations_token_hash
    UNIQUE (token_hash)
);

CREATE INDEX idx_home_invitations_token_hash ON home_invitations (token_hash);
CREATE INDEX idx_home_invitations_home_email ON home_invitations (home_id, email);

-- ------------------------------------------------------------
-- 5. SEED DEFAULT USER & ADOPT EXISTING DATA
-- Guarantees backwards compatibility for existing tests and data
-- ------------------------------------------------------------
INSERT OR IGNORE INTO users (id, email, password_hash, name, email_verified)
VALUES ('test-default-user', 'test@abodeledger.local', 'DISABLED_ACCOUNT_TEST_ONLY', 'Default Test User', 1);

INSERT OR IGNORE INTO home_memberships (id, home_id, user_id, role)
SELECT 'membership-' || id, id, 'test-default-user', 'owner'
FROM homes
WHERE id NOT IN (SELECT home_id FROM home_memberships);

