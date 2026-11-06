import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'

// Applies every file in api/migrations to the test database before the tests run.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)

// Seed test runner account specifically for automated test suites executing without session cookies
await env.DB.prepare(
  `INSERT OR IGNORE INTO users (id, email, password_hash, name, email_verified)
   VALUES ('test-default-user', 'test@abodeledger.local', 'DISABLED_ACCOUNT_TEST_ONLY', 'Default Test User', 1)`,
).run()
