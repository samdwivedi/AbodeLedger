import type { Balance, Bill, Member } from '../api/client'
import { formatPaise } from '../utils/currency'
import { IconCheck, IconClock, IconPlus, IconUsers } from './icons'

interface MembersSectionProps {
  members: Member[]
  balances: Balance[]
  bills: Bill[]
  onOpenAddMember: () => void
}

export function MembersSection({ members, balances, bills, onOpenAddMember }: MembersSectionProps) {
  // Precompute unpaid share counts and assigned totals per member
  const unpaidCountByMember = new Map<string, number>()
  const assignedByMember = new Map<string, number>()

  for (const b of bills) {
    for (const s of b.shares || []) {
      const amt = Number(s.amountCents) || 0
      assignedByMember.set(s.memberId, (assignedByMember.get(s.memberId) || 0) + amt)
      if (s.paidAt === null) {
        unpaidCountByMember.set(s.memberId, (unpaidCountByMember.get(s.memberId) || 0) + 1)
      }
    }
  }

  // Precompute balance lookup
  const balanceMap = new Map<string, number>()
  for (const b of balances) {
    balanceMap.set(b.memberId, Number(b.outstandingCents) || 0)
  }

  return (
    <div>
      {/* Header */}
      <div className="page-intro">
        <div>
          <h1 className="page-heading">Household Roommates</h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={onOpenAddMember}>
          <IconPlus size={16} />
          <span>Add Roommate</span>
        </button>
      </div>

      {/* Members Grid or Empty State */}
      {members.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon-wrap">
            <IconUsers size={24} />
          </div>
          <h3 className="empty-title">No roommates registered yet</h3>
          <p className="empty-description">
            Add roommates to your household to begin creating bills and calculating fair shares.
          </p>
          <button type="button" className="btn btn-primary" onClick={onOpenAddMember}>
            Add First Roommate
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 18,
          }}
        >
          {members.map((member, index) => {
            const outstanding = balanceMap.get(member.id) ?? 0
            const assigned = assignedByMember.get(member.id) ?? 0
            const unpaidShares = unpaidCountByMember.get(member.id) ?? 0
            const isSettled = outstanding === 0
            const progress =
              assigned > 0
                ? Math.min(
                    100,
                    Math.max(0, Math.round(((assigned - outstanding) / assigned) * 100)),
                  )
                : 100

            return (
              <div key={member.id} className="card card-interactive card-padding">
                {/* Top Row: Avatar, Name, Position Badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      className="user-avatar"
                      style={{
                        width: 40,
                        height: 40,
                        fontSize: 15,
                        background: isSettled ? 'var(--surface-subtle)' : 'var(--primary-forest)',
                        color: isSettled ? 'var(--secondary-green)' : '#FFFFFF',
                        border: isSettled ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      {member.name ? member.name.charAt(0).toUpperCase() : 'M'}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                        {member.name || 'Member'}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        Priority Rank #{index + 1}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`badge ${isSettled ? 'badge-paid' : 'badge-pending'}`}
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
                        <span>{unpaidShares} Unpaid</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Financial Metrics Split */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    padding: '12px 0',
                    borderTop: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      Total Assigned
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginTop: 2,
                      }}
                    >
                      {formatPaise(assigned)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                      Outstanding Owed
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: isSettled ? 'var(--success)' : 'var(--danger)',
                        marginTop: 2,
                      }}
                    >
                      {formatPaise(outstanding)}
                    </div>
                  </div>
                </div>

                {/* Settlement Progress */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11.5,
                      color: 'var(--text-secondary)',
                      marginBottom: 6,
                    }}
                  >
                    <span>Settlement Clearance</span>
                    <span style={{ fontWeight: 600 }}>{progress}%</span>
                  </div>
                  <div className="progress-bar-track">
                    <div
                      className={`progress-bar-fill ${isSettled ? 'success' : ''}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
