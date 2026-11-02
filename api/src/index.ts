import { Hono } from 'hono'

interface CreateHomeBody {
  name?: unknown
}

interface CreateMemberBody {
  name?: unknown
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

export default app
