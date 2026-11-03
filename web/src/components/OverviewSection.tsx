import type { Balance, Bill, Member } from '../api/client'
import { formatPaise } from '../utils/currency'
import { IconCreditCard, IconReceipt, IconScale, IconUsers } from './icons'

interface OverviewSectionProps {
  bills: Bill[]
  members: Member[]
  balances: Balance[]
  onOpenCreateBill: () => void
  onOpenAddMember: () => void
  onNavigateTab: (tab: 'bills' | 'members' | 'balances') => void
}

export function OverviewSection({
  bills,
  members,
  balances,
  onOpenCreateBill,
  onOpenAddMember,
  onNavigateTab,
}: OverviewSectionProps) {
  // Financial computations across all bills
  const totalBillsPaise = bills.reduce((acc, b) => acc + b.totalCents, 0)

  let totalPaidPaise = 0
  for (const b of bills) {
    for (const s of b.shares) {
      if (s.paidAt !== null) {
        totalPaidPaise += s.amountCents
      }
    }
  }

  const outstandingPaise = totalBillsPaise - totalPaidPaise
  const memberCount = members.length

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-heading">Financial Overview</h1>
        <p className="page-subheading">
          Real-time summary of shared household expenses and settlement status.
        </p>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="kpi-grid">
        {/* 1. Total Bills */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Bills</span>
            <IconReceipt size={17} color="var(--text-secondary)" />
          </div>
          <div className="kpi-value">{formatPaise(totalBillsPaise)}</div>
          <div className="kpi-description">
            {bills.length} total bill{bills.length === 1 ? '' : 's'} recorded
          </div>
        </div>

        {/* 2. Total Paid */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Paid</span>
            <IconCreditCard size={17} color="var(--success)" />
          </div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>
            {formatPaise(totalPaidPaise)}
          </div>
          <div className="kpi-description">
            {totalBillsPaise > 0
              ? `${Math.round((totalPaidPaise / totalBillsPaise) * 100)}% settled`
              : '0% settled'}
          </div>
        </div>

        {/* 3. Outstanding */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Outstanding</span>
            <IconScale size={17} color="var(--warning)" />
          </div>
          <div
            className="kpi-value"
            style={{
              color: outstandingPaise > 0 ? 'var(--text-primary)' : 'var(--success)',
            }}
          >
            {formatPaise(outstandingPaise)}
          </div>
          <div className="kpi-description">Remaining to be collected</div>
        </div>

        {/* 4. Members */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Members</span>
            <IconUsers size={17} color="var(--accent-primary)" />
          </div>
          <div className="kpi-value">{memberCount}</div>
          <div className="kpi-description">Registered roommates</div>
        </div>
      </div>

      {/* Two Column Grid: Recent Bills & Balances Snapshot */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
        }}
      >
        {/* Recent Bills Card */}
        <div className="card card-padding">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <h2 className="section-heading" style={{ margin: 0 }}>
              Recent Bills
            </h2>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab('bills')}
            >
              View All
            </button>
          </div>

          {bills.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
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
                Create Bill
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bills.slice(0, 4).map((b) => {
                const paidShares = b.shares.filter((s) => s.paidAt !== null).length
                const isComplete = paidShares === b.shares.length

                return (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13.5 }}>{b.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {b.shares.length} shares •{' '}
                        {isComplete ? 'Settled' : `${paidShares}/${b.shares.length} paid`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {formatPaise(b.totalCents)}
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

        {/* Member Balances Snapshot */}
        <div className="card card-padding">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <h2 className="section-heading" style={{ margin: 0 }}>
              Member Balances
            </h2>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigateTab('balances')}
            >
              Details
            </button>
          </div>

          {members.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-title">No members in this home</div>
              <p className="empty-description">
                Add household members to begin splitting utilities and rent.
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={onOpenAddMember}>
                Add Member
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {balances.map((b) => (
                <div
                  key={b.memberId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'var(--bg-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {b.name ? b.name.charAt(0).toUpperCase() : 'M'}
                    </div>
                    <span style={{ fontWeight: 500, fontSize: 13.5 }}>{b.name || 'Member'}</span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13.5,
                        color: b.outstandingCents === 0 ? 'var(--success)' : 'var(--text-primary)',
                      }}
                    >
                      {formatPaise(b.outstandingCents)}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: b.outstandingCents === 0 ? 'var(--success)' : 'var(--text-muted)',
                      }}
                    >
                      {b.outstandingCents === 0 ? 'Settled' : 'Owed'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
