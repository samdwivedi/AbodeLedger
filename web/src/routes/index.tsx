import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api, type Balance, type Bill, type Home, type Member } from '../api/client'
import { AuthModal } from '../components/AuthModal'
import { AuthScreen } from '../components/AuthScreen'
import { BalancesSection } from '../components/BalancesSection'
import { BillsSection } from '../components/BillsSection'
import { Header } from '../components/Header'
import { IconAlertCircle } from '../components/icons'
import { MembersSection } from '../components/MembersSection'
import { AddMemberModal, CreateBillModal, CreateHomeModal } from '../components/Modals'
import { OverviewSection } from '../components/OverviewSection'
import { SettingsSection } from '../components/SettingsSection'
import { type NavTab, Sidebar } from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'

const SELECTED_HOME_KEY = 'abodeledger_selected_home_id'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { user, isLoading: isAuthLoading, isAuthenticated, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<NavTab>('overview')
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  // Data states
  const [homes, setHomes] = useState<Home[]>([])
  const [selectedHomeId, setSelectedHomeId] = useState<string>(() => {
    try {
      return localStorage.getItem(SELECTED_HOME_KEY) || ''
    } catch {
      return ''
    }
  })
  const [members, setMembers] = useState<Member[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [currentHomeRole, setCurrentHomeRole] = useState<'owner' | 'admin' | 'member' | undefined>()
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null)

  // Loading & Error states
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  // Modals
  const [isCreateHomeOpen, setIsCreateHomeOpen] = useState(false)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isCreateBillOpen, setIsCreateBillOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  // Payment in-flight and idempotency tracking
  const [payingShareIds, setPayingShareIds] = useState<Set<string>>(new Set())
  const idempotencyKeysRef = useRef<Map<string, string>>(new Map())

  // Sync selectedHomeId with localStorage
  const handleSelectHome = useCallback((homeId: string) => {
    setSelectedHomeId(homeId)
    try {
      if (homeId) {
        localStorage.setItem(SELECTED_HOME_KEY, homeId)
      } else {
        localStorage.removeItem(SELECTED_HOME_KEY)
      }
    } catch {
      // Ignore localStorage access failures
    }
  }, [])

  // Load homes list
  const loadHomes = useCallback(async () => {
    if (!isAuthenticated) return []

    try {
      const homeList = await api.getHomes()
      setHomes(homeList)

      // Ensure valid active home selection
      if (homeList.length > 0) {
        // If current selected home still exists in list, keep it; otherwise default to first home
        setSelectedHomeId((currentId) => {
          const exists = homeList.some((h) => h.id === currentId)
          const validId = exists ? currentId : (homeList[0]?.id ?? '')
          try {
            localStorage.setItem(SELECTED_HOME_KEY, validId)
          } catch {
            // Ignore
          }
          return validId
        })
      } else {
        setSelectedHomeId('')
        setMembers([])
        setBills([])
        setBalances([])
      }
      return homeList
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Unable to connect to the AbodeLedger API.',
      )
      return []
    }
  }, [isAuthenticated])

  // Load active home details (members, bills, balances)
  const loadHomeDetails = useCallback(
    async (homeId: string) => {
      if (!homeId || !isAuthenticated) {
        setIsDataLoading(false)
        return
      }

      setIsDataLoading(true)
      setErrorBanner(null)

      try {
        const [homeData, billsData, balancesData] = await Promise.all([
          api.getHome(homeId),
          api.getBills(homeId),
          api.getBalances(homeId),
        ])

        setMembers(homeData.members || [])
        setBills(billsData || [])
        setBalances(balancesData || [])
        setCurrentHomeRole(homeData.userRole)
        setCurrentMemberId(homeData.currentMemberId ?? null)
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : 'Error loading apartment details')
      } finally {
        setIsDataLoading(false)
      }
    },
    [isAuthenticated],
  )

  // Initial load when user authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      loadHomes()
    } else {
      setHomes([])
      setMembers([])
      setBills([])
      setBalances([])
      setIsDataLoading(false)
    }
  }, [isAuthenticated, loadHomes])

  // Load home details whenever active household changes
  useEffect(() => {
    if (isAuthenticated && selectedHomeId) {
      loadHomeDetails(selectedHomeId)
    }
  }, [isAuthenticated, selectedHomeId, loadHomeDetails])

  // Modal Handlers
  const handleCreateHome = async (name: string) => {
    const newHome = await api.createHome(name)
    await loadHomes()
    handleSelectHome(newHome.id)
    setErrorBanner(null)
  }

  const handleAddMember = async (name: string) => {
    if (!selectedHomeId) return
    await api.addMember(selectedHomeId, name)
    // Synchronize both home details and homes list to keep memberCount 100% consistent
    await Promise.all([loadHomeDetails(selectedHomeId), loadHomes()])
    setErrorBanner(null)
  }

  const handleCreateBill = async (title: string, totalPaise: number) => {
    if (!selectedHomeId) return
    await api.createBill(selectedHomeId, title, totalPaise)
    // Synchronize both home details and homes list
    await Promise.all([loadHomeDetails(selectedHomeId), loadHomes()])
    setErrorBanner(null)
  }

  // Payment Handler with robust Idempotency retention & 409 handling
  const handlePayShare = async (billId: string, shareId: string) => {
    setErrorBanner(null)
    setPayingShareIds((prev) => new Set(prev).add(shareId))

    // Requirement: Retain identical key across retries and network errors
    let idempotencyKey = idempotencyKeysRef.current.get(shareId)
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID()
      idempotencyKeysRef.current.set(shareId, idempotencyKey)
    }

    try {
      const paidShare = await api.payShare(billId, shareId, idempotencyKey)

      // Requirement: Update interface ONLY after server confirmation (no optimistic mark)
      setBills((prevBills) =>
        prevBills.map((b) => {
          if (b.id !== billId) return b
          return {
            ...b,
            shares: (b.shares || []).map((s) => (s.id === shareId ? paidShare : s)),
          }
        }),
      )

      // Refresh balances from server
      if (selectedHomeId) {
        const updatedBalances = await api.getBalances(selectedHomeId)
        setBalances(updatedBalances)
      }

      // Cleanup key on successful confirmed payment
      idempotencyKeysRef.current.delete(shareId)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Requirement: On HTTP 409, refresh bills and balances from backend
        if (selectedHomeId) {
          await loadHomeDetails(selectedHomeId)
        }
        setErrorBanner('This share was already paid by another session.')
      } else {
        setErrorBanner(err instanceof Error ? err.message : 'Payment failed. Share remains unpaid.')
      }
    } finally {
      setPayingShareIds((prev) => {
        const next = new Set(prev)
        next.delete(shareId)
        return next
      })
    }
  }

  const handleLogout = async () => {
    await logout()
    handleSelectHome('')
    setActiveTab('overview')
  }

  // Support dev preview query parameter for automated documentation screenshots
  const previewParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('preview')
      : null
  const isPreview = Boolean(previewParam)

  const effectiveTab: NavTab =
    isPreview &&
    (previewParam === 'bills' ||
      previewParam === 'members' ||
      previewParam === 'balances' ||
      previewParam === 'settings')
      ? previewParam
      : activeTab

  // 1. Splash Screen while restoring auth session
  if (isAuthLoading && !isPreview) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-main)',
          gap: 16,
        }}
      >
        <div className="brand-emblem" style={{ width: 44, height: 44, fontSize: 18 }}>
          AL
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}
        >
          <span className="spinner spinner-dark" />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Connecting to AbodeLedger...</span>
        </div>
      </div>
    )
  }

  // 2. CRITICAL USER REQUIREMENT:
  // "just opeing wesbste first open login page then open rest things"
  // If not authenticated, open the premium login/registration screen directly!
  if (!isAuthenticated && !isPreview) {
    return <AuthScreen onSuccess={() => loadHomes()} />
  }

  // Demo preview fallback data when capturing screenshots
  const effectiveUser = user || (isPreview ? { id: 'demo-user', name: 'Maya Sharma', email: 'maya@example.com' } : null)
  const effectiveHomes = homes.length > 0 ? homes : (isPreview ? [{ id: 'demo-home', name: 'Palm Grove Residency 402', createdAt: new Date().toISOString(), memberCount: 3 }] : [])
  const effectiveHomeId = selectedHomeId || (isPreview ? 'demo-home' : '')
  const effectiveMembers = members.length > 0 ? members : (isPreview ? [
    { id: 'm1', homeId: 'demo-home', name: 'SHUBHUMA', position: 1 },
    { id: 'm2', homeId: 'demo-home', name: 'SHIVAM', position: 2 },
    { id: 'm3', homeId: 'demo-home', name: 'Maya Sharma', position: 3 },
  ] : [])

  const effectiveBills: Bill[] = bills.length > 0 ? bills : (isPreview ? [
    {
      id: 'b1',
      homeId: 'demo-home',
      title: 'High-Speed Fiber Internet',
      totalCents: 150000,
      createdAt: new Date().toISOString(),
      shares: [
        { id: 's1', billId: 'b1', memberId: 'm1', memberName: 'SHUBHUMA', amountCents: 50000, paidAt: new Date().toISOString() },
        { id: 's2', billId: 'b1', memberId: 'm2', memberName: 'SHIVAM', amountCents: 50000, paidAt: new Date().toISOString() },
        { id: 's3', billId: 'b1', memberId: 'm3', memberName: 'Maya Sharma', amountCents: 50000, paidAt: new Date().toISOString() },
      ],
    },
    {
      id: 'b2',
      homeId: 'demo-home',
      title: 'Electricity & Utilities',
      totalCents: 320000,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      shares: [
        { id: 's4', billId: 'b2', memberId: 'm1', memberName: 'SHUBHUMA', amountCents: 106667, paidAt: new Date().toISOString() },
        { id: 's5', billId: 'b2', memberId: 'm2', memberName: 'SHIVAM', amountCents: 106667, paidAt: null },
        { id: 's6', billId: 'b2', memberId: 'm3', memberName: 'Maya Sharma', amountCents: 106666, paidAt: null },
      ],
    },
    {
      id: 'b3',
      homeId: 'demo-home',
      title: 'Apartment Monthly Rent',
      totalCents: 2100000,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      shares: [
        { id: 's7', billId: 'b3', memberId: 'm1', memberName: 'SHUBHUMA', amountCents: 700000, paidAt: new Date().toISOString() },
        { id: 's8', billId: 'b3', memberId: 'm2', memberName: 'SHIVAM', amountCents: 700000, paidAt: null },
        { id: 's9', billId: 'b3', memberId: 'm3', memberName: 'Maya Sharma', amountCents: 700000, paidAt: new Date().toISOString() },
      ],
    },
  ] : [])

  const effectiveBalances: Balance[] = balances.length > 0 ? balances : (isPreview ? [
    { memberId: 'm1', name: 'SHUBHUMA', outstandingCents: 0 },
    { memberId: 'm2', name: 'SHIVAM', outstandingCents: 806667 },
    { memberId: 'm3', name: 'Maya Sharma', outstandingCents: 106666 },
  ] : [])

  const currentHome = effectiveHomes.find((h) => h.id === effectiveHomeId)

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        billsCount={bills.length}
        membersCount={members.length}
        user={user}
        currentHomeRole={currentHomeRole || currentHome?.userRole}
        onLogout={handleLogout}
      />

      <div className="main-wrapper">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          homes={homes}
          selectedHomeId={selectedHomeId}
          user={user}
          currentHomeRole={currentHomeRole || currentHome?.userRole}
          hasMembers={members.length > 0}
          onSelectHome={handleSelectHome}
          onOpenCreateHome={() => setIsCreateHomeOpen(true)}
          onOpenCreateBill={() => setIsCreateBillOpen(true)}
          onToggleMobileMenu={() => setIsMobileNavOpen((prev) => !prev)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
        />

        {/* Page Content */}
        <main className="page-container">
          {/* Error Banner */}
          {errorBanner && (
            <div className="alert alert-error" role="alert">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconAlertCircle size={18} />
                <span>{errorBanner}</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setErrorBanner(null)}
                style={{
                  padding: '2px 8px',
                  fontSize: 12,
                  borderColor: 'var(--danger-border)',
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* If no households exist yet, show clean initial setup card */}
          {homes.length === 0 && !isDataLoading ? (
            <div
              className="card card-padding"
              style={{
                textAlign: 'center',
                padding: '56px 24px',
                maxWidth: 560,
                margin: '40px auto',
              }}
            >
              <div
                className="brand-emblem"
                style={{ width: 48, height: 48, fontSize: 20, margin: '0 auto 20px' }}
              >
                AL
              </div>
              <h2 className="page-heading" style={{ fontSize: 24, marginBottom: 8 }}>
                Welcome to AbodeLedger
              </h2>
              <p
                className="page-subheading"
                style={{ maxWidth: 440, margin: '0 auto 24px', fontSize: 14 }}
              >
                You don't have an active household yet. Create your first apartment to start adding
                roommates, tracking expenses, and splitting bills.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => setIsCreateHomeOpen(true)}
              >
                Create Your Household
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewSection
                  bills={bills}
                  members={members}
                  balances={balances}
                  user={user}
                  currentHomeName={currentHome?.name}
                  onOpenCreateBill={() => setIsCreateBillOpen(true)}
                  onOpenAddMember={() => setIsAddMemberOpen(true)}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'bills' && (
                <BillsSection
                  bills={bills}
                  members={members}
                  user={user}
                  currentHomeRole={currentHomeRole || currentHome?.userRole}
                  currentMemberId={currentMemberId || currentHome?.currentMemberId}
                  onOpenCreateBill={() => setIsCreateBillOpen(true)}
                  onOpenAuth={() => setIsAuthModalOpen(true)}
                  onPayShare={handlePayShare}
                  payingShareIds={payingShareIds}
                  hasMembers={members.length > 0}
                />
              )}

              {activeTab === 'members' && (
                <MembersSection
                  members={members}
                  balances={balances}
                  bills={bills}
                  onOpenAddMember={() => setIsAddMemberOpen(true)}
                />
              )}

              {activeTab === 'balances' && <BalancesSection balances={balances} bills={bills} />}

              {activeTab === 'settings' && (
                <SettingsSection
                  currentHome={currentHome}
                  members={members}
                  user={user}
                  currentHomeRole={currentHomeRole || currentHome?.userRole}
                  onLogout={handleLogout}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Dialog Modals */}
      <CreateHomeModal
        isOpen={isCreateHomeOpen}
        onClose={() => setIsCreateHomeOpen(false)}
        onSubmit={handleCreateHome}
      />

      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        onSubmit={handleAddMember}
      />

      <CreateBillModal
        isOpen={isCreateBillOpen}
        members={members}
        onClose={() => setIsCreateBillOpen(false)}
        onSubmit={handleCreateBill}
      />

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  )
}
