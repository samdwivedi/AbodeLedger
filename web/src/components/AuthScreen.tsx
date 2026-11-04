import { useState } from 'react'
import { ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  IconAlertCircle,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconLock,
  IconScale,
  IconShield,
  IconSparkles,
} from './icons'

interface AuthScreenProps {
  onSuccess?: () => void
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    const trimmedName = name.trim()

    // 1. Email validation
    if (!trimmedEmail) {
      setError('Please enter your email address.')
      return
    }

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailPattern.test(trimmedEmail)) {
      setError('Please enter a valid email address (e.g. name@domain.com).')
      return
    }

    // 2. Registration Name validation
    if (mode === 'register') {
      if (!trimmedName) {
        setError('Please enter your full name.')
        return
      }
      if (!/^[a-zA-Z\s'-]{2,50}$/.test(trimmedName)) {
        setError('Name can only contain letters and spaces (no numbers or special symbols).')
        return
      }
    }

    // 3. Password validation
    if (!password) {
      setError('Please enter your password.')
      return
    }

    if (mode === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'login') {
        await login(trimmedEmail, password)
      } else {
        await register(trimmedEmail, password, trimmedName)
      }
      onSuccess?.()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected authentication error occurred.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page-wrapper">
      {/* Brand Column (Left) */}
      <div className="auth-brand-side">
        <div>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#FFFFFF',
                color: 'var(--primary-forest)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 16,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              }}
            >
              AL
            </div>
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: '#FFFFFF',
                }}
              >
                AbodeLedger
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'rgba(255, 255, 255, 0.65)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Fintech Household Splitter
              </div>
            </div>
          </div>

          <div style={{ maxWidth: 440 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 9999,
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontSize: 12,
                fontWeight: 500,
                color: '#E0F2E9',
                marginBottom: 20,
              }}
            >
              <IconSparkles size={14} />
              <span>Production Shared Ledger</span>
            </div>

            <h1
              style={{
                fontSize: 34,
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: '-0.03em',
                marginBottom: 16,
              }}
            >
              Transparent bill splitting for modern roommates.
            </h1>

            <p
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: 'rgba(255, 255, 255, 0.75)',
                marginBottom: 36,
              }}
            >
              Split rent, groceries, and utilities with exact integer-cent math. Eliminate floating
              drift and double charges with idempotent payments.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'rgba(53, 166, 107, 0.25)',
                    color: '#7DE3AB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconCheck size={14} />
                </div>
                <span style={{ fontSize: 13.5, color: '#F1F8F4' }}>
                  <strong>Deterministic 1-Paise Conservation:</strong> Zero cents lost or gained
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'rgba(53, 166, 107, 0.25)',
                    color: '#7DE3AB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconShield size={14} />
                </div>
                <span style={{ fontSize: 13.5, color: '#F1F8F4' }}>
                  <strong>Household RBAC & Share Isolation:</strong> Members settle their own shares
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'rgba(53, 166, 107, 0.25)',
                    color: '#7DE3AB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconScale size={14} />
                </div>
                <span style={{ fontSize: 13.5, color: '#F1F8F4' }}>
                  <strong>Idempotent Payments:</strong> Prevents duplicate debits on poor networks
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Trust Marker */}
        <div
          style={{
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.5)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            paddingTop: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <IconLock size={14} />
          <span>Secured with native WebCrypto PBKDF2 & HttpOnly session cookies.</span>
        </div>
      </div>

      {/* Card Column (Right) */}
      <div className="auth-card-side">
        <div className="auth-form-card">
          <div style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--primary-forest)',
                marginBottom: 6,
              }}
            >
              {mode === 'login' ? 'Sign in to AbodeLedger' : 'Create your account'}
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              {mode === 'login'
                ? 'Enter your email and password to access your household ledger.'
                : 'Get started in seconds. Track and split apartment bills seamlessly.'}
            </p>
          </div>

          {/* Mode Switch Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'var(--surface-subtle)',
              padding: 4,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              marginBottom: 24,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError(null)
              }}
              style={{
                flex: 1,
                padding: '7px 12px',
                fontSize: 13,
                fontWeight: mode === 'login' ? 600 : 500,
                color: mode === 'login' ? 'var(--primary-forest)' : 'var(--text-secondary)',
                background: mode === 'login' ? 'var(--surface)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                boxShadow: mode === 'login' ? 'var(--shadow-xs)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register')
                setError(null)
              }}
              style={{
                flex: 1,
                padding: '7px 12px',
                fontSize: 13,
                fontWeight: mode === 'register' ? 600 : 500,
                color: mode === 'register' ? 'var(--primary-forest)' : 'var(--text-secondary)',
                background: mode === 'register' ? 'var(--surface)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                boxShadow: mode === 'register' ? 'var(--shadow-xs)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Create Account
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="alert alert-error" role="alert" style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconAlertCircle size={16} />
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Full Name Field (Register Mode Only) */}
            {mode === 'register' && (
              <div className="form-field">
                <label htmlFor="auth-name-input" className="form-label">
                  Full Name
                </label>
                <input
                  id="auth-name-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Samarth Dwivedi"
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value
                    // Restrict input: letters, spaces, hyphens, and apostrophes only
                    if (/^[a-zA-Z\s'-]*$/.test(val)) {
                      setName(val)
                      if (error) setError(null)
                    }
                  }}
                  disabled={isSubmitting}
                  autoComplete="name"
                  required
                />
                <span className="form-hint">Letters and spaces only (no numbers or symbols).</span>
              </div>
            )}

            {/* Email Field */}
            <div className="form-field">
              <label htmlFor="auth-email-input" className="form-label">
                Email Address
              </label>
              <input
                id="auth-email-input"
                type="email"
                className="form-input"
                placeholder="roommate@example.com"
                value={email}
                onChange={(e) => {
                  const val = e.target.value
                  // Restrict input: standard email characters only
                  if (/^[a-zA-Z0-9.@_+-]*$/.test(val)) {
                    setEmail(val)
                    if (error) setError(null)
                  }
                }}
                disabled={isSubmitting}
                autoComplete="email"
                required
              />
            </div>

            {/* Password Field */}
            <div className="form-field">
              <label htmlFor="auth-password-input" className="form-label">
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="auth-password-input"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError(null)
                  }}
                  disabled={isSubmitting}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  style={{ paddingRight: 40 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                  }}
                >
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
              {mode === 'register' && (
                <span className="form-hint">Must be at least 8 characters long.</span>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 8 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" />
                  <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : mode === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Alternate Mode Prompt */}
          <div
            style={{
              textAlign: 'center',
              marginTop: 24,
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}
          >
            {mode === 'login' ? (
              <>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setError(null)
                  }}
                  style={{
                    color: 'var(--primary-forest)',
                    fontWeight: 600,
                    textDecoration: 'underline',
                  }}
                >
                  Create one now
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError(null)
                  }}
                  style={{
                    color: 'var(--primary-forest)',
                    fontWeight: 600,
                    textDecoration: 'underline',
                  }}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
