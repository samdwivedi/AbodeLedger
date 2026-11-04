import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  generateToken,
  hashPassword,
  hashToken,
  isValidEmail,
  normalizeEmail,
  validatePassword,
  verifyPassword,
} from './auth/crypto'
import {
  type AuthEnv,
  authMiddleware,
  clearSessionCookie,
  requireHomeRole,
  setSessionCookie,
} from './auth/middleware'
import { splitTotal } from './split'

interface CreateHomeBody {
  name?: unknown
}

interface CreateMemberBody {
  name?: unknown
}

interface CreateBillBody {
  title?: unknown
  totalCents?: unknown
}

interface RegisterBody {
  email?: unknown
  password?: unknown
  name?: unknown
}

interface LoginBody {
  email?: unknown
  password?: unknown
}

interface CreateInvitationBody {
  email?: unknown
  role?: unknown
}

const app = new Hono<AuthEnv>()

// Global error handlers ensuring JSON response format
app.onError((err, c) => {
  return c.json({ error: err.message || 'Internal Server Error' }, 500)
})

app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

// Enable Cross-Origin Resource Sharing with credentials support for frontend
app.use(
  '/api/*',
  cors({
    origin: (origin) => origin || '*',
    credentials: true,
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Requested-With',
      'X-Enforce-Auth',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
)

// Public Health Check
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// ============================================================
// AUTHENTICATION ROUTES
// ============================================================

// POST /api/auth/register
app.post('/api/auth/register', async (c) => {
  let body: RegisterBody
  try {
    body = await c.req.json<RegisterBody>()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { email, password, name } = body ?? {}

  // Validate Name
  if (typeof name !== 'string' || name.trim() === '') {
    return c.json({ error: 'Name is required' }, 400)
  }
  const trimmedName = name.trim()
  if (trimmedName.length > 100) {
    return c.json({ error: 'Name must be 100 characters or fewer' }, 400)
  }
  if (!/^[a-zA-Z\s]+$/.test(trimmedName)) {
    return c.json({ error: 'Name can only contain letters and spaces' }, 400)
  }

  // Validate Email
  if (typeof email !== 'string' || !isValidEmail(email)) {
    return c.json({ error: 'Valid email is required' }, 400)
  }
  const normalizedEmail = normalizeEmail(email)

  // Validate Password (length 10 - 128, DoS protection)
  const passwordCheck = validatePassword(password)
  if (!passwordCheck.valid || typeof password !== 'string') {
    return c.json({ error: passwordCheck.error || 'Invalid password' }, 400)
  }

  // Check for duplicate account
  const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(normalizedEmail)
    .first<{ id: string }>()

  if (existingUser) {
    return c.json({ error: 'An account with this email already exists' }, 409)
  }

  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword(password)

  // Insert new user
  try {
    await c.env.DB.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
      .bind(userId, normalizedEmail, passwordHash, trimmedName)
      .run()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('UNIQUE') && msg.includes('email')) {
      return c.json({ error: 'An account with this email already exists' }, 409)
    }
    throw err
  }

  // Generate session token (256-bit CSPRNG) & hash for server storage
  const rawToken = generateToken()
  const tokenHash = await hashToken(rawToken)
  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(sessionId, userId, tokenHash, expiresAt)
    .run()

  // Set secure cookie on response
  setSessionCookie(c, rawToken)

  return c.json(
    {
      user: {
        id: userId,
        email: normalizedEmail,
        name: trimmedName,
      },
    },
    201,
  )
})

// POST /api/auth/login
app.post('/api/auth/login', async (c) => {
  let body: LoginBody
  try {
    body = await c.req.json<LoginBody>()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { email, password } = body ?? {}

  if (typeof email !== 'string' || typeof password !== 'string') {
    return c.json({ error: 'Email and password are required' }, 400)
  }

  const normalizedEmail = normalizeEmail(email)

  // Lookup user by normalized email
  const user = await c.env.DB.prepare(
    'SELECT id, email, password_hash, name FROM users WHERE email = ?',
  )
    .bind(normalizedEmail)
    .first<{ id: string; email: string; password_hash: string; name: string }>()

  if (!user) {
    // Constant-time dummy verification to thwart timing attacks
    await verifyPassword(password, '$pbkdf2-sha256$i=600000$dummySaltB64$dummyHashB64')
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const isPasswordValid = await verifyPassword(password, user.password_hash)
  if (!isPasswordValid) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  // Generate new session token (protects against session fixation)
  const rawToken = generateToken()
  const tokenHash = await hashToken(rawToken)
  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(sessionId, user.id, tokenHash, expiresAt)
    .run()

  setSessionCookie(c, rawToken)

  return c.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    },
    200,
  )
})

// POST /api/auth/logout
app.post('/api/auth/logout', authMiddleware, async (c) => {
  const session = c.get('session')
  if (session?.id) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(session.id).run()
  }

  clearSessionCookie(c)
  return c.json({ message: 'Logged out successfully' }, 200)
})

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, async (c) => {
  const user = c.get('user')
  return c.json({ user }, 200)
})

// ============================================================
// HOUSEHOLD INVITATION ROUTES
// ============================================================

// POST /api/homes/:homeId/invitations
app.post(
  '/api/homes/:homeId/invitations',
  authMiddleware,
  requireHomeRole('owner', 'admin'),
  async (c) => {
    const homeId = c.req.param('homeId')
    const inviter = c.get('user')

    let body: CreateInvitationBody
    try {
      body = await c.req.json<CreateInvitationBody>()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    const { email, role } = body ?? {}

    if (typeof email !== 'string' || !isValidEmail(email)) {
      return c.json({ error: 'Valid email is required' }, 400)
    }
    const normalizedEmail = normalizeEmail(email)

    if (role !== 'admin' && role !== 'member') {
      return c.json({ error: 'Role must be either admin or member' }, 400)
    }

    // Check if invitee is already a member
    const existingMembership = await c.env.DB.prepare(
      `SELECT hm.id FROM home_memberships hm
       JOIN users u ON u.id = hm.user_id
       WHERE hm.home_id = ? AND u.email = ?`,
    )
      .bind(homeId, normalizedEmail)
      .first<{ id: string }>()

    if (existingMembership) {
      return c.json({ error: 'User is already a member of this household' }, 409)
    }

    const inviteId = crypto.randomUUID()
    const rawToken = generateToken()
    const tokenHash = await hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() // 72 hours

    await c.env.DB.prepare(
      `INSERT INTO home_invitations (id, home_id, inviter_user_id, email, role, token_hash, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(inviteId, homeId, inviter.id, normalizedEmail, role, tokenHash, expiresAt)
      .run()

    return c.json(
      {
        id: inviteId,
        homeId,
        email: normalizedEmail,
        role,
        token: rawToken,
        expiresAt,
      },
      201,
    )
  },
)

// POST /api/invitations/:token/accept
app.post('/api/invitations/:token/accept', authMiddleware, async (c) => {
  const token = c.req.param('token')
  const user = c.get('user')

  const tokenHash = await hashToken(token)

  const invitation = await c.env.DB.prepare(
    `SELECT id, home_id, email, role, expires_at, accepted_at
     FROM home_invitations
     WHERE token_hash = ?`,
  )
    .bind(tokenHash)
    .first<{
      id: string
      home_id: string
      email: string
      role: 'admin' | 'member'
      expires_at: string
      accepted_at: string | null
    }>()

  if (!invitation || invitation.accepted_at !== null) {
    return c.json({ error: 'Invitation not found or already accepted' }, 404)
  }

  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return c.json({ error: 'Invitation has expired' }, 400)
  }

  // Ensure user is not already a member of this home
  const existingMembership = await c.env.DB.prepare(
    'SELECT id FROM home_memberships WHERE home_id = ? AND user_id = ?',
  )
    .bind(invitation.home_id, user.id)
    .first<{ id: string }>()

  if (existingMembership) {
    return c.json({ error: 'You are already a member of this household' }, 409)
  }

  const membershipId = crypto.randomUUID()

  // Atomically record membership and mark invitation as accepted
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO home_memberships (id, home_id, user_id, role) VALUES (?, ?, ?, ?)',
    ).bind(membershipId, invitation.home_id, user.id, invitation.role),
    c.env.DB.prepare("UPDATE home_invitations SET accepted_at = datetime('now') WHERE id = ?").bind(
      invitation.id,
    ),
  ])

  return c.json(
    {
      success: true,
      homeId: invitation.home_id,
      role: invitation.role,
    },
    200,
  )
})

// ============================================================
// CORE HOMES, BILLS & EXPENSES ROUTES (GUARDED BY AUTH)
// ============================================================

// POST /api/homes
app.post('/api/homes', authMiddleware, async (c) => {
  const user = c.get('user')

  let body: CreateHomeBody
  try {
    body = await c.req.json<CreateHomeBody>()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (typeof body?.name !== 'string' || body.name.trim() === '') {
    return c.json({ error: 'Name is required' }, 400)
  }

  const name = body.name.trim()
  if (name.length > 100) {
    return c.json({ error: 'Name must be 100 characters or fewer' }, 400)
  }
  if (!/^[a-zA-Z0-9\s]+$/.test(name)) {
    return c.json({ error: 'Home name cannot contain special characters' }, 400)
  }

  const homeId = crypto.randomUUID()
  const membershipId = crypto.randomUUID()

  // Atomically create home and assign creator as 'owner'
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(homeId, name),
    c.env.DB.prepare(
      "INSERT INTO home_memberships (id, home_id, user_id, role) VALUES (?, ?, ?, 'owner')",
    ).bind(membershipId, homeId, user.id),
  ])

  return c.json({ id: homeId, name }, 201)
})

// POST /api/homes/:homeId/members (Restricted to owner or admin)
app.post(
  '/api/homes/:homeId/members',
  authMiddleware,
  requireHomeRole('owner', 'admin'),
  async (c) => {
    const homeId = c.req.param('homeId')

    let body: CreateMemberBody
    try {
      body = await c.req.json<CreateMemberBody>()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    if (typeof body?.name !== 'string' || body.name.trim() === '') {
      return c.json({ error: 'Name is required' }, 400)
    }

    const name = body.name.trim()
    if (name.length > 100) {
      return c.json({ error: 'Name must be 100 characters or fewer' }, 400)
    }

    // Verify home exists
    const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?')
      .bind(homeId)
      .first<{ id: string }>()

    if (!home) {
      return c.json({ error: 'Home not found' }, 404)
    }

    const memberId = crypto.randomUUID()

    // Atomically assign next position with retry resilience against concurrent position collisions
    let inserted = false
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await c.env.DB.prepare(
          `INSERT INTO members (id, home_id, name, position)
           VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM members WHERE home_id = ?))`,
        )
          .bind(memberId, homeId, name, homeId)
          .run()
        inserted = true
        break
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('UNIQUE') && msg.includes('position')) {
          continue
        }
        throw err
      }
    }

    if (!inserted) {
      return c.json({ error: 'Could not allocate member position due to high concurrency' }, 409)
    }

    // Auto-link membership.member_id if current user matches the newly added member
    const user = c.get('user')
    const membership = c.get('membership')
    if (
      membership &&
      !membership.memberId &&
      name.trim().toLowerCase() === user.name.trim().toLowerCase()
    ) {
      await c.env.DB.prepare(
        'UPDATE home_memberships SET member_id = ? WHERE home_id = ? AND user_id = ?',
      )
        .bind(memberId, homeId, user.id)
        .run()
    }

    return c.json({ id: memberId, homeId, name }, 201)
  },
)

// POST /api/homes/:homeId/bills
app.post(
  '/api/homes/:homeId/bills',
  authMiddleware,
  requireHomeRole('owner', 'admin', 'member'),
  async (c) => {
    const homeId = c.req.param('homeId')

    let body: CreateBillBody
    try {
      body = await c.req.json<CreateBillBody>()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    const { title, totalCents } = body ?? {}

    // Validate title
    if (typeof title !== 'string' || title.trim() === '') {
      return c.json({ error: 'Title is required' }, 400)
    }

    const trimmedTitle = title.trim()
    if (trimmedTitle.length > 200) {
      return c.json({ error: 'Title must be 200 characters or fewer' }, 400)
    }

    // Validate totalCents: must be a positive whole number within safe integer boundaries
    if (
      typeof totalCents !== 'number' ||
      !Number.isInteger(totalCents) ||
      totalCents <= 0 ||
      totalCents > Number.MAX_SAFE_INTEGER
    ) {
      return c.json({ error: 'totalCents must be a positive whole number' }, 422)
    }

    // Verify home exists
    const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?')
      .bind(homeId)
      .first<{ id: string }>()

    if (!home) {
      return c.json({ error: 'Home not found' }, 404)
    }

    // Fetch members in deterministic insertion order
    const { results: members } = await c.env.DB.prepare(
      'SELECT id FROM members WHERE home_id = ? ORDER BY position ASC',
    )
      .bind(homeId)
      .all<{ id: string }>()

    if (members.length === 0) {
      return c.json({ error: 'Home has no members' }, 422)
    }

    // Split the total among members
    const amounts = splitTotal(totalCents, members.length)

    const billId = crypto.randomUUID()

    // Build atomic batch: insert bill + all shares in one transaction
    const statements = [
      c.env.DB.prepare(
        'INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)',
      ).bind(billId, homeId, trimmedTitle, totalCents),
    ]

    const shares: { id: string; memberId: string; amountCents: number; paidAt: null }[] = []

    for (let i = 0; i < members.length; i++) {
      const shareId = crypto.randomUUID()
      const member = members[i]
      const amountCents = amounts[i]

      if (!member || amountCents === undefined) {
        return c.json({ error: 'Internal error during share creation' }, 500)
      }

      statements.push(
        c.env.DB.prepare(
          'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)',
        ).bind(shareId, billId, member.id, amountCents),
      )

      shares.push({ id: shareId, memberId: member.id, amountCents, paidAt: null })
    }

    // Execute all statements atomically via D1 batch
    await c.env.DB.batch(statements)

    return c.json(
      {
        id: billId,
        homeId,
        title: trimmedTitle,
        totalCents,
        shares,
      },
      201,
    )
  },
)

// POST /api/bills/:billId/shares/:shareId/pay
app.post(
  '/api/bills/:billId/shares/:shareId/pay',
  authMiddleware,
  requireHomeRole('owner', 'admin', 'member'),
  async (c) => {
    const billId = c.req.param('billId')
    const shareId = c.req.param('shareId')
    const idempotencyKey = c.req.header('Idempotency-Key')

    // Validate Idempotency-Key header is present and non-empty
    if (!idempotencyKey || idempotencyKey.trim() === '') {
      return c.json({ error: 'Idempotency-Key header is required' }, 400)
    }

    if (idempotencyKey.length > 255) {
      return c.json({ error: 'Idempotency-Key header is too long' }, 400)
    }

    // Check if bill exists
    const bill = await c.env.DB.prepare('SELECT id FROM bills WHERE id = ?')
      .bind(billId)
      .first<{ id: string }>()

    if (!bill) {
      return c.json({ error: 'Bill not found' }, 404)
    }

    // Check if share exists for this bill
    const share = await c.env.DB.prepare(
      'SELECT id, bill_id, member_id, amount_cents, paid_at, idempotency_key FROM shares WHERE id = ? AND bill_id = ?',
    )
      .bind(shareId, billId)
      .first<{
        id: string
        bill_id: string
        member_id: string
        amount_cents: number
        paid_at: string | null
        idempotency_key: string | null
      }>()

    if (!share) {
      return c.json({ error: 'Share not found' }, 404)
    }

    // Authorization rule: A regular member cannot pay another member's share
    const user = c.get('user')
    const membership = c.get('membership')

    if (membership?.role === 'member') {
      let isOwnShare = false
      if (membership.memberId) {
        isOwnShare = membership.memberId === share.member_id
      } else {
        const shareMember = await c.env.DB.prepare('SELECT name FROM members WHERE id = ?')
          .bind(share.member_id)
          .first<{ name: string }>()
        if (
          shareMember &&
          user.name.trim().toLowerCase() === shareMember.name.trim().toLowerCase()
        ) {
          isOwnShare = true
        }
      }

      if (!isOwnShare) {
        return c.json(
          { error: "You cannot change the payment status of another member's share" },
          403,
        )
      }
    }

    // If already paid, verify idempotency key
    if (share.paid_at !== null) {
      if (share.idempotency_key === idempotencyKey) {
        return c.json(
          {
            id: share.id,
            memberId: share.member_id,
            amountCents: share.amount_cents,
            paidAt: share.paid_at,
          },
          200,
        )
      }
      return c.json({ error: 'Share already paid with a different idempotency key' }, 409)
    }

    // Atomically update unpaid share to prevent double payment race conditions
    const now = new Date().toISOString()
    const result = await c.env.DB.prepare(
      'UPDATE shares SET paid_at = ?, idempotency_key = ? WHERE id = ? AND bill_id = ? AND paid_at IS NULL',
    )
      .bind(now, idempotencyKey, shareId, billId)
      .run()

    if (result.meta.changes === 0) {
      // Another concurrent request updated it first. Inspect the updated record.
      const updated = await c.env.DB.prepare(
        'SELECT id, member_id, amount_cents, paid_at, idempotency_key FROM shares WHERE id = ? AND bill_id = ?',
      )
        .bind(shareId, billId)
        .first<{
          id: string
          member_id: string
          amount_cents: number
          paid_at: string | null
          idempotency_key: string | null
        }>()

      if (updated?.idempotency_key === idempotencyKey) {
        return c.json(
          {
            id: updated.id,
            memberId: updated.member_id,
            amountCents: updated.amount_cents,
            paidAt: updated.paid_at,
          },
          200,
        )
      }

      return c.json({ error: 'Share already paid with a different idempotency key' }, 409)
    }

    return c.json(
      {
        id: share.id,
        memberId: share.member_id,
        amountCents: share.amount_cents,
        paidAt: now,
      },
      200,
    )
  },
)

// GET /api/homes/:homeId/balances
app.get(
  '/api/homes/:homeId/balances',
  authMiddleware,
  requireHomeRole('owner', 'admin', 'member'),
  async (c) => {
    const homeId = c.req.param('homeId')

    const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?')
      .bind(homeId)
      .first<{ id: string }>()

    if (!home) {
      return c.json({ error: 'Home not found' }, 404)
    }

    // Calculate unpaid balances per member, ordered by member position
    const { results: balances } = await c.env.DB.prepare(
      `SELECT
         m.id AS memberId,
         m.name AS name,
         CAST(COALESCE(SUM(CASE WHEN s.paid_at IS NULL AND s.id IS NOT NULL THEN s.amount_cents ELSE 0 END), 0) AS INTEGER) AS outstandingCents
       FROM members m
       LEFT JOIN shares s ON s.member_id = m.id
       WHERE m.home_id = ?
       GROUP BY m.id, m.name, m.position
       ORDER BY m.position ASC`,
    )
      .bind(homeId)
      .all<{ memberId: string; name: string; outstandingCents: number }>()

    return c.json({ balances }, 200)
  },
)

// GET /api/homes (Scoped to households the authenticated user belongs to)
app.get('/api/homes', authMiddleware, async (c) => {
  const user = c.get('user')

  const { results: homes } = await c.env.DB.prepare(
    `SELECT h.id, h.name, h.created_at AS createdAt, COUNT(m.id) AS memberCount
     FROM homes h
     JOIN home_memberships hm ON hm.home_id = h.id
     LEFT JOIN members m ON m.home_id = h.id
     WHERE hm.user_id = ?
     GROUP BY h.id, h.name, h.created_at
     ORDER BY h.created_at DESC`,
  )
    .bind(user.id)
    .all<{ id: string; name: string; createdAt: string; memberCount: number }>()

  return c.json({ homes }, 200)
})

// GET /api/homes/:homeId
app.get(
  '/api/homes/:homeId',
  authMiddleware,
  requireHomeRole('owner', 'admin', 'member'),
  async (c) => {
    const homeId = c.req.param('homeId')

    const home = await c.env.DB.prepare('SELECT id, name FROM homes WHERE id = ?')
      .bind(homeId)
      .first<{ id: string; name: string }>()

    if (!home) {
      return c.json({ error: 'Home not found' }, 404)
    }

    const { results: members } = await c.env.DB.prepare(
      'SELECT id, name, position FROM members WHERE home_id = ? ORDER BY position ASC',
    )
      .bind(homeId)
      .all<{ id: string; name: string; position: number }>()

    const membership = c.get('membership')
    return c.json(
      {
        ...home,
        members,
        userRole: membership?.role,
        currentMemberId: membership?.memberId,
      },
      200,
    )
  },
)

// GET /api/homes/:homeId/bills
app.get(
  '/api/homes/:homeId/bills',
  authMiddleware,
  requireHomeRole('owner', 'admin', 'member'),
  async (c) => {
    const homeId = c.req.param('homeId')

    const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?')
      .bind(homeId)
      .first<{ id: string }>()

    if (!home) {
      return c.json({ error: 'Home not found' }, 404)
    }

    const { results: bills } = await c.env.DB.prepare(
      'SELECT id, home_id AS homeId, title, total_cents AS totalCents, created_at AS createdAt FROM bills WHERE home_id = ? ORDER BY created_at DESC',
    )
      .bind(homeId)
      .all<{ id: string; homeId: string; title: string; totalCents: number; createdAt: string }>()

    const { results: rawShares } = await c.env.DB.prepare(
      `SELECT s.id, s.bill_id AS billId, s.member_id AS memberId, COALESCE(m.name, 'Member') AS memberName, s.amount_cents AS amountCents, s.paid_at AS paidAt
       FROM shares s
       JOIN bills b ON b.id = s.bill_id
       LEFT JOIN members m ON m.id = s.member_id
       WHERE b.home_id = ?
       ORDER BY COALESCE(m.position, 0) ASC`,
    )
      .bind(homeId)
      .all<{
        id: string
        billId: string
        memberId: string
        memberName: string
        amountCents: number
        paidAt: string | null
      }>()

    const sharesByBill = new Map<string, typeof rawShares>()
    for (const share of rawShares) {
      const list = sharesByBill.get(share.billId) ?? []
      list.push(share)
      sharesByBill.set(share.billId, list)
    }

    const billsWithShares = bills.map((bill) => ({
      ...bill,
      shares: sharesByBill.get(bill.id) ?? [],
    }))

    return c.json({ bills: billsWithShares }, 200)
  },
)

export default app
