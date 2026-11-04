/**
 * WebCrypto Cryptographic Primitives for Cloudflare Workers
 *
 * Implements OWASP-recommended PBKDF2-HMAC-SHA256 password hashing (600,000 iterations),
 * constant-time verification, CSPRNG session token generation, and SHA-256 token hashing.
 */

const PBKDF2_ITERATIONS = 600000
const SALT_BYTES = 16
const KEY_BYTES = 32

/**
 * Normalizes email address by trimming, lowercasing, and applying Unicode NFKC normalization.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().normalize('NFKC')
}

/**
 * Validates email structure.
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false
  const trimmed = email.trim()
  if (trimmed.length < 5 || trimmed.length > 254) return false
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  return emailRegex.test(trimmed)
}

/**
 * Validates password strength & security constraints.
 * Bounds: 10 - 128 characters (upper bound prevents hash algorithmic complexity DoS).
 */
export function validatePassword(password: unknown): { valid: boolean; error?: string } {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Password is required' }
  }
  if (password.length < 10) {
    return { valid: false, error: 'Password must be at least 10 characters long' }
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password must be 128 characters or fewer' }
  }
  return { valid: true }
}

/**
 * Generates a cryptographically secure random token (256-bit entropy).
 * Formatted as URL-safe and cookie-safe Base64URL without padding.
 */
export function generateToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}

/**
 * Hashes a token using SHA-256 for secure database storage.
 * Raw session and invitation tokens are NEVER stored in plaintext.
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(digest).toString('hex')
}

/**
 * Hashes a plaintext password using native WebCrypto PBKDF2-HMAC-SHA256.
 * Format: $pbkdf2-sha256$i=600000$<salt_b64>$<hash_b64>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_BYTES)
  crypto.getRandomValues(salt)

  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  )

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    KEY_BYTES * 8,
  )

  const saltB64 = Buffer.from(salt).toString('base64')
  const hashB64 = Buffer.from(derivedBits).toString('base64')

  return `$pbkdf2-sha256$i=${PBKDF2_ITERATIONS}$${saltB64}$${hashB64}`
}

/**
 * Verifies a plaintext password against a stored modular crypt format hash.
 * Employs timingSafeEqual to prevent side-channel timing attacks.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$')
    // Expected parts: ["", "pbkdf2-sha256", "i=600000", "<salt>", "<hash>"]
    if (parts.length !== 5 || parts[1] !== 'pbkdf2-sha256') {
      return false
    }

    const iterationsPart = parts[2]
    if (!iterationsPart?.startsWith('i=')) {
      return false
    }
    const iterations = Number.parseInt(iterationsPart.slice(2), 10)
    if (Number.isNaN(iterations) || iterations <= 0) {
      return false
    }

    const saltB64 = parts[3]
    const expectedHashB64 = parts[4]
    if (!saltB64 || !expectedHashB64) {
      return false
    }

    const salt = Buffer.from(saltB64, 'base64')
    const expectedHash = Buffer.from(expectedHashB64, 'base64')

    const encoder = new TextEncoder()
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits'],
    )

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      passwordKey,
      expectedHash.length * 8,
    )

    const derivedBuffer = Buffer.from(derivedBits)

    if (derivedBuffer.length !== expectedHash.length) {
      return false
    }

    // Constant-time byte-by-byte comparison
    let mismatch = 0
    for (let i = 0; i < derivedBuffer.length; i++) {
      mismatch |= (derivedBuffer[i] ?? 0) ^ (expectedHash[i] ?? 0)
    }

    return mismatch === 0
  } catch {
    return false
  }
}
