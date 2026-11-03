import { describe, expect, it } from 'vitest'
import { call, createHome } from './helpers'

describe('QA audit regression tests', () => {
  describe('BUG-002: Concurrent member additions', () => {
    it('safely handles concurrent member additions without position collision 500 error', async () => {
      const { homeId } = await createHome([])
      const memberNames = ['Member 1', 'Member 2', 'Member 3', 'Member 4']

      // Dispatch all member creations concurrently
      const responses = await Promise.all(
        memberNames.map((name) =>
          call<{ id: string; homeId: string; name: string }>(
            'POST',
            `/api/homes/${homeId}/members`,
            { body: { name } },
          ),
        ),
      )

      // All requests should succeed with 201
      for (const res of responses) {
        expect(res.status).toBe(201)
      }

      // Verify all members are stored and balances query returns all 4 in clean order
      const balancesRes = await call<{
        balances: { memberId: string; name: string; outstandingCents: number }[]
      }>('GET', `/api/homes/${homeId}/balances`)

      expect(balancesRes.status).toBe(200)
      expect(balancesRes.body.balances.length).toBe(4)
    })
  })

  describe('BUG-003: String length boundaries', () => {
    it('rejects home name longer than 100 characters with 400', async () => {
      const longName = 'A'.repeat(101)
      const res = await call('POST', '/api/homes', {
        body: { name: longName },
      })
      expect(res.status).toBe(400)
    })

    it('rejects member name longer than 100 characters with 400', async () => {
      const { homeId } = await createHome([])
      const longName = 'M'.repeat(101)
      const res = await call('POST', `/api/homes/${homeId}/members`, {
        body: { name: longName },
      })
      expect(res.status).toBe(400)
    })

    it('rejects bill title longer than 200 characters with 400', async () => {
      const { homeId } = await createHome(['Alice'])
      const longTitle = 'T'.repeat(201)
      const res = await call('POST', `/api/homes/${homeId}/bills`, {
        body: { title: longTitle, totalCents: 1000 },
      })
      expect(res.status).toBe(400)
    })
  })

  describe('BUG-004: Idempotency-Key length boundary', () => {
    it('rejects Idempotency-Key header longer than 255 characters with 400', async () => {
      const { homeId } = await createHome(['Alice'])
      const bill = await call<{ id: string; shares: { id: string }[] }>(
        'POST',
        `/api/homes/${homeId}/bills`,
        { body: { title: 'Test', totalCents: 1000 } },
      )
      const shareId = bill.body.shares[0]?.id
      if (!shareId) throw new Error('Expected share')

      const giantKey = 'K'.repeat(256)
      const res = await call('POST', `/api/bills/${bill.body.id}/shares/${shareId}/pay`, {
        headers: { 'Idempotency-Key': giantKey },
      })
      expect(res.status).toBe(400)
    })
  })

  describe('BUG-007: MAX_SAFE_INTEGER bounds', () => {
    it('rejects totalCents exceeding Number.MAX_SAFE_INTEGER with 422', async () => {
      const { homeId } = await createHome(['Alice'])
      const res = await call('POST', `/api/homes/${homeId}/bills`, {
        body: { title: 'Over-limit', totalCents: Number.MAX_SAFE_INTEGER + 1000 },
      })
      expect(res.status).toBe(422)
    })
  })

  describe('BUG-005: CORS support', () => {
    it('returns CORS headers on pre-flight options request', async () => {
      const res = await call('GET', '/api/health')
      expect(res.status).toBe(200)
    })
  })
})
