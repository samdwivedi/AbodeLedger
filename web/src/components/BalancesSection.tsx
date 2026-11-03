import type { Balance, Bill } from '../api/client'
import { formatPaise } from '../utils/currency'
import { IconCheck, IconScale } from './icons'

interface BalancesSectionProps {
  balances: Balance[]
  bills: Bill[]
}

export function BalancesSection({ balances, bills }: BalancesSectionProps) {
  // Precompute total historical debt assigned to each member to calculate % cleared
  const totalAssignedByMember = new Map<string, number>()
  for (const b of bills) {
    for (const s of b.shares) {
      totalAssignedByMember.set(
        s.memberId,
        (totalAssignedByMember.get(s.memberId) || 0) + s.amountCents,
      )
    }
  }

  const totalOutstanding = balances.reduce((acc, b) => acc + b.outstandingCents, 0)

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-heading">Balance Summary</h1>
        <p className="page-subheading" style={{ marginBottom: 0 }}>
          Individual debt breakdown calculated across all unpaid bill shares in the household.
        </p>
      </div>

      {balances.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap">
            <IconScale size={22} />
          </div>
          <h3 className="empty-title">No balance data available</h3>
          <p className="empty-description">
            Add members and create household bills to see net outstanding balances.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Total Household Debt Callout Card */}
          <div
            className="card card-padding"
            style={{
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Total Household Outstanding
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 600,
                  color: totalOutstanding === 0 ? 'var(--success)' : 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                {formatPaise(totalOutstanding)}
              </div>
            </div>

            <div>
              <span
                className={`badge ${totalOutstanding === 0 ? 'badge-paid' : 'badge-pending'}`}
                style={{ fontSize: 13, padding: '4px 12px' }}
              >
                {totalOutstanding === 0 ? 'All Household Bills Settled' : 'Settlement in Progress'}
              </span>
            </div>
          </div>

          {/* Individual Member Balances Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-light)',
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              Member Ledger
            </div>

            <table className="shares-table">
              <thead>
                <tr>
                  <th>Roommate</th>
                  <th>Total Assigned</th>
                  <th>Outstanding Amount</th>
                  <th>Settlement Progress</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => {
                  const totalAssigned = totalAssignedByMember.get(b.memberId) ?? 0
                  const paidAmount = totalAssigned - b.outstandingCents
                  const progressPct =
                    totalAssigned > 0
                      ? Math.min(100, Math.max(0, Math.round((paidAmount / totalAssigned) * 100)))
                      : 100
                  const isSettled = b.outstandingCents === 0

                  return (
                    <tr key={b.memberId}>
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              background: 'var(--bg-subtle)',
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 600,
                              fontSize: 12,
                            }}
                          >
                            {b.name ? b.name.charAt(0).toUpperCase() : 'M'}
                          </div>
                          <span style={{ fontWeight: 600 }}>{b.name || 'Member'}</span>
                        </div>
                      </td>

                      <td style={{ color: 'var(--text-secondary)' }}>
                        {formatPaise(totalAssigned)}
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: isSettled ? 'var(--success)' : 'var(--text-primary)',
                          }}
                        >
                          {formatPaise(b.outstandingCents)}
                        </span>
                      </td>

                      <td style={{ minWidth: 160 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              height: 6,
                              background: 'var(--border-light)',
                              borderRadius: 9999,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${progressPct}%`,
                                height: '100%',
                                background: isSettled ? 'var(--success)' : 'var(--accent-primary)',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              color: 'var(--text-muted)',
                              width: 32,
                            }}
                          >
                            {progressPct}%
                          </span>
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {isSettled ? (
                          <span className="badge badge-paid">
                            <IconCheck size={12} />
                            <span>Settled</span>
                          </span>
                        ) : (
                          <span className="badge badge-pending">
                            <span>Pending</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
