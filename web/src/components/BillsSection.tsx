import { useMemo, useState } from 'react'
import type { Bill, Member, User } from '../api/client'
import { formatPaise } from '../utils/currency'
import {
  IconBolt,
  IconCar,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconFilter,
  IconHome,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconUtensils,
  IconWifi,
} from './icons'

interface BillsSectionProps {
  bills: Bill[]
  members?: Member[]
  user?: User | null
  currentHomeRole?: 'owner' | 'admin' | 'member'
  currentMemberId?: string | null
  onOpenCreateBill: () => void
  onOpenAuth?: () => void
  onPayShare: (billId: string, shareId: string) => Promise<void>
  payingShareIds: Set<string>
  hasMembers: boolean
}

function categorizeBill(title: string): { name: string; icon: typeof IconReceipt; color: string } {
  const t = title.toLowerCase()
  if (
    t.includes('wifi') ||
    t.includes('internet') ||
    t.includes('broadband') ||
    t.includes('jio') ||
    t.includes('airtel')
  ) {
    return { name: 'Internet', icon: IconWifi, color: '#2563eb' }
  }
  if (
    t.includes('electric') ||
    t.includes('power') ||
    t.includes('bescom') ||
    t.includes('light') ||
    t.includes('utility')
  ) {
    return { name: 'Electricity', icon: IconBolt, color: '#d97706' }
  }
  if (t.includes('rent') || t.includes('flat') || t.includes('house') || t.includes('deposit')) {
    return { name: 'Rent', icon: IconHome, color: 'var(--primary-forest)' }
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
    return { name: 'Food', icon: IconUtensils, color: '#16a34a' }
  }
  if (
    t.includes('uber') ||
    t.includes('ola') ||
    t.includes('cab') ||
    t.includes('auto') ||
    t.includes('fuel') ||
    t.includes('petrol')
  ) {
    return { name: 'Transport', icon: IconCar, color: '#7c3aed' }
  }
  return { name: 'Other', icon: IconReceipt, color: 'var(--secondary-green)' }
}

export function BillsSection({
  bills,
  members = [],
  user,
  currentHomeRole,
  currentMemberId,
  onOpenCreateBill,
  onOpenAuth,
  onPayShare,
  payingShareIds,
  hasMembers,
}: BillsSectionProps) {
  // Search & Filtering state
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL')
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC'>(
    'DATE_DESC',
  )
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('ALL')

  // Expandable bill drawers
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

  const expandAll = () => setExpandedBillIds(new Set(bills.map((b) => b.id)))
  const collapseAll = () => setExpandedBillIds(new Set())

  // Filter & Sort logic
  const filteredBills = useMemo(() => {
    let result = [...bills]

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.shares || []).some((s) => (s.memberName || '').toLowerCase().includes(q)),
      )
    }

    // 2. Category Filter
    if (categoryFilter !== 'ALL') {
      result = result.filter((b) => categorizeBill(b.title).name === categoryFilter)
    }

    // 3. Status Filter
    if (statusFilter !== 'ALL') {
      result = result.filter((b) => {
        const total = (b.shares || []).length
        const paid = (b.shares || []).filter((s) => s.paidAt !== null).length
        const isSettled = total > 0 && paid === total
        return statusFilter === 'PAID' ? isSettled : !isSettled
      })
    }

    // 4. Member Filter
    if (selectedMemberFilter !== 'ALL') {
      result = result.filter((b) =>
        (b.shares || []).some((s) => s.memberId === selectedMemberFilter),
      )
    }

    // 5. Sorting
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      const amtA = Number(a.totalCents) || 0
      const amtB = Number(b.totalCents) || 0

      switch (sortBy) {
        case 'DATE_ASC':
          return dateA - dateB
        case 'AMOUNT_DESC':
          return amtB - amtA
        case 'AMOUNT_ASC':
          return amtA - amtB
        default:
          return dateB - dateA
      }
    })

    return result
  }, [bills, searchQuery, categoryFilter, statusFilter, selectedMemberFilter, sortBy])

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

  const isOwnerOrAdmin = currentHomeRole === 'owner' || currentHomeRole === 'admin'

  return (
    <div>
      {/* Page Header */}
      <div className="page-intro">
        <div>
          <h1 className="page-heading">Household Bills</h1>
          <p className="page-subheading">
            Track shared expenses, payment statuses, and individual member shares.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenCreateBill}
          disabled={!hasMembers}
        >
          <IconPlus size={16} />
          <span>Split New Bill</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card card-padding"
        style={{
          marginBottom: 20,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
          <IconSearch
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
            }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search bills by title or roommate..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>

        {/* Filter Dropdowns */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {/* Category Filter */}
          <select
            className="form-input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: 'auto', padding: '7px 12px', fontSize: 13 }}
            aria-label="Filter by category"
          >
            <option value="ALL">All Categories</option>
            <option value="Rent">Rent</option>
            <option value="Electricity">Electricity</option>
            <option value="Internet">Internet</option>
            <option value="Food">Food & Groceries</option>
            <option value="Transport">Transport</option>
            <option value="Other">Other</option>
          </select>

          {/* Status Filter */}
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'PAID' | 'PENDING')}
            style={{ width: 'auto', padding: '7px 12px', fontSize: 13 }}
            aria-label="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Settlement</option>
            <option value="PAID">Fully Settled</option>
          </select>

          {/* Member Filter */}
          {members.length > 0 && (
            <select
              className="form-input"
              value={selectedMemberFilter}
              onChange={(e) => setSelectedMemberFilter(e.target.value)}
              style={{ width: 'auto', padding: '7px 12px', fontSize: 13 }}
              aria-label="Filter by member"
            >
              <option value="ALL">All Roommates</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}

          {/* Sort Dropdown */}
          <select
            className="form-input"
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_DESC' | 'AMOUNT_ASC')
            }
            style={{ width: 'auto', padding: '7px 12px', fontSize: 13 }}
            aria-label="Sort bills"
          >
            <option value="DATE_DESC">Newest First</option>
            <option value="DATE_ASC">Oldest First</option>
            <option value="AMOUNT_DESC">Highest Amount</option>
            <option value="AMOUNT_ASC">Lowest Amount</option>
          </select>
        </div>
      </div>

      {/* Bill List Results Controls */}
      {bills.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            padding: '0 4px',
            fontSize: 12.5,
            color: 'var(--text-secondary)',
          }}
        >
          <span>
            Showing <strong>{filteredBills.length}</strong> of {bills.length} bill
            {bills.length === 1 ? '' : 's'}
          </span>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={expandAll}
              style={{ color: 'var(--secondary-green)', fontWeight: 500 }}
            >
              Expand All
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={collapseAll}
              style={{ color: 'var(--secondary-green)', fontWeight: 500 }}
            >
              Collapse All
            </button>
          </div>
        </div>
      )}

      {/* Empty States */}
      {bills.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon-wrap">
            <IconReceipt size={24} />
          </div>
          <h3 className="empty-title">No bills recorded yet</h3>
          <p className="empty-description">
            Split utilities, internet, groceries, or household supplies evenly across members with
            exact integer-cent precision.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenCreateBill}
            disabled={!hasMembers}
          >
            {hasMembers ? 'Split First Bill' : 'Add Roommates First'}
          </button>
        </div>
      ) : filteredBills.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon-wrap">
            <IconFilter size={24} />
          </div>
          <h3 className="empty-title">No matching bills found</h3>
          <p className="empty-description">
            Try adjusting your search query, status, or category filter to view bills.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery('')
              setCategoryFilter('ALL')
              setStatusFilter('ALL')
              setSelectedMemberFilter('ALL')
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        /* Bill Cards Accordion */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredBills.map((bill) => {
            const isExpanded = expandedBillIds.has(bill.id)
            const shares = bill.shares || []
            const paidShares = shares.filter((s) => s.paidAt !== null).length
            const isSettled = shares.length > 0 && paidShares === shares.length
            const pct = shares.length > 0 ? Math.round((paidShares / shares.length) * 100) : 0
            const { name: catName, icon: CatIcon, color: catColor } = categorizeBill(bill.title)

            return (
              <div key={bill.id} className="card" style={{ overflow: 'hidden' }}>
                {/* Bill Card Summary Header Button */}
                <button
                  type="button"
                  style={{
                    width: '100%',
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: 'var(--surface)',
                    borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                    gap: 16,
                    flexWrap: 'wrap',
                    textAlign: 'left',
                  }}
                  onClick={() => toggleExpand(bill.id)}
                  aria-expanded={isExpanded}
                >
                  {/* Left: Icon, Title, Date, Category */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-subtle)',
                        color: catColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <CatIcon size={20} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}
                        >
                          {bill.title}
                        </span>
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
                              <span>
                                {paidShares}/{shares.length} Paid
                              </span>
                            </>
                          )}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          marginTop: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <span>{formatDate(bill.createdAt)}</span>
                        <span>•</span>
                        <span>{catName}</span>
                        <span>•</span>
                        <span>
                          {shares.length} participant{shares.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Expand Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 17,
                          letterSpacing: '-0.02em',
                          color: 'var(--primary-forest)',
                        }}
                      >
                        {formatPaise(Number(bill.totalCents) || 0)}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        {isSettled ? '100% Settled' : `${pct}% Paid`}
                      </div>
                    </div>

                    <div
                      style={{
                        color: 'var(--text-secondary)',
                        padding: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      aria-hidden="true"
                    >
                      {isExpanded ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                    </div>
                  </div>
                </button>

                {/* Bill Shares Drawer (Expanded) */}
                {isExpanded && (
                  <div style={{ background: 'var(--surface-hover)', padding: '16px 20px' }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: 12,
                      }}
                    >
                      Member Share Breakdown
                    </div>

                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Roommate</th>
                            <th>Share Amount</th>
                            <th>Payment Status</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shares.map((share) => {
                            const isPaid = share.paidAt !== null
                            const isPaying = payingShareIds.has(share.id)
                            const memberName = share.memberName || 'Member'

                            // Determine if current user is allowed to pay this share:
                            // Allowed if:
                            // 1. User is owner or admin
                            // 2. OR currentMemberId matches share.memberId
                            // 3. OR current user name matches memberName
                            const isSelf =
                              (currentMemberId && share.memberId === currentMemberId) ||
                              (user?.name &&
                                memberName.trim().toLowerCase() === user.name.trim().toLowerCase())
                            const canPay = Boolean(user && !isPaid && (isOwnerOrAdmin || isSelf))

                            return (
                              <tr key={share.id}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div
                                      className="user-avatar"
                                      style={{
                                        width: 28,
                                        height: 28,
                                        fontSize: 11,
                                        background: isPaid
                                          ? 'var(--surface-subtle)'
                                          : 'var(--primary-forest)',
                                        color: isPaid ? 'var(--secondary-green)' : '#FFFFFF',
                                        border: isPaid ? '1px solid var(--border)' : 'none',
                                      }}
                                    >
                                      {memberName.charAt(0).toUpperCase()}
                                    </div>
                                    <span style={{ fontWeight: 600 }}>{memberName}</span>
                                    {isSelf && (
                                      <span
                                        className="badge badge-role"
                                        style={{ fontSize: 10, padding: '1px 6px' }}
                                      >
                                        You
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {formatPaise(Number(share.amountCents) || 0)}
                                </td>

                                <td>
                                  {isPaid ? (
                                    <span className="badge badge-paid">
                                      <IconCheck size={11} />
                                      <span>
                                        Paid {share.paidAt ? formatDate(share.paidAt) : ''}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="badge badge-pending">
                                      <IconClock size={11} />
                                      <span>Awaiting Payment</span>
                                    </span>
                                  )}
                                </td>

                                <td style={{ textAlign: 'right' }}>
                                  {!isPaid && !user && onOpenAuth && (
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      onClick={onOpenAuth}
                                      style={{ fontSize: 11.5 }}
                                    >
                                      Sign In to Pay
                                    </button>
                                  )}

                                  {!isPaid && user && canPay && (
                                    <button
                                      type="button"
                                      className="btn btn-pay"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onPayShare(bill.id, share.id)
                                      }}
                                      disabled={isPaying}
                                    >
                                      {isPaying ? (
                                        <>
                                          <span className="spinner" />
                                          <span>Paying...</span>
                                        </>
                                      ) : (
                                        'Pay Share'
                                      )}
                                    </button>
                                  )}

                                  {!isPaid && user && !canPay && (
                                    <span
                                      style={{
                                        fontSize: 12,
                                        color: 'var(--text-secondary)',
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      Awaiting {memberName}
                                    </span>
                                  )}

                                  {isPaid && (
                                    <span
                                      style={{
                                        fontSize: 12,
                                        color: 'var(--success)',
                                        fontWeight: 500,
                                      }}
                                    >
                                      Settled
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
          })}
        </div>
      )}
    </div>
  )
}
