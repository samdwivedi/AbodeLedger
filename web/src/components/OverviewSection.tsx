import { useMemo, useState } from 'react'
import type { Balance, Bill, Member, User } from '../api/client'
import { formatPaise } from '../utils/currency'
import {
  IconBolt,
  IconCar,
  IconCreditCard,
  IconHome,
  IconPlus,
  IconReceipt,
  IconScale,
  IconSparkles,
  IconTrendingUp,
  IconUsers,
  IconUtensils,
  IconWifi,
} from './icons'

interface OverviewSectionProps {
  bills: Bill[]
  members: Member[]
  balances: Balance[]
  user?: User | null
  currentHomeName?: string
  onOpenCreateBill: () => void
  onOpenAddMember: () => void
  onNavigateTab: (tab: 'bills' | 'members' | 'balances') => void
}

// Category helper for real bills
function categorizeBill(title: string): { name: string; icon: typeof IconReceipt; color: string } {
  const t = title.toLowerCase()
  if (
    t.includes('wifi') ||
    t.includes('internet') ||
    t.includes('broadband') ||
    t.includes('jio') ||
    t.includes('airtel')
  ) {
    return { name: 'Internet & Wifi', icon: IconWifi, color: '#2563eb' }
  }
  if (
    t.includes('electric') ||
    t.includes('power') ||
    t.includes('bescom') ||
    t.includes('light') ||
    t.includes('utility')
  ) {
    return { name: 'Electricity & Utilities', icon: IconBolt, color: '#d97706' }
  }
  if (t.includes('rent') || t.includes('flat') || t.includes('house') || t.includes('deposit')) {
    return { name: 'Rent & Housing', icon: IconHome, color: 'var(--primary-forest)' }
  }
  if (
    t.includes('food') ||
    t.includes('grocery') ||
    t.includes('groceries') ||
    t.includes('cook') ||
    t.includes('swiggy') ||
    t.includes('zomato') ||
    t.includes('milk')
  ) {
    return { name: 'Food & Groceries', icon: IconUtensils, color: '#16a34a' }
  }
  if (
    t.includes('uber') ||
    t.includes('ola') ||
    t.includes('cab') ||
    t.includes('auto') ||
    t.includes('fuel') ||
    t.includes('petrol')
  ) {
    return { name: 'Transport & Commute', icon: IconCar, color: '#7c3aed' }
  }
  return { name: 'General Household', icon: IconReceipt, color: 'var(--secondary-green)' }
}

export function OverviewSection({
  bills,
  members,
  balances,
  user,
  currentHomeName,
  onOpenCreateBill,
  onOpenAddMember,
  onNavigateTab,
}: OverviewSectionProps) {
  const [activeTooltip, setActiveTooltip] = useState<{ label: string; amount: string } | null>(null)

  // 1. Core Financial Computations across all real bills
  const totalBillsPaise = useMemo(
    () => bills.reduce((acc, b) => acc + (Number(b.totalCents) || 0), 0),
    [bills],
  )

  const totalPaidPaise = useMemo(() => {
    let paid = 0
    for (const b of bills) {
      for (const s of b.shares || []) {
        if (s.paidAt !== null) {
          paid += Number(s.amountCents) || 0
        }
      }
    }
    return paid
  }, [bills])

  const outstandingPaise = Math.max(0, totalBillsPaise - totalPaidPaise)
  const percentSettled =
    totalBillsPaise > 0 ? Math.round((totalPaidPaise / totalBillsPaise) * 100) : 100
  const memberCount = members.length

  // 2. Spending Trend grouped by Month from actual bills
  const trendData = useMemo(() => {
    if (bills.length === 0) return []

    // Group bills by formatted month (e.g. "Nov 2026")
    const monthMap = new Map<string, { label: string; totalCents: number; count: number }>()

    // Sort bills ascending by date
    const sorted = [...bills].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )

    for (const b of sorted) {
      const date = new Date(b.createdAt)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const label = date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })

      const current = monthMap.get(monthKey) || { label, totalCents: 0, count: 0 }
      current.totalCents += Number(b.totalCents) || 0
      current.count += 1
      monthMap.set(monthKey, current)
    }

    return Array.from(monthMap.values())
  }, [bills])

  const maxTrendAmount = useMemo(
    () => Math.max(...trendData.map((d) => d.totalCents), 1),
    [trendData],
  )

  // 3. Category Breakdown aggregated from real bills
  const categoryData = useMemo(() => {
    if (bills.length === 0) return []

    const catMap = new Map<
      string,
      { name: string; icon: typeof IconReceipt; color: string; totalCents: number; count: number }
    >()

    for (const b of bills) {
      const { name, icon, color } = categorizeBill(b.title)
      const current = catMap.get(name) || { name, icon, color, totalCents: 0, count: 0 }
      current.totalCents += Number(b.totalCents) || 0
      current.count += 1
      catMap.set(name, current)
    }

    return Array.from(catMap.values()).sort((a, b) => b.totalCents - a.totalCents)
  }, [bills])

  const currentDateFormatted = new Date().toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div>
      {/* Top Banner & Greeting */}
      <div className="page-intro">
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--secondary-green)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 4,
            }}
          >
            <IconSparkles size={14} />
            <span>Fintech Overview • {currentDateFormatted}</span>
          </div>
          <h1 className="page-heading">
            {user ? `Welcome back, ${user.name}` : 'Household Financial Overview'}
          </h1>
          <p className="page-subheading">
            {currentHomeName ? (
              <>
                Active apartment: <strong>{currentHomeName}</strong>. Real-time ledger summary and
                fair-split status.
              </>
            ) : (
              'Real-time summary of shared household expenses and settlement status.'
            )}
          </p>
        </div>

        {/* Quick Actions Header Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenAddMember}>
            <IconUsers size={15} />
            <span>Add Member</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onOpenCreateBill}
            disabled={members.length === 0}
          >
            <IconPlus size={15} />
            <span>Split New Bill</span>
          </button>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="kpi-grid">
        {/* 1. Total Household Expenses */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Expenses</span>
            <div className="kpi-icon-wrap">
              <IconReceipt size={17} color="var(--primary-forest)" />
            </div>
          </div>
          <div className="kpi-value">{formatPaise(totalBillsPaise)}</div>
          <div className="kpi-footer">
            <span>
              {bills.length} total bill{bills.length === 1 ? '' : 's'} recorded
            </span>
          </div>
        </div>

        {/* 2. Total Paid */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Paid</span>
            <div
              className="kpi-icon-wrap"
              style={{ background: 'var(--success-subtle)', color: 'var(--success)' }}
            >
              <IconCreditCard size={17} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>
            {formatPaise(totalPaidPaise)}
          </div>
          <div className="kpi-footer">
            <div className="progress-bar-track" style={{ width: '100%', maxWidth: 100 }}>
              <div className="progress-bar-fill success" style={{ width: `${percentSettled}%` }} />
            </div>
            <span>{percentSettled}% settled</span>
          </div>
        </div>

        {/* 3. Outstanding Amount */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Outstanding</span>
            <div
              className="kpi-icon-wrap"
              style={{
                background:
                  outstandingPaise > 0 ? 'var(--warning-subtle)' : 'var(--success-subtle)',
                color: outstandingPaise > 0 ? 'var(--warning)' : 'var(--success)',
              }}
            >
              <IconScale size={17} />
            </div>
          </div>
          <div
            className="kpi-value"
            style={{
              color: outstandingPaise > 0 ? 'var(--text-primary)' : 'var(--success)',
            }}
          >
            {formatPaise(outstandingPaise)}
          </div>
          <div className="kpi-footer">
            <span
              className={`badge ${outstandingPaise === 0 ? 'badge-paid' : 'badge-pending'}`}
              style={{ fontSize: 11 }}
            >
              {outstandingPaise === 0 ? 'All Settled' : 'Pending Settlement'}
            </span>
          </div>
        </div>

        {/* 4. Household Members */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Roommates</span>
            <div className="kpi-icon-wrap">
              <IconUsers size={17} color="var(--secondary-green)" />
            </div>
          </div>
          <div className="kpi-value">{memberCount}</div>
          <div className="kpi-footer">
            <span>
              {memberCount === 0 ? 'No members registered' : `${memberCount} active in bill splits`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Dashboard Visualizations: Spending Trend & Category Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* A. Monthly Spending Trend */}
        <div className="card card-padding">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div>
              <h2 className="section-heading" style={{ margin: 0 }}>
                Expenditure Trend
              </h2>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Monthly household spending volume
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconTrendingUp size={16} color="var(--secondary-green)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--secondary-green)' }}>
                {trendData.length > 0 ? `${trendData.length} Period(s)` : 'Live Data'}
              </span>
            </div>
          </div>

          {trendData.length === 0 ? (
            <div className="empty-state" style={{ padding: '36px 16px' }}>
              <div className="empty-icon-wrap">
                <IconTrendingUp size={22} />
              </div>
              <div className="empty-title">No spending history</div>
              <p className="empty-description">
                Once bills are added to your household, your monthly spending chart will appear here
                automatically.
              </p>
            </div>
          ) : (
            <div>
              {/* Responsive SVG Bar Chart */}
              <div
                style={{
                  position: 'relative',
                  height: 180,
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 16,
                  padding: '20px 8px 0',
                }}
              >
                {trendData.map((d) => {
                  const heightPct = Math.max(12, Math.round((d.totalCents / maxTrendAmount) * 100))
                  return (
                    <button
                      type="button"
                      key={d.label}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        height: '100%',
                        justifyContent: 'flex-end',
                        padding: 0,
                      }}
                      onMouseEnter={() =>
                        setActiveTooltip({ label: d.label, amount: formatPaise(d.totalCents) })
                      }
                      onMouseLeave={() => setActiveTooltip(null)}
                      onFocus={() =>
                        setActiveTooltip({ label: d.label, amount: formatPaise(d.totalCents) })
                      }
                      onBlur={() => setActiveTooltip(null)}
                    >
                      <div
                        style={{
                          width: '100%',
                          maxWidth: 48,
                          height: `${heightPct}%`,
                          background:
                            'linear-gradient(180deg, var(--secondary-green) 0%, var(--primary-forest) 100%)',
                          borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: 'var(--text-secondary)',
                          marginTop: 8,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {d.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Tooltip Display */}
              <div
                style={{
                  minHeight: 24,
                  marginTop: 12,
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}
              >
                {activeTooltip ? (
                  <span>
                    <strong>{activeTooltip.label}:</strong> {activeTooltip.amount} total billed
                  </span>
                ) : (
                  <span>Hover over a period to see detailed expense amounts</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* B. Category Breakdown */}
        <div className="card card-padding">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div>
              <h2 className="section-heading" style={{ margin: 0 }}>
                Category Allocation
              </h2>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Expense distribution by type
              </div>
            </div>
          </div>

          {categoryData.length === 0 ? (
            <div className="empty-state" style={{ padding: '36px 16px' }}>
              <div className="empty-icon-wrap">
                <IconReceipt size={22} />
              </div>
              <div className="empty-title">No categories yet</div>
              <p className="empty-description">
                Add bills like Rent, Wifi, or Groceries to see automated categorization.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {categoryData.slice(0, 5).map((cat) => {
                const IconComponent = cat.icon
                const pct =
                  totalBillsPaise > 0 ? Math.round((cat.totalCents / totalBillsPaise) * 100) : 0

                return (
                  <div key={cat.name}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                        fontSize: 13,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--surface-subtle)',
                            color: cat.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconComponent size={15} />
                        </div>
                        <span style={{ fontWeight: 600 }}>{cat.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          ({cat.count} bill{cat.count === 1 ? '' : 's'})
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatPaise(cat.totalCents)}
                        </span>
                        <span
                          style={{
                            fontSize: 11.5,
                            color: 'var(--text-secondary)',
                            marginLeft: 6,
                          }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>

                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: cat.color,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Two Column Grid: Recent Bills & Member Balances Snapshot */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
        }}
      >
        {/* C. Recent Bills Card */}
        <div className="card card-padding">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div>
              <h2 className="section-heading" style={{ margin: 0 }}>
                Recent Bills
              </h2>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Latest shared household expenses
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab('bills')}
            >
              View All Bills
            </button>
          </div>

          {bills.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-icon-wrap">
                <IconReceipt size={22} />
              </div>
              <div className="empty-title">No bills created yet</div>
              <p className="empty-description">
                Create your first household bill to split expenses fairly.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onOpenCreateBill}
                disabled={members.length === 0}
              >
                Split Bill
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bills.slice(0, 4).map((b) => {
                const paidShares = (b.shares || []).filter((s) => s.paidAt !== null).length
                const totalShares = (b.shares || []).length
                const isComplete = totalShares > 0 && paidShares === totalShares
                const { icon: CatIcon, color: catColor } = categorizeBill(b.title)

                const formattedDate = new Date(b.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })

                return (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-subtle)',
                          color: catColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CatIcon size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{b.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          {formattedDate} • {totalShares} share{totalShares === 1 ? '' : 's'} •{' '}
                          {isComplete ? 'All Settled' : `${paidShares}/${totalShares} paid`}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {formatPaise(Number(b.totalCents) || 0)}
                      </div>
                      <span
                        className={`badge ${isComplete ? 'badge-paid' : 'badge-pending'}`}
                        style={{ fontSize: 11 }}
                      >
                        {isComplete ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* D. Member Balances Snapshot */}
        <div className="card card-padding">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div>
              <h2 className="section-heading" style={{ margin: 0 }}>
                Roommate Balances
              </h2>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Net outstanding debt per member
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab('balances')}
            >
              View Full Ledger
            </button>
          </div>

          {members.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-icon-wrap">
                <IconUsers size={22} />
              </div>
              <div className="empty-title">No members in household</div>
              <p className="empty-description">
                Add roommates to start splitting rent and utility bills.
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={onOpenAddMember}>
                Add Member
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {balances.map((b) => {
                const outstanding = Number(b.outstandingCents) || 0
                const isSettled = outstanding === 0

                return (
                  <div
                    key={b.memberId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--surface)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        className="user-avatar"
                        style={{
                          width: 30,
                          height: 30,
                          background: isSettled ? 'var(--surface-subtle)' : 'var(--primary-forest)',
                          color: isSettled ? 'var(--secondary-green)' : '#FFFFFF',
                          border: isSettled ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        {b.name ? b.name.charAt(0).toUpperCase() : 'M'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{b.name || 'Member'}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          {isSettled ? 'Zero outstanding' : 'Unpaid share balance'}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: isSettled ? 'var(--success)' : 'var(--text-primary)',
                        }}
                      >
                        {formatPaise(outstanding)}
                      </div>
                      <span
                        className={`badge ${isSettled ? 'badge-paid' : 'badge-owed'}`}
                        style={{ fontSize: 11 }}
                      >
                        {isSettled ? 'Settled' : 'Owed'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
