import { useEffect, useState } from 'react'
import type { Member } from '../api/client'
import { formatPaise, parseRupeesToPaise, previewSplit } from '../utils/currency'
import { IconX } from './icons'

/* ==========================================================================
   Create Home Modal
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
      setError('Home name is required')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      setName('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create home')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <button
        type="button"
        className="modal-backdrop-btn"
        aria-label="Close modal background"
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
        aria-labelledby="create-home-title"
        style={{ position: 'relative', zIndex: 1 }}
      >
        <div className="modal-header">
          <span id="create-home-title" className="modal-title">
            Create Household
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <IconX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-field">
              <label htmlFor="home-name-input" className="form-label">
                Apartment / Home Name
              </label>
              <input
                id="home-name-input"
                type="text"
                className="form-input"
                placeholder="e.g. Green Valley Flat 302"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError(null)
                }}
                disabled={isSubmitting}
              />
              {error && <div className="form-error">{error}</div>}
              <span className="form-hint">
                You can add household members and split bills after creating.
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
              {isSubmitting ? <span className="spinner" /> : 'Create Home'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ==========================================================================
   Add Member Modal
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
      setError('Member name is required')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      setName('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <button
        type="button"
        className="modal-backdrop-btn"
        aria-label="Close modal background"
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
        aria-labelledby="add-member-title"
        style={{ position: 'relative', zIndex: 1 }}
      >
        <div className="modal-header">
          <span id="add-member-title" className="modal-title">
            Add Roommate
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <IconX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-field">
              <label htmlFor="member-name-field" className="form-label">
                Roommate Name
              </label>
              <input
                id="member-name-field"
                type="text"
                className="form-input"
                placeholder="e.g. Priya Sharma"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError(null)
                }}
                disabled={isSubmitting}
              />
              {error && <div className="form-error">{error}</div>}
              <span className="form-hint">
                Roommates participate in equal bill splits in order of addition.
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
              {isSubmitting ? <span className="spinner" /> : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ==========================================================================
   Create Bill Modal with Real-time Fair Share Preview
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
      setError('Bill title is required')
      return
    }

    if (!parsedPaise || parsedPaise <= 0) {
      setError('Please enter a valid positive bill amount in rupees (e.g. 1500.00)')
      return
    }

    if (members.length === 0) {
      setError('Please add at least one household member before creating a bill')
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
      setError(err instanceof Error ? err.message : 'Failed to create bill')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <button
        type="button"
        className="modal-backdrop-btn"
        aria-label="Close modal background"
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
        aria-labelledby="create-bill-title"
        style={{ position: 'relative', zIndex: 1 }}
      >
        <div className="modal-header">
          <span id="create-bill-title" className="modal-title">
            Split Household Bill
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <IconX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-field">
              <label htmlFor="bill-title-field" className="form-label">
                Bill Title
              </label>
              <input
                id="bill-title-field"
                type="text"
                className="form-input"
                placeholder="e.g. High-Speed Internet & Electricity"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (error) setError(null)
                }}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="bill-amount-field" className="form-label">
                Total Amount (₹)
              </label>
              <input
                id="bill-amount-field"
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
                The total amount will be split fairly among all {members.length} household member
                {members.length === 1 ? '' : 's'}.
              </span>
            </div>

            {error && (
              <div className="form-error" style={{ marginBottom: 12 }}>
                {error}
              </div>
            )}

            {/* Split Preview before submission */}
            {previewShares.length > 0 && (
              <div className="split-preview-box">
                <div className="split-preview-header">Share Distribution Preview</div>
                <div className="split-preview-list">
                  {members.map((member, i) => (
                    <div key={member.id} className="split-preview-item">
                      <span>{member.name}</span>
                      <span style={{ fontWeight: 600 }}>{formatPaise(previewShares[i] ?? 0)}</span>
                    </div>
                  ))}
                </div>
                {parsedPaise && parsedPaise % members.length !== 0 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginTop: 8,
                      borderTop: '1px solid var(--border-light)',
                      paddingTop: 6,
                    }}
                  >
                    * Extra remainder paise distributed in order of member registration.
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
                <span className="spinner" />
              ) : members.length === 0 ? (
                'Add members first'
              ) : (
                'Create Bill'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
