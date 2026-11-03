import type React from 'react'
import { IconDashboard, IconReceipt, IconScale, IconSettings, IconUsers, IconX } from './icons'

export type NavTab = 'overview' | 'bills' | 'members' | 'balances' | 'settings'

interface SidebarProps {
  activeTab: NavTab
  onSelectTab: (tab: NavTab) => void
  isMobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({ activeTab, onSelectTab, isMobileOpen, onCloseMobile }: SidebarProps) {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <IconDashboard size={18} /> },
    { id: 'bills', label: 'Bills', icon: <IconReceipt size={18} /> },
    { id: 'members', label: 'Members', icon: <IconUsers size={18} /> },
    { id: 'balances', label: 'Balances', icon: <IconScale size={18} /> },
    { id: 'settings', label: 'Settings', icon: <IconSettings size={18} /> },
  ]

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab)
    onCloseMobile()
  }

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
        <div className="sidebar-header">
          <div className="logo-symbol">A</div>
          <span className="logo-text">AbodeLedger</span>
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

        <nav className="sidebar-nav">
          {navItems.map((item) => {
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
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div>Shared Household Ledger</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>v1.0 • Cloudflare D1</div>
        </div>
      </aside>
    </>
  )
}
