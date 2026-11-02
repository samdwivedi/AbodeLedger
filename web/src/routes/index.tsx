import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

export const Route = createFileRoute('/')({
  component: AbodeLedgerApp,
})

interface HomeItem {
  id: string
  name: string
  memberCount: number
}

interface Member {
  id: string
  name: string
  position: number
}

interface Balance {
  memberId: string
  name: string
  outstandingCents: number
}

interface Share {
  id: string
  billId: string
  memberId: string
  memberName: string
  amountCents: number
  paidAt: string | null
}

interface Bill {
  id: string
  homeId: string
  title: string
  totalCents: number
  createdAt: string
  shares: Share[]
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function AbodeLedgerApp() {
  const [homes, setHomes] = useState<HomeItem[]>([])
  const [selectedHomeId, setSelectedHomeId] = useState<string>('')
  const [members, setMembers] = useState<Member[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [balances, setBalances] = useState<Balance[]>([])

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [payingShareIds, setPayingShareIds] = useState<Set<string>>(new Set())

  // New Home Form
  const [newHomeName, setNewHomeName] = useState('')
  const [isCreatingHome, setIsCreatingHome] = useState(false)

  // New Member Form
  const [newMemberName, setNewMemberName] = useState('')
  const [isAddingMember, setIsAddingMember] = useState(false)

  // New Bill Form
  const [billTitle, setBillTitle] = useState('')
  const [billAmountDollars, setBillAmountDollars] = useState('')
  const [isCreatingBill, setIsCreatingBill] = useState(false)

  // Fetch homes list
  const fetchHomes = useCallback(async () => {
    try {
      const res = await fetch('/api/homes')
      if (!res.ok) {
        throw new Error(`Failed to load homes: HTTP ${res.status}`)
      }
      const data = (await res.json()) as { homes: HomeItem[] }
      setHomes(data.homes || [])
      if (data.homes.length > 0 && !selectedHomeId) {
        setSelectedHomeId(data.homes[0]?.id ?? '')
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to connect to the API server.')
    }
  }, [selectedHomeId])

  // Fetch home details, members, bills, and balances
  const fetchHomeData = useCallback(async (homeId: string) => {
    if (!homeId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setErrorBanner(null)

    try {
      const [homeRes, billsRes, balancesRes] = await Promise.all([
        fetch(`/api/homes/${homeId}`),
        fetch(`/api/homes/${homeId}/bills`),
        fetch(`/api/homes/${homeId}/balances`),
      ])

      if (!homeRes.ok) throw new Error('Home not found or server error')
      const homeData = (await homeRes.json()) as { members: Member[] }
      setMembers(homeData.members || [])

      if (billsRes.ok) {
        const billsData = (await billsRes.json()) as { bills: Bill[] }
        setBills(billsData.bills || [])
      } else {
        setBills([])
      }

      if (balancesRes.ok) {
        const balancesData = (await balancesRes.json()) as {
          balances: Balance[]
        }
        setBalances(balancesData.balances || [])
      } else {
        setBalances([])
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Error fetching home data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHomes()
  }, [fetchHomes])

  useEffect(() => {
    if (selectedHomeId) {
      fetchHomeData(selectedHomeId)
    }
  }, [selectedHomeId, fetchHomeData])

  // Create New Home
  const handleCreateHome = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newHomeName.trim()) return

    setIsCreatingHome(true)
    setErrorBanner(null)

    try {
      const res = await fetch('/api/homes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHomeName.trim() }),
      })

      const data = (await res.json()) as { id: string; error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create home')
      }

      setNewHomeName('')
      await fetchHomes()
      setSelectedHomeId(data.id)
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to create home')
    } finally {
      setIsCreatingHome(false)
    }
  }

  // Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberName.trim() || !selectedHomeId) return

    setIsAddingMember(true)
    setErrorBanner(null)

    try {
      const res = await fetch(`/api/homes/${selectedHomeId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMemberName.trim() }),
      })

      const data = (await res.json()) as { id: string; error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add member')
      }

      setNewMemberName('')
      await fetchHomeData(selectedHomeId)
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setIsAddingMember(false)
    }
  }

  // Create Bill
  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!billTitle.trim() || !billAmountDollars.trim() || !selectedHomeId) return

    const parsedDollars = parseFloat(billAmountDollars)
    if (Number.isNaN(parsedDollars) || parsedDollars <= 0) {
      setErrorBanner('Please enter a valid positive bill amount.')
      return
    }

    const totalCents = Math.round(parsedDollars * 100)
    setIsCreatingBill(true)
    setErrorBanner(null)

    try {
      const res = await fetch(`/api/homes/${selectedHomeId}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: billTitle.trim(),
          totalCents,
        }),
      })

      const data = (await res.json()) as { id: string; error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create bill')
      }

      setBillTitle('')
      setBillAmountDollars('')
      await fetchHomeData(selectedHomeId)
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to create bill')
    } finally {
      setIsCreatingBill(false)
    }
  }

  // Pay Share with Idempotency Key
  const handlePayShare = async (billId: string, shareId: string) => {
    setErrorBanner(null)
    setPayingShareIds((prev) => new Set(prev).add(shareId))

    // Per specification: unique Idempotency-Key
    const idempotencyKey = crypto.randomUUID()

    try {
      const res = await fetch(`/api/bills/${billId}/shares/${shareId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
      })

      const data = (await res.json()) as { paidAt?: string; error?: string }

      if (!res.ok || !data.paidAt) {
        // Keeps share unpaid and displays clear error per requirements
        throw new Error(data.error || `Payment failed with status ${res.status}`)
      }

      // Optimistically update local share state to paid
      setBills((prevBills) =>
        prevBills.map((b) => {
          if (b.id !== billId) return b
          return {
            ...b,
            shares: b.shares.map((s) => {
              if (s.id !== shareId) return s
              return { ...s, paidAt: data.paidAt || new Date().toISOString() }
            }),
          }
        }),
      )

      // Refresh balances
      if (selectedHomeId) {
        const balRes = await fetch(`/api/homes/${selectedHomeId}/balances`)
        if (balRes.ok) {
          const balData = (await balRes.json()) as { balances: Balance[] }
          setBalances(balData.balances || [])
        }
      }
    } catch (err) {
      // Per requirements: keeps share unpaid and shows error
      setErrorBanner(
        err instanceof Error ? err.message : 'Payment processing encountered an error.',
      )
    } finally {
      setPayingShareIds((prev) => {
        const next = new Set(prev)
        next.delete(shareId)
        return next
      })
    }
  }

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">⚖️</div>
          <div>
            <h1 className="brand-title">AbodeLedger</h1>
            <p className="brand-subtitle">Fair & Transparent Shared Bill Splitter</p>
          </div>
        </div>

        <div className="header-actions">
          {homes.length > 0 && (
            <select
              className="home-select"
              value={selectedHomeId}
              onChange={(e) => setSelectedHomeId(e.target.value)}
              aria-label="Select Home"
            >
              {homes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.memberCount} members)
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchHomeData(selectedHomeId)}
            title="Refresh Ledger"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      {/* Global Error Banner */}
      {errorBanner && (
        <div className="alert alert-danger" role="alert">
          <div>
            <strong>Error: </strong> {errorBanner}
          </div>
          <button
            type="button"
            className="btn btn-danger-outline"
            style={{ padding: '2px 8px', fontSize: '11px' }}
            onClick={() => setErrorBanner(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Setup if no homes exist */}
      {homes.length === 0 && !isLoading && (
        <div className="glass-card" style={{ marginBottom: 32 }}>
          <h2 className="section-title">Get Started: Create Your First Home</h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            Create a shared home to split bills fairly among roommates.
          </p>
          <form onSubmit={handleCreateHome} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Maple Street Apt 4B"
              value={newHomeName}
              onChange={(e) => setNewHomeName(e.target.value)}
              style={{ flex: 1, minWidth: 240 }}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={isCreatingHome}>
              {isCreatingHome ? <div className="spinner" /> : 'Create Home'}
            </button>
          </form>
        </div>
      )}

      {selectedHomeId && (
        <>
          {/* Real-time Balances Dashboard */}
          <div className="glass-card" style={{ marginBottom: 28 }}>
            <div className="section-title">
              <span>Outstanding Balances</span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  fontWeight: 400,
                }}
              >
                Calculated across unpaid shares
              </span>
            </div>

            {balances.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                No members found in this home yet.
              </p>
            ) : (
              <div className="balances-grid">
                {balances.map((b) => (
                  <div key={b.memberId} className="balance-card">
                    <span className="balance-member-name">{b.name}</span>
                    <span
                      className={`balance-amount ${b.outstandingCents === 0 ? 'zero' : 'owing'}`}
                    >
                      {formatCents(b.outstandingCents)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: b.outstandingCents === 0 ? 'var(--success)' : 'var(--text-muted)',
                      }}
                    >
                      {b.outstandingCents === 0 ? 'All settled up' : `${b.outstandingCents}¢ owed`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions Grid (Add Member & Add Bill) */}
          <div className="actions-grid">
            {/* Add Member Card */}
            <div className="glass-card">
              <h3 className="section-title">Add Roommate</h3>
              <form onSubmit={handleAddMember}>
                <div className="form-group">
                  <label htmlFor="member-name-input" className="form-label">
                    Name
                  </label>
                  <input
                    id="member-name-input"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Alex"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={isAddingMember}
                  style={{ width: '100%' }}
                >
                  {isAddingMember ? <div className="spinner" /> : '+ Add Roommate'}
                </button>
              </form>
            </div>

            {/* Split Bill Card */}
            <div className="glass-card">
              <h3 className="section-title">Split New Bill</h3>
              <form onSubmit={handleCreateBill}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr',
                    gap: 12,
                  }}
                >
                  <div className="form-group">
                    <label htmlFor="bill-title-input" className="form-label">
                      Title
                    </label>
                    <input
                      id="bill-title-input"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Electric & Gas"
                      value={billTitle}
                      onChange={(e) => setBillTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="bill-amount-input" className="form-label">
                      Amount ($)
                    </label>
                    <input
                      id="bill-amount-input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input"
                      placeholder="120.00"
                      value={billAmountDollars}
                      onChange={(e) => setBillAmountDollars(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isCreatingBill || members.length === 0}
                  style={{ width: '100%' }}
                >
                  {isCreatingBill ? (
                    <div className="spinner" />
                  ) : members.length === 0 ? (
                    'Add members before splitting'
                  ) : (
                    `Split between ${members.length} member${members.length === 1 ? '' : 's'}`
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Bills & Shares Section */}
          <div>
            <div className="section-title">
              <span>Home Bills & Shares</span>
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  fontWeight: 400,
                }}
              >
                {bills.length} bill{bills.length === 1 ? '' : 's'} recorded
              </span>
            </div>

            {isLoading ? (
              <div className="empty-state">
                <div className="spinner" style={{ margin: '0 auto 12px', width: 24, height: 24 }} />
                <p className="empty-text">Loading bills and shares...</p>
              </div>
            ) : bills.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🧾</div>
                <h4 className="empty-text">No bills recorded yet</h4>
                <p className="empty-subtext">
                  Split your first utility or grocery bill using the form above.
                </p>
              </div>
            ) : (
              <div className="bills-list">
                {bills.map((bill) => {
                  const paidCount = bill.shares.filter((s) => s.paidAt !== null).length
                  const isFullyPaid = paidCount === bill.shares.length

                  return (
                    <div key={bill.id} className="bill-card">
                      <div className="bill-header">
                        <div>
                          <div className="bill-title">{bill.title}</div>
                          <div className="bill-meta">
                            {bill.shares.length} shares •{' '}
                            {isFullyPaid
                              ? 'Fully Settled'
                              : `${paidCount}/${bill.shares.length} Paid`}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div className="bill-total">{formatCents(bill.totalCents)}</div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {bill.totalCents} cents
                          </div>
                        </div>
                      </div>

                      <div className="shares-list">
                        {bill.shares.map((share) => {
                          const isPaid = share.paidAt !== null
                          const isPaying = payingShareIds.has(share.id)

                          return (
                            <div key={share.id} className="share-row">
                              <div className="share-member">
                                <div className="member-avatar">
                                  {share.memberName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                                    {share.memberName}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: 'var(--text-muted)',
                                    }}
                                  >
                                    {share.amountCents} cents
                                  </div>
                                </div>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 14,
                                }}
                              >
                                <span className="share-amount">
                                  {formatCents(share.amountCents)}
                                </span>

                                {isPaid ? (
                                  <span className="badge badge-paid">✓ Paid</span>
                                ) : (
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                    }}
                                  >
                                    <span className="badge badge-unpaid">Unpaid</span>
                                    <button
                                      type="button"
                                      className="btn btn-pay"
                                      onClick={() => handlePayShare(bill.id, share.id)}
                                      disabled={isPaying}
                                    >
                                      {isPaying ? <div className="spinner" /> : 'Pay Share'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
