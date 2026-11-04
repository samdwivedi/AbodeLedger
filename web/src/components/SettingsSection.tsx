import { useState } from 'react'
import type { Home, Member, User } from '../api/client'
import { IconBuilding, IconCheck, IconCopy, IconLogOut, IconUsers } from './icons'

interface SettingsSectionProps {
  currentHome: Home | undefined
  members: Member[]
  user: User | null
  currentHomeRole?: string
  onLogout: () => void
}

export function SettingsSection({
  currentHome,
  members,
  user,
  currentHomeRole,
  onLogout,
}: SettingsSectionProps) {
  const [copiedId, setCopiedId] = useState(false)

  const handleCopyId = () => {
    if (!currentHome?.id) return
    navigator.clipboard.writeText(currentHome.id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const liveMemberCount = members.length

  return (
    <div>
      {/* Header */}
      <div className="page-intro">
        <div>
          <h1 className="page-heading">Household Settings</h1>
          <p className="page-subheading">Configuration details and active account parameters.</p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
        }}
      >
        {/* Household Information Card */}
        <div className="card card-padding">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-subtle)',
                color: 'var(--secondary-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconBuilding size={18} />
            </div>
            <div>
              <h2 className="section-heading" style={{ margin: 0 }}>
                Household Information
              </h2>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Active apartment parameters
              </div>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="settings-home-name" className="form-label">
              Household Name
            </label>
            <input
              id="settings-home-name"
              type="text"
              className="form-input"
              value={currentHome?.name || 'No home selected'}
              disabled
            />
          </div>

          <div className="form-field">
            <label htmlFor="settings-home-id" className="form-label">
              Unique Household UUID
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="settings-home-id"
                type="text"
                className="form-input"
                value={currentHome?.id || '—'}
                disabled
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                }}
              />
              {currentHome?.id && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCopyId}
                  title="Copy Household ID"
                >
                  {copiedId ? (
                    <IconCheck size={16} color="var(--success)" />
                  ) : (
                    <IconCopy size={16} />
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="settings-roommates-count" className="form-label">
              Registered Roommates
            </label>
            <input
              id="settings-roommates-count"
              type="text"
              className="form-input"
              value={`${liveMemberCount} roommate${liveMemberCount === 1 ? '' : 's'} registered in this household`}
              disabled
            />
            <span className="form-hint">
              Synchronized directly with active member ledger records.
            </span>
          </div>
        </div>

        {/* User Account & Session Profile */}
        <div className="card card-padding">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-subtle)',
                color: 'var(--secondary-green)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconUsers size={18} />
            </div>
            <div>
              <h2 className="section-heading" style={{ margin: 0 }}>
                Account Profile
              </h2>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Authenticated user session
              </div>
            </div>
          </div>

          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label htmlFor="settings-user-name" className="form-label">
                  Signed In As
                </label>
                <input
                  id="settings-user-name"
                  type="text"
                  className="form-input"
                  value={user.name}
                  disabled
                />
              </div>

              <div className="form-field" style={{ marginBottom: 0 }}>
                <label htmlFor="settings-user-email" className="form-label">
                  Email Address
                </label>
                <input
                  id="settings-user-email"
                  type="email"
                  className="form-input"
                  value={user.email}
                  disabled
                />
              </div>

              <div className="form-field" style={{ marginBottom: 0 }}>
                <label htmlFor="settings-household-role" className="form-label">
                  Household Membership Role
                </label>
                <input
                  id="settings-household-role"
                  type="text"
                  className="form-input"
                  value={currentHomeRole || 'Member'}
                  disabled
                  style={{ textTransform: 'capitalize' }}
                />
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={onLogout}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 6,
                  color: 'var(--danger)',
                  borderColor: 'var(--danger-border)',
                }}
              >
                <IconLogOut size={16} />
                <span>Sign Out of Account</span>
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              No active user authenticated.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
