import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { IconX } from './icons'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'register'
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setMode(initialMode)
    setError(null)
  }, [initialMode])

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
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Email and password are required')
      return
    }

    // Email format validation
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmedEmail)) {
      setError('Please enter a valid email address')
      return
    }

    if (mode === 'register') {
      const trimmedName = name.trim()
      if (!trimmedName) {
        setError('Name is required')
        return
      }

      // Name constraint: No numeric or special characters allowed
      if (!/^[a-zA-Z\s]+$/.test(trimmedName)) {
        setError('Name can only contain letters and spaces (no numbers or special characters)')
        return
      }

      if (password.length < 10) {
        setError('Password must be at least 10 characters long')
        return
      }
    }

    setIsSubmitting(true)
    try {
      if (mode === 'login') {
        await login(trimmedEmail, password)
      } else {
        await register(trimmedEmail, password, name.trim())
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
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
        aria-labelledby="auth-modal-title"
        style={{ position: 'relative', zIndex: 1, maxWidth: 400 }}
      >
        <div className="modal-header">
          <span id="auth-modal-title" className="modal-title">
            {mode === 'login' ? 'Sign In to AbodeLedger' : 'Create an Account'}
          </span>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div className="alert alert-error" style={{ padding: '8px 12px', fontSize: 13 }}>
                {error}
              </div>
            )}

            {mode === 'register' && (
              <div className="form-field">
                <label htmlFor="auth-name" className="form-label">
                  Your Full Name{' '}
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    (letters only)
                  </span>
                </label>
                <input
                  id="auth-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Maya Sharma"
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value
                    // Restrict input: letters and spaces only
                    if (/^[a-zA-Z\s]*$/.test(val)) {
                      setName(val)
                      if (error) setError(null)
                    }
                  }}
                  disabled={isSubmitting}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="form-field">
              <label htmlFor="auth-email" className="form-label">
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                className="form-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  const val = e.target.value
                  // Restrict input: valid email characters only
                  if (/^[a-zA-Z0-9@._+-]*$/.test(val)) {
                    setEmail(val)
                    if (error) setError(null)
                  }
                }}
                disabled={isSubmitting}
                autoComplete="email"
              />
            </div>

            <div className="form-field">
              <label htmlFor="auth-password" className="form-label">
                Password{' '}
                {mode === 'register' && (
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    (min 10 characters)
                  </span>
                )}
              </label>
              <input
                id="auth-password"
                type="password"
                className="form-input"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            <div style={{ fontSize: 13, textAlign: 'center', marginTop: 4 }}>
              {mode === 'login' ? (
                <span>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register')
                      setError(null)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    Register
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setError(null)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    Sign In
                  </button>
                </span>
              )}
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
              {isSubmitting ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
