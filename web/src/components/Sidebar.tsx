import type React from 'react'
import type { User } from '../api/client'
import {
  IconDashboard,
  IconLogOut,
  IconReceipt,
  IconScale,
  IconSettings,
  IconUsers,
  IconX,
} from './icons'

export type NavTab = 'overview' | 'bills' | 'members' | 'balances' | 'settings'

interface SidebarProps {
  activeTab: NavTab
  onSelectTab: (tab: NavTab) => void
  isMobileOpen: boolean
  onCloseMobile: () => void
  billsCount?: number
  membersCount?: number
  user?: User | null
  currentHomeRole?: string
  onLogout?: () => void
}

export function Sidebar({
  activeTab,
  onSelectTab,
  isMobileOpen,
  onCloseMobile,
  billsCount,
  membersCount,
  user,
  currentHomeRole,
  onLogout,
}: SidebarProps) {
  const financeItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <IconDashboard size={18} /> },
    { id: 'bills', label: 'Bills', icon: <IconReceipt size={18} />, badge: billsCount },
    { id: 'balances', label: 'Balances', icon: <IconScale size={18} /> },
  ]

  const orgItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'members', label: 'Members', icon: <IconUsers size={18} />, badge: membersCount },
    { id: 'settings', label: 'Settings', icon: <IconSettings size={18} /> },
  ]

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab)
    onCloseMobile()
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
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <button
          type="button"
          className="modal-overlay"
          style={{ zIndex: 35, border: 'none', width: '100%', cursor: 'default' }}
          onClick={onCloseMobile}
          aria-label="Close mobile menu"
        />
      )}

      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-header">
          <div className="brand-emblem">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V21h14V9.5" />
              <path d="M9 21v-6h6v6" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-name">AbodeLedger</span>
            <span className="brand-subtitle">Shared FinTech</span>
          </div>

          {isMobileOpen && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginLeft: 'auto', padding: '4px' }}
              onClick={onCloseMobile}
              aria-label="Close menu"
            >
              <IconX size={16} />
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className="sidebar-nav">
          <div className="nav-section-title">Ledger & Finances</div>
          {financeItems.map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="nav-item-badge">{item.badge}</span>
                )}
              </button>
            )
          })}

          <div className="nav-section-title" style={{ marginTop: 16 }}>
            Household & System
          </div>
          {orgItems.map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="nav-item-badge">{item.badge}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* User Profile Card in Footer */}
        {user ? (
          <div className="sidebar-footer">
            <div className="user-profile-card">
              <div className="user-avatar">{initials}</div>
              <div className="user-details">
                <div className="user-name">{user.name}</div>
                <div className="user-role-tag">{currentHomeRole || 'Member'}</div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  className="user-logout-btn"
                  onClick={onLogout}
                  title="Sign out of account"
                  aria-label="Sign out"
                >
                  <IconLogOut size={16} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="sidebar-footer">
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              Deterministic Paise Engine
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', opacity: 0.8 }}>
              Cloudflare D1 • SQLite ACID
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
