import type { Balance, Bill, Member } from '../api/client'
import { formatPaise } from '../utils/currency'
import { IconPlus, IconUsers } from './icons'

interface MembersSectionProps {
  members: Member[]
  balances: Balance[]
  bills: Bill[]
  onOpenAddMember: () => void
}

export function MembersSection({ members, balances, bills, onOpenAddMember }: MembersSectionProps) {
  // Precompute unpaid share counts per member
  const unpaidCountByMember = new Map<string, number>()
  for (const b of bills) {
    for (const s of b.shares) {
      if (s.paidAt === null) {
        unpaidCountByMember.set(s.memberId, (unpaidCountByMember.get(s.memberId) || 0) + 1)
      }
    }
  }

  // Precompute balance lookup
  const balanceMap = new Map<string, number>()
  for (const b of balances) {
    balanceMap.set(b.memberId, b.outstandingCents)
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 className="page-heading">Household Members</h1>
          <p className="page-subheading" style={{ marginBottom: 0 }}>
            Members sharing apartment expenses. The order added determines FIFO remainder cent
            allocation.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onOpenAddMember}>
          <IconPlus size={16} />
          <span>Add Member</span>
        </button>
      </div>

      {members.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap">
            <IconUsers size={22} />
          </div>
          <h3 className="empty-title">No roommates added yet</h3>
          <p className="empty-description">
            Add roommates to your household to begin splitting utility and rent bills.
          </p>
          <button type="button" className="btn btn-primary" onClick={onOpenAddMember}>
            Add First Member
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {members.map((member, index) => {
            const outstanding = balanceMap.get(member.id) ?? 0
            const unpaidShares = unpaidCountByMember.get(member.id) ?? 0

            return (
              <div key={member.id} className="card card-padding">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      {member.name ? member.name.charAt(0).toUpperCase() : 'M'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                        {member.name || 'Member'}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        Position #{index + 1}
                      </div>
                    </div>
                  </div>

                  <span className={`badge ${outstanding === 0 ? 'badge-paid' : 'badge-pending'}`}>
                    {outstanding === 0 ? 'Settled' : 'Pending'}
                  </span>
                </div>

                <div
                  style={{
                    borderTop: '1px solid var(--border-light)',
                    paddingTop: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Outstanding</div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: outstanding === 0 ? 'var(--success)' : 'var(--text-primary)',
                      }}
                    >
                      {formatPaise(outstanding)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Unpaid Shares</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>
                      {unpaidShares} bill{unpaidShares === 1 ? '' : 's'}
                    </div>
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
