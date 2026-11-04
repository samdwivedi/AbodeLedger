import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api, type Balance, type Bill, type Home, type Member } from '../api/client'
import { AuthModal } from '../components/AuthModal'
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

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<NavTab>('overview')
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  // Data states
  const [homes, setHomes] = useState<Home[]>([])
  const [selectedHomeId, setSelectedHomeId] = useState<string>('')
  const [members, setMembers] = useState<Member[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [balances, setBalances] = useState<Balance[]>([])

  // Loading & Error states
  const [isLoading, setIsLoading] = useState(true)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  // Modals
  const [isCreateHomeOpen, setIsCreateHomeOpen] = useState(false)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isCreateBillOpen, setIsCreateBillOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  // Payment in-flight and idempotency tracking
  const [payingShareIds, setPayingShareIds] = useState<Set<string>>(new Set())
  // Persistent map of shareId -> idempotencyKey to retain identical key across retries/network failures
  const idempotencyKeysRef = useRef<Map<string, string>>(new Map())

  // Load homes list
  const loadHomes = useCallback(async () => {
    try {
      const homeList = await api.getHomes()
      setHomes(homeList)
      if (homeList.length > 0 && !selectedHomeId) {
        setSelectedHomeId(homeList[0]?.id ?? '')
      } else if (homeList.length === 0) {
        setSelectedHomeId('')
        setMembers([])
        setBills([])
        setBalances([])
      }
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Unable to connect to the AbodeLedger API.',
      )
    }
  }, [selectedHomeId])

  // Load active home details (members, bills, balances)
  const loadHomeDetails = useCallback(async (homeId: string) => {
    if (!homeId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
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
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Error loading apartment details')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHomes()
  }, [loadHomes])

  useEffect(() => {
    if (selectedHomeId) {
      loadHomeDetails(selectedHomeId)
    }
  }, [selectedHomeId, loadHomeDetails])

  // Handlers for Modals
  const handleCreateHome = async (name: string) => {
    const newHome = await api.createHome(name)
    await loadHomes()
    setSelectedHomeId(newHome.id)
    setErrorBanner(null)
  }

  const handleAddMember = async (name: string) => {
    if (!selectedHomeId) return
    await api.addMember(selectedHomeId, name)
    await loadHomeDetails(selectedHomeId)
    setErrorBanner(null)
  }

  const handleCreateBill = async (title: string, totalPaise: number) => {
    if (!selectedHomeId) return
    await api.createBill(selectedHomeId, title, totalPaise)
    await loadHomeDetails(selectedHomeId)
    setErrorBanner(null)
  }

  // Payment Handler with robust Idempotency retention & 409 handling
  const handlePayShare = async (billId: string, shareId: string) => {
    setErrorBanner(null)
    setPayingShareIds((prev) => new Set(prev).add(shareId))

    // Requirement: Retain the same key across retries and network errors
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
            shares: b.shares.map((s) => (s.id === shareId ? paidShare : s)),
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
    setSelectedHomeId('')
    await loadHomes()
  }

  const currentHome = homes.find((h) => h.id === selectedHomeId)

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      <div className="main-wrapper">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          homes={homes}
          selectedHomeId={selectedHomeId}
          user={user}
          onSelectHome={setSelectedHomeId}
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
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
                  borderColor: 'var(--error-border)',
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* If no homes exist yet, show clean get-started card */}
          {homes.length === 0 && !isLoading ? (
            <div
              className="card card-padding"
              style={{ textAlign: 'center', padding: '48px 24px' }}
            >
              <h2 className="page-heading" style={{ fontSize: 22 }}>
                Welcome to AbodeLedger
              </h2>
              <p className="page-subheading" style={{ maxWidth: 440, margin: '8px auto 20px' }}>
                A minimal, transparent shared bill-splitting dashboard for housemates. Create your
                apartment to begin.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsCreateHomeOpen(true)}
              >
                Create Your Apartment
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewSection
                  bills={bills}
                  members={members}
                  balances={balances}
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
                  currentHomeRole={currentHome?.userRole}
                  currentMemberId={currentHome?.currentMemberId}
                  onOpenCreateBill={() => setIsCreateBillOpen(true)}
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

              {activeTab === 'settings' && <SettingsSection currentHome={currentHome} />}
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
