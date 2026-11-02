import { describe, expect, it } from 'vitest'
import { call, type Member } from './helpers'

describe('homes and members — edge cases', () => {
  describe('input validation', () => {
    it('rejects a home with an empty name', async () => {
      const res = await call('POST', '/api/homes', { body: { name: '' } })
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    it('rejects a home with a whitespace-only name', async () => {
      const res = await call('POST', '/api/homes', { body: { name: '   ' } })
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    it('rejects a home with a non-string name', async () => {
      const res = await call('POST', '/api/homes', { body: { name: 42 } })
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    it('rejects a home with a null name', async () => {
      const res = await call('POST', '/api/homes', { body: { name: null } })
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    it('rejects a home with a missing name field', async () => {
      const res = await call('POST', '/api/homes', { body: {} })
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    it('rejects a member with an empty name', async () => {
      const home = await call<{ id: string }>('POST', '/api/homes', { body: { name: 'Test' } })
      const res = await call('POST', `/api/homes/${home.body.id}/members`, {
        body: { name: '' },
      })
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    it('rejects a member with a whitespace-only name', async () => {
      const home = await call<{ id: string }>('POST', '/api/homes', { body: { name: 'Test' } })
      const res = await call('POST', `/api/homes/${home.body.id}/members`, {
        body: { name: '   ' },
      })
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    it('rejects a member with a non-string name', async () => {
      const home = await call<{ id: string }>('POST', '/api/homes', { body: { name: 'Test' } })
      const res = await call('POST', `/api/homes/${home.body.id}/members`, {
        body: { name: 123 },
      })
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    it('rejects a member with a missing name field', async () => {
      const home = await call<{ id: string }>('POST', '/api/homes', { body: { name: 'Test' } })
      const res = await call('POST', `/api/homes/${home.body.id}/members`, {
        body: {},
      })
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })
  })

  describe('member ordering', () => {
    it('preserves insertion order across multiple members', async () => {
      const home = await call<{ id: string }>('POST', '/api/homes', {
        body: { name: 'Ordering Test' },
      })
      const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve']
      const members: Member[] = []

      for (const name of names) {
        const member = await call<Member>('POST', `/api/homes/${home.body.id}/members`, {
          body: { name },
        })
        expect(member.status).toBe(201)
        members.push(member.body)
      }

      // Each member should have the correct homeId and name
      for (let i = 0; i < names.length; i++) {
        expect(members[i]?.homeId).toBe(home.body.id)
        expect(members[i]?.name).toBe(names[i])
      }
    })
  })

  describe('error responses are JSON', () => {
    it('returns JSON error for home not found', async () => {
      const res = await call('POST', '/api/homes/nonexistent-id/members', {
        body: { name: 'Test' },
      })
      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('error')
    })

    it('returns JSON error for invalid home input', async () => {
      const res = await call('POST', '/api/homes', { body: { name: '' } })
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })
  })
})
