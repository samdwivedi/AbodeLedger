import { Hono } from 'hono'
import { cors } from 'hono/cors'
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

const app = new Hono<{ Bindings: Env }>()

// Global error handlers ensuring JSON response format
app.onError((err, c) => {
  return c.json({ error: err.message || 'Internal Server Error' }, 500)
})

app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

// Enable Cross-Origin Resource Sharing for decoupled client deployments
app.use('/api/*', cors())

app.get('/api/health', (c) => c.json({ status: 'ok' }))

// POST /api/homes
app.post('/api/homes', async (c) => {
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

  const id = crypto.randomUUID()

  await c.env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(id, name).run()

  return c.json({ id, name }, 201)
})

// POST /api/homes/:homeId/members
app.post('/api/homes/:homeId/members', async (c) => {
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

  return c.json({ id: memberId, homeId, name }, 201)
})

// POST /api/homes/:homeId/bills
app.post('/api/homes/:homeId/bills', async (c) => {
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

  // Fetch members in insertion order
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
})

// POST /api/bills/:billId/shares/:shareId/pay
app.post('/api/bills/:billId/shares/:shareId/pay', async (c) => {
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

  // If already paid, check idempotency key
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

  // Atomically update unpaid share to prevent race conditions
  const now = new Date().toISOString()
  const result = await c.env.DB.prepare(
    'UPDATE shares SET paid_at = ?, idempotency_key = ? WHERE id = ? AND bill_id = ? AND paid_at IS NULL',
  )
    .bind(now, idempotencyKey, shareId, billId)
    .run()

  if (result.meta.changes === 0) {
    // Another concurrent request updated it first. Check the updated state.
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
})

// GET /api/homes/:homeId/balances
app.get('/api/homes/:homeId/balances', async (c) => {
  const homeId = c.req.param('homeId')

  // Check if home exists
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
})

// GET /api/homes (list homes for UI)
app.get('/api/homes', async (c) => {
  const { results: homes } = await c.env.DB.prepare(
    `SELECT h.id, h.name, h.created_at AS createdAt, COUNT(m.id) AS memberCount
     FROM homes h
     LEFT JOIN members m ON m.home_id = h.id
     GROUP BY h.id, h.name, h.created_at
     ORDER BY h.created_at DESC`,
  ).all<{ id: string; name: string; createdAt: string; memberCount: number }>()

  return c.json({ homes }, 200)
})

// GET /api/homes/:homeId (get home with members for UI)
app.get('/api/homes/:homeId', async (c) => {
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

  return c.json({ ...home, members }, 200)
})

// GET /api/homes/:homeId/bills (list bills with shares for UI)
app.get('/api/homes/:homeId/bills', async (c) => {
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
})

export default app
