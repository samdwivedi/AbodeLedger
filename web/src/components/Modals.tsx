import { useEffect, useState } from 'react'
import type { Member } from '../api/client'
import { formatPaise, parseRupeesToPaise, previewSplit } from '../utils/currency'
import { IconScale, IconX } from './icons'

/* ==========================================================================
   Create Household Modal
   ========================================================================== */
interface CreateHomeModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}

export function CreateHomeModal({ isOpen, onClose, onSubmit }: CreateHomeModalProps) {
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Household name is required.')
      return
    }

    // Letters, numbers, and spaces only
    if (!/^[a-zA-Z0-9\s]+$/.test(trimmed)) {
      setError(
        'Household name cannot contain special characters (letters, numbers, and spaces only).',
      )
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      setName('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create household.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <button
        type="button"
        className="modal-backdrop-btn"
        aria-label="Close modal backdrop"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'default',
        }}
      />
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-home-modal-title"
      >
        <div className="modal-header">
          <span id="create-home-modal-title" className="modal-title">
            Create Household
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: 6 }}
          >
            <IconX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-field">
              <label htmlFor="home-name-modal-input" className="form-label">
                Apartment / Home Name
              </label>
              <input
                id="home-name-modal-input"
                type="text"
                className="form-input"
                placeholder="e.g. Palm Grove Residency 402"
                value={name}
                onChange={(e) => {
                  const val = e.target.value
                  if (/^[a-zA-Z0-9\s]*$/.test(val)) {
                    setName(val)
                    if (error) setError(null)
                  }
                }}
                disabled={isSubmitting}
              />
              {error && <div className="form-error">{error}</div>}
              <span className="form-hint">
                Letters, numbers, and spaces only. You can add roommates and split expenses once
                created.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner" />
                  <span>Creating...</span>
                </>
              ) : (
                'Create Household'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ==========================================================================
   Add Roommate Modal
   ========================================================================== */
interface AddMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}

export function AddMemberModal({ isOpen, onClose, onSubmit }: AddMemberModalProps) {
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Roommate name is required.')
      return
    }

    // Letters and spaces only
    if (!/^[a-zA-Z\s]+$/.test(trimmed)) {
      setError(
        'Roommate name can only contain letters and spaces (no numbers or special characters).',
      )
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      setName('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add roommate.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <button
        type="button"
        className="modal-backdrop-btn"
        aria-label="Close modal backdrop"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'default',
        }}
      />
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-modal-title"
      >
        <div className="modal-header">
          <span id="add-member-modal-title" className="modal-title">
            Add Roommate
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: 6 }}
          >
            <IconX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-field">
              <label htmlFor="member-name-modal-input" className="form-label">
                Roommate Full Name
              </label>
              <input
                id="member-name-modal-input"
                type="text"
                className="form-input"
                placeholder="e.g. Ananya Patel"
                value={name}
                onChange={(e) => {
                  const val = e.target.value
                  if (/^[a-zA-Z\s]*$/.test(val)) {
                    setName(val)
                    if (error) setError(null)
                  }
                }}
                disabled={isSubmitting}
              />
              {error && <div className="form-error">{error}</div>}
              <span className="form-hint">
                Roommates participate in bill splits. The order of addition determines FIFO
                remainder cent allocation.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner" />
                  <span>Adding...</span>
                </>
              ) : (
                'Add Roommate'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ==========================================================================
   Split Household Bill Modal with Real-time Fair Split Preview
   ========================================================================== */
interface CreateBillModalProps {
  isOpen: boolean
  members: Member[]
  onClose: () => void
  onSubmit: (title: string, totalPaise: number) => Promise<void>
}

export function CreateBillModal({ isOpen, members, onClose, onSubmit }: CreateBillModalProps) {
  const [title, setTitle] = useState('')
  const [amountRupees, setAmountRupees] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const parsedPaise = parseRupeesToPaise(amountRupees)
  const previewShares =
    parsedPaise && members.length > 0 ? previewSplit(parsedPaise, members.length) : []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Bill title is required.')
      return
    }

    // Letters and spaces only
    if (!/^[a-zA-Z\s]+$/.test(trimmedTitle)) {
      setError('Bill title can only contain letters and spaces (no numbers or special characters).')
      return
    }

    if (!parsedPaise || parsedPaise <= 0) {
      setError('Please enter a valid positive bill amount in rupees (e.g. 1500.00).')
      return
    }

    if (members.length === 0) {
      setError('Please add at least one household member before creating a bill.')
      return
    }

    // Verify shares add up exactly to the total bill amount
    const sumShares = previewShares.reduce((a, b) => a + b, 0)
    if (sumShares !== parsedPaise) {
      setError('Internal precision mismatch: shares do not sum to total bill amount.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit(trimmedTitle, parsedPaise)
      setTitle('')
      setAmountRupees('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to split bill.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <button
        type="button"
        className="modal-backdrop-btn"
        aria-label="Close modal backdrop"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'default',
        }}
      />
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-bill-modal-title"
      >
        <div className="modal-header">
          <span id="create-bill-modal-title" className="modal-title">
            Split Household Expense
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: 6 }}
          >
            <IconX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Bill Description */}
            <div className="form-field">
              <label htmlFor="bill-title-modal-input" className="form-label">
                Expense Title
              </label>
              <input
                id="bill-title-modal-input"
                type="text"
                className="form-input"
                placeholder="e.g. Fiber Internet, Electricity, Apartment Rent"
                value={title}
                onChange={(e) => {
                  const val = e.target.value
                  if (/^[a-zA-Z\s]*$/.test(val)) {
                    setTitle(val)
                    if (error) setError(null)
                  }
                }}
                disabled={isSubmitting}
              />
              <span className="form-hint">Letters and spaces only.</span>
            </div>

            {/* Bill Amount */}
            <div className="form-field">
              <label htmlFor="bill-amount-modal-input" className="form-label">
                Total Bill Amount (₹)
              </label>
              <input
                id="bill-amount-modal-input"
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                placeholder="1500.00"
                value={amountRupees}
                onChange={(e) => {
                  setAmountRupees(e.target.value)
                  if (error) setError(null)
                }}
                disabled={isSubmitting}
              />
              <span className="form-hint">
                Will be divided equally across all {members.length} registered roommate
                {members.length === 1 ? '' : 's'}.
              </span>
            </div>

            {error && (
              <div className="form-error" style={{ marginBottom: 12 }}>
                {error}
              </div>
            )}

            {/* Real-time Fair Split Preview */}
            {previewShares.length > 0 && (
              <div className="split-preview-box">
                <div className="split-preview-header">
                  Fair Share Distribution ({members.length} Roommates)
                </div>
                <div className="split-preview-list">
                  {members.map((member, i) => (
                    <div key={member.id} className="split-preview-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          className="user-avatar"
                          style={{
                            width: 22,
                            height: 22,
                            fontSize: 10,
                            background: 'var(--surface)',
                            color: 'var(--primary-forest)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {member.name ? member.name.charAt(0).toUpperCase() : 'M'}
                        </div>
                        <span>{member.name}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--primary-forest)' }}>
                        {formatPaise(previewShares[i] ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>

                {parsedPaise && parsedPaise % members.length !== 0 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      marginTop: 8,
                      borderTop: '1px solid var(--border)',
                      paddingTop: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <IconScale size={13} color="var(--secondary-green)" />
                    <span>
                      1-paise remainder units awarded to earlier-registered roommates in FIFO order.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || members.length === 0}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" />
                  <span>Splitting...</span>
                </>
              ) : members.length === 0 ? (
                'Add roommates first'
              ) : (
                'Split Bill'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
