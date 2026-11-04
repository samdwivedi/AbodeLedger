import type { Balance, Bill } from '../api/client'
import { formatPaise } from '../utils/currency'
import { IconArrowDownRight, IconCheck, IconClock, IconScale } from './icons'

interface BalancesSectionProps {
  balances: Balance[]
  bills: Bill[]
}

export function BalancesSection({ balances, bills }: BalancesSectionProps) {
  // Precompute total historical debt assigned to each member to calculate % cleared
  const totalAssignedByMember = new Map<string, number>()
  for (const b of bills) {
    for (const s of b.shares || []) {
      const amt = Number(s.amountCents) || 0
      totalAssignedByMember.set(s.memberId, (totalAssignedByMember.get(s.memberId) || 0) + amt)
    }
  }

  const totalOutstanding = balances.reduce((acc, b) => acc + (Number(b.outstandingCents) || 0), 0)

  const isHouseholdSettled = totalOutstanding === 0

  return (
    <div>
      {/* Header */}
      <div className="page-intro">
        <div>
          <h1 className="page-heading">Settlement Balances</h1>
          <p className="page-subheading">
            Individual roommate debt breakdown and automated settlement ledger across all household
            bills.
          </p>
        </div>
      </div>

      {balances.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon-wrap">
            <IconScale size={24} />
          </div>
          <h3 className="empty-title">No balance records available</h3>
          <p className="empty-description">
            Add roommates and create household bills to see net outstanding balances and debt
            reconciliation.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* A. Household Outstanding Summary Card */}
          <div
            className="card card-padding"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 20,
              background: isHouseholdSettled
                ? 'linear-gradient(135deg, var(--surface) 0%, var(--success-subtle) 100%)'
                : 'linear-gradient(135deg, var(--surface) 0%, var(--surface-subtle) 100%)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-secondary)',
                  marginBottom: 4,
                }}
              >
                Household Outstanding Ledger
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  color: isHouseholdSettled ? 'var(--success)' : 'var(--primary-forest)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatPaise(totalOutstanding)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                {isHouseholdSettled
                  ? 'All bills in this household have been settled completely.'
                  : 'Total unsettled debt remaining to be paid by roommates.'}
              </div>
            </div>

            <div>
              <span
                className={`badge ${isHouseholdSettled ? 'badge-paid' : 'badge-pending'}`}
                style={{ fontSize: 13, padding: '6px 14px' }}
              >
                {isHouseholdSettled ? (
                  <>
                    <IconCheck size={14} />
                    <span>All Expenses Cleared</span>
                  </>
                ) : (
                  <>
                    <IconClock size={14} />
                    <span>Active Settlement in Progress</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* B. Member Ledger Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h2 className="section-heading" style={{ margin: 0 }}>
                  Roommate Debt Ledger
                </h2>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Historical assigned expenses vs outstanding amounts
                </div>
              </div>
            </div>

            <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Roommate</th>
                    <th>Total Assigned</th>
                    <th>Paid Amount</th>
                    <th>Outstanding Amount</th>
                    <th>Settlement Progress</th>
                    <th style={{ textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => {
                    const totalAssigned = totalAssignedByMember.get(b.memberId) ?? 0
                    const outstanding = Number(b.outstandingCents) || 0
                    const paidAmount = Math.max(0, totalAssigned - outstanding)
                    const progressPct =
                      totalAssigned > 0
                        ? Math.min(100, Math.max(0, Math.round((paidAmount / totalAssigned) * 100)))
                        : 100
                    const isSettled = outstanding === 0

                    return (
                      <tr key={b.memberId}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              className="user-avatar"
                              style={{
                                width: 32,
                                height: 32,
                                fontSize: 12,
                                background: isSettled
                                  ? 'var(--surface-subtle)'
                                  : 'var(--primary-forest)',
                                color: isSettled ? 'var(--secondary-green)' : '#FFFFFF',
                                border: isSettled ? '1px solid var(--border)' : 'none',
                              }}
                            >
                              {b.name ? b.name.charAt(0).toUpperCase() : 'M'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600 }}>{b.name || 'Member'}</div>
                            </div>
                          </div>
                        </td>

                        <td style={{ color: 'var(--text-secondary)' }}>
                          {formatPaise(totalAssigned)}
                        </td>

                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                          {formatPaise(paidAmount)}
                        </td>

                        <td>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: isSettled ? 'var(--success)' : 'var(--danger)',
                            }}
                          >
                            {formatPaise(outstanding)}
                          </span>
                        </td>

                        <td style={{ minWidth: 160 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="progress-bar-track" style={{ flex: 1 }}>
                              <div
                                className={`progress-bar-fill ${isSettled ? 'success' : ''}`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: 12,
                                color: 'var(--text-secondary)',
                                width: 36,
                                textAlign: 'right',
                              }}
                            >
                              {progressPct}%
                            </span>
                          </div>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <span
                            className={`badge ${isSettled ? 'badge-paid' : 'badge-owed'}`}
                            style={{ fontSize: 11 }}
                          >
                            {isSettled ? (
                              <>
                                <IconCheck size={11} />
                                <span>Settled</span>
                              </>
                            ) : (
                              <>
                                <IconClock size={11} />
                                <span>Owed</span>
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* C. Who Owes Whom / Settlement Reconciliation Guidance */}
          <div className="card card-padding">
            <div style={{ marginBottom: 16 }}>
              <h2 className="section-heading">Settlement Reconciliation Guidance</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                Clear breakdown of unsettled member debts and resolution actions.
              </p>
            </div>

            {isHouseholdSettled ? (
              <div
                style={{
                  padding: '16px 20px',
                  background: 'var(--success-subtle)',
                  border: '1px solid var(--success-border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--success)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconCheck size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--success)', fontSize: 14 }}>
                    All Roommates are Completely Settled
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Every bill share across the household has been paid with atomic confirmation.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {balances
                  .filter((b) => (Number(b.outstandingCents) || 0) > 0)
                  .map((b) => {
                    const outstanding = Number(b.outstandingCents) || 0
                    return (
                      <div
                        key={b.memberId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          background: 'var(--surface-subtle)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--danger-subtle)',
                              color: 'var(--danger)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <IconArrowDownRight size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                              {b.name} owes {formatPaise(outstanding)}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                              Debtor to Household Ledger • Settle individual bill shares on the
                              Bills tab
                            </div>
                          </div>
                        </div>

                        <span className="badge badge-owed" style={{ fontSize: 12 }}>
                          {formatPaise(outstanding)} Pending
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
