import type { Home, User } from '../api/client'
import { IconBuilding, IconMenu, IconPlus } from './icons'
import type { NavTab } from './Sidebar'

interface HeaderProps {
  activeTab: NavTab
  homes: Home[]
  selectedHomeId: string
  user: User | null
  onSelectHome: (homeId: string) => void
  onOpenCreateHome: () => void
  onOpenCreateBill: () => void
  onToggleMobileMenu: () => void
  onOpenAuth: () => void
  onLogout: () => void
}

export function Header({
  activeTab,
  homes,
  selectedHomeId,
  user,
  onSelectHome,
  onOpenCreateHome,
  onOpenCreateBill,
  onToggleMobileMenu,
  onOpenAuth,
  onLogout,
}: HeaderProps) {
  const getPageTitle = (tab: NavTab): string => {
    switch (tab) {
      case 'overview':
        return 'Dashboard'
      case 'bills':
        return 'Household Bills'
      case 'members':
        return 'Members'
      case 'balances':
        return 'Balance Summary'
      case 'settings':
        return 'Settings'
    }
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'AL'

  return (
    <header className="top-header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleMobileMenu}
          aria-label="Open mobile menu"
        >
          <IconMenu size={20} />
        </button>
        <span className="page-title">{getPageTitle(activeTab)}</span>
      </div>

      <div className="header-right">
        {/* Home Selector Dropdown */}
        <div
          className="home-dropdown-wrapper"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--bg-main)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 8px',
            }}
          >
            <IconBuilding size={15} color="var(--text-secondary)" />
            <select
              value={selectedHomeId}
              onChange={(e) => {
                if (e.target.value === '__NEW__') {
                  onOpenCreateHome()
                } else {
                  onSelectHome(e.target.value)
                }
              }}
              aria-label="Select Apartment"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 500,
                padding: '4px 2px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {homes.length === 0 ? (
                <option value="">No homes created</option>
              ) : (
                homes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))
              )}
              <option value="__NEW__">+ Create New Home...</option>
            </select>
          </div>
        </div>

        {/* Primary CTA: Create Bill */}
        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenCreateBill}
          disabled={!selectedHomeId}
        >
          <IconPlus size={16} />
          <span>Create Bill</span>
        </button>

        {/* Authentication State & Profile */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--primary-subtle, rgba(37, 99, 235, 0.1))',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--primary)',
              }}
              title={`${user.name} (${user.email})`}
            >
              {initials}
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user.name}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onLogout}
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onOpenAuth}
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  )
}
