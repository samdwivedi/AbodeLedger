import type { Home, User } from '../api/client'
import { IconBuilding, IconLogOut, IconMenu, IconPlus } from './icons'
import type { NavTab } from './Sidebar'

interface HeaderProps {
  activeTab: NavTab
  homes: Home[]
  selectedHomeId: string
  user: User | null
  currentHomeRole?: string
  hasMembers?: boolean
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
  currentHomeRole,
  hasMembers = true,
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
        return 'Financial Overview'
      case 'bills':
        return 'Household Bills'
      case 'members':
        return 'Roommates & Members'
      case 'balances':
        return 'Settlement Balances'
      case 'settings':
        return 'Household Settings'
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

  const currentHome = homes.find((h) => h.id === selectedHomeId)

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

        <div>
          <span className="page-title">{getPageTitle(activeTab)}</span>
          {currentHome && (
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              Active Apartment: <strong>{currentHome.name}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="header-right">
        {/* Household Selector Dropdown */}
        <div className="home-selector-pill">
          <IconBuilding size={15} color="var(--secondary-green)" />
          <select
            className="home-selector-select"
            value={selectedHomeId}
            onChange={(e) => {
              if (e.target.value === '__NEW__') {
                onOpenCreateHome()
              } else {
                onSelectHome(e.target.value)
              }
            }}
            aria-label="Select Household"
          >
            {homes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
            <option value="__NEW__">+ New Household...</option>
          </select>
        </div>

        {/* Quick Action: Split Bill */}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onOpenCreateBill}
          disabled={!hasMembers || !selectedHomeId}
          title={
            !hasMembers ? 'Add roommates before splitting bills' : 'Split a new household expense'
          }
        >
          <IconPlus size={15} />
          <span>Split Bill</span>
        </button>

        {/* User Pill or Sign In Button */}
        {user ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 8,
              borderLeft: '1px solid var(--border)',
            }}
          >
            <div
              className="user-avatar"
              style={{ width: 30, height: 30, fontSize: 12 }}
              title={`${user.name} (${currentHomeRole || 'Member'})`}
            >
              {initials}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onLogout}
              style={{ padding: '4px 8px', fontSize: 11.5 }}
              title="Sign Out"
            >
              <IconLogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenAuth}>
            Sign In
          </button>
        )}
      </div>
    </header>
  )
}
