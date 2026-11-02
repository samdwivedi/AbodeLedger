import { Hono } from 'hono'
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

  // Verify home exists
  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?')
    .bind(homeId)
    .first<{ id: string }>()

  if (!home) {
    return c.json({ error: 'Home not found' }, 404)
  }

  const memberId = crypto.randomUUID()

  // Atomically assign next position for this home to preserve deterministic member order
  await c.env.DB.prepare(
    `INSERT INTO members (id, home_id, name, position)
     VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM members WHERE home_id = ?))`,
  )
    .bind(memberId, homeId, name, homeId)
    .run()

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

  // Validate totalCents: must be a positive whole number
  if (typeof totalCents !== 'number' || !Number.isInteger(totalCents) || totalCents <= 0) {
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
  const trimmedTitle = title.trim()

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

export default app
