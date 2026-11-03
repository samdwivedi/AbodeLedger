import type { Home } from '../api/client'

interface SettingsSectionProps {
  currentHome: Home | undefined
}

export function SettingsSection({ currentHome }: SettingsSectionProps) {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-heading">Household Settings</h1>
        <p className="page-subheading" style={{ marginBottom: 0 }}>
          Configuration details and ledger properties for the active apartment.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
        }}
      >
        {/* Apartment Details */}
        <div className="card card-padding">
          <h2 className="section-heading">Household Information</h2>

          <div className="form-field">
            <span className="form-label">Apartment / Home Name</span>
            <input
              type="text"
              className="form-input"
              value={currentHome?.name || 'No home selected'}
              disabled
              style={{ background: 'var(--bg-subtle)' }}
            />
          </div>

          <div className="form-field">
            <span className="form-label">Unique Household ID</span>
            <input
              type="text"
              className="form-input"
              value={currentHome?.id || '—'}
              disabled
              style={{
                background: 'var(--bg-subtle)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
            />
          </div>

          <div className="form-field">
            <span className="form-label">Total Roommates</span>
            <input
              type="text"
              className="form-input"
              value={`${currentHome?.memberCount ?? 0} members registered`}
              disabled
              style={{ background: 'var(--bg-subtle)' }}
            />
          </div>
        </div>

        {/* Ledger & Technical Architecture */}
        <div className="card card-padding">
          <h2 className="section-heading">Financial Ledger Engine</h2>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              fontSize: 13,
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontWeight: 600 }}>Currency System</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                Indian Rupee (₹) presentation layer over integer paise storage. Exact conservation
                with zero floating-point drift.
              </div>
            </div>

            <div
              style={{
                padding: '10px 12px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontWeight: 600 }}>Concurrency & Idempotency</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                Atomic conditional SQLite updates with mandatory <code>Idempotency-Key</code>{' '}
                headers prevent double-charging.
              </div>
            </div>

            <div
              style={{
                padding: '10px 12px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontWeight: 600 }}>Database Engine</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                Cloudflare D1 SQLite database with 5 named integrity constraints.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
