import { useState } from 'react'
import type { Bill, Member } from '../api/client'
import { formatPaise } from '../utils/currency'
import { IconCheck, IconChevronDown, IconChevronRight, IconReceipt } from './icons'

interface BillsSectionProps {
  bills: Bill[]
  members?: Member[]
  onOpenCreateBill: () => void
  onPayShare: (billId: string, shareId: string) => Promise<void>
  payingShareIds: Set<string>
  hasMembers: boolean
}

export function BillsSection({
  bills,
  members,
  onOpenCreateBill,
  onPayShare,
  payingShareIds,
  hasMembers,
}: BillsSectionProps) {
  // Track expanded bills state
  const [expandedBillIds, setExpandedBillIds] = useState<Set<string>>(
    () => new Set(bills.map((b) => b.id)),
  )

  const toggleExpand = (billId: string) => {
    setExpandedBillIds((prev) => {
      const next = new Set(prev)
      if (next.has(billId)) {
        next.delete(billId)
      } else {
        next.add(billId)
      }
      return next
    })
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
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
          <h1 className="page-heading">Household Bills</h1>
          <p className="page-subheading" style={{ marginBottom: 0 }}>
            Track shared expenses, payment statuses, and individual member shares.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenCreateBill}
          disabled={!hasMembers}
        >
          + Split New Bill
        </button>
      </div>

      {bills.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap">
            <IconReceipt size={22} />
          </div>
          <h3 className="empty-title">No bills recorded yet</h3>
          <p className="empty-description">
            Split utilities, internet, groceries, or household supplies evenly across members.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenCreateBill}
            disabled={!hasMembers}
          >
            Create Bill
          </button>
        </div>
      ) : (
        <div className="bills-container">
          {bills.map((bill) => {
            const isExpanded = expandedBillIds.has(bill.id)
            const paidShares = bill.shares.filter((s) => s.paidAt !== null)
            const paidAmount = paidShares.reduce((acc, s) => acc + s.amountCents, 0)
            const unpaidAmount = bill.totalCents - paidAmount
            const progressPercent = Math.round((paidAmount / bill.totalCents) * 100)
            const isFullyPaid = paidShares.length === bill.shares.length

            return (
              <div key={bill.id} className="bill-card-item">
                <button
                  type="button"
                  className="bill-main-row"
                  style={{ width: '100%', textAlign: 'left', border: 'none' }}
                  onClick={() => toggleExpand(bill.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="bill-info">
                    <div className="bill-icon-box">
                      <IconReceipt size={18} />
                    </div>
                    <div>
                      <div className="bill-title-text">{bill.title}</div>
                      <div className="bill-date-text">
                        {formatDate(bill.createdAt)} • {bill.shares.length} roommates
                      </div>
                    </div>
                  </div>

                  <div className="bill-metrics">
                    {/* Progress Bar & Status */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span className={`badge ${isFullyPaid ? 'badge-paid' : 'badge-pending'}`}>
                          {isFullyPaid
                            ? 'Fully Settled'
                            : `${paidShares.length}/${bill.shares.length} Paid`}
                        </span>
                      </div>
                      <div className="bill-progress-bar-wrap">
                        <div
                          className="bill-progress-bar-fill"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Total Amount & Unpaid */}
                    <div className="bill-amount-block">
                      <div className="bill-total-amount">{formatPaise(bill.totalCents)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {unpaidAmount > 0 ? `${formatPaise(unpaidAmount)} unpaid` : 'Settled'}
                      </div>
                    </div>

                    <div style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                      {isExpanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                    </div>
                  </div>
                </button>

                {/* Expandable Individual Member Shares */}
                {isExpanded && (
                  <div className="shares-expand-panel">
                    <table className="shares-table">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Share Amount</th>
                          <th>Payment Status</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bill.shares.map((share) => {
                          const isPaid = share.paidAt !== null
                          const isProcessing = payingShareIds.has(share.id)
                          const matchedMember = members?.find((m) => m.id === share.memberId)
                          const memberName = share.memberName || matchedMember?.name || 'Roommate'
                          const avatarInitial = (memberName || 'R').charAt(0).toUpperCase()

                          return (
                            <tr key={share.id}>
                              <td style={{ fontWeight: 500 }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 22,
                                      height: 22,
                                      borderRadius: '50%',
                                      background: 'var(--border-light)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 10.5,
                                      fontWeight: 600,
                                      color: 'var(--text-secondary)',
                                    }}
                                  >
                                    {avatarInitial}
                                  </div>
                                  <span>{memberName}</span>
                                </div>
                              </td>

                              <td style={{ fontWeight: 600 }}>{formatPaise(share.amountCents)}</td>

                              <td>
                                {isPaid ? (
                                  <span className="badge badge-paid">
                                    <IconCheck size={12} />
                                    <span>Paid</span>
                                  </span>
                                ) : isProcessing ? (
                                  <span className="badge badge-processing">
                                    <span className="spinner" />
                                    <span>Processing</span>
                                  </span>
                                ) : (
                                  <span className="badge badge-pending">Pending</span>
                                )}
                              </td>

                              <td style={{ textAlign: 'right' }}>
                                {!isPaid && (
                                  <button
                                    type="button"
                                    className="btn btn-pay"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onPayShare(bill.id, share.id)
                                    }}
                                    disabled={isProcessing}
                                  >
                                    {isProcessing ? (
                                      <>
                                        <span className="spinner" />
                                        <span>Paying...</span>
                                      </>
                                    ) : (
                                      'Pay Share'
                                    )}
                                  </button>
                                )}
                                {isPaid && (
                                  <span
                                    style={{
                                      fontSize: 11.5,
                                      color: 'var(--text-muted)',
                                    }}
                                  >
                                    Confirmed
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
