import { describe, expect, it } from 'vitest'
import { splitTotal } from '../src/split'
import { call, createBill, createHome } from './helpers'

describe('bill splitting — edge cases', () => {
  describe('splitTotal pure function', () => {
    it('splits evenly when divisible', () => {
      expect(splitTotal(900, 3)).toEqual([300, 300, 300])
    })

    it('distributes remainder to first members', () => {
      expect(splitTotal(10, 3)).toEqual([4, 3, 3])
    })

    it('handles total smaller than member count', () => {
      // 2 cents among 5 members: first 2 get 1 cent, rest get 0
      const result = splitTotal(2, 5)
      expect(result).toEqual([1, 1, 0, 0, 0])
      expect(result.reduce((a, b) => a + b, 0)).toBe(2)
    })

    it('handles total equal to 1 with many members', () => {
      const result = splitTotal(1, 10)
      expect(result).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      expect(result.reduce((a, b) => a + b, 0)).toBe(1)
    })

    it('handles single member', () => {
      expect(splitTotal(12345, 1)).toEqual([12345])
    })

    it('handles large amount with many members', () => {
      const result = splitTotal(999999, 7)
      expect(result.reduce((a, b) => a + b, 0)).toBe(999999)
      // Each member should get 142857 or 142858
      for (const amount of result) {
        expect(amount).toBeGreaterThanOrEqual(142857)
        expect(amount).toBeLessThanOrEqual(142858)
      }
    })

    it('produces zero-cent shares when total is less than member count', () => {
      const result = splitTotal(3, 10)
      expect(result.filter((a) => a === 0).length).toBe(7)
      expect(result.filter((a) => a === 1).length).toBe(3)
      expect(result.reduce((a, b) => a + b, 0)).toBe(3)
    })
  })

  describe('API bill creation edge cases', () => {
    it('creates zero-cent shares for small total with many members', async () => {
      const { homeId } = await createHome(['A', 'B', 'C', 'D', 'E'])

      const bill = await createBill(homeId, 2)

      expect(bill.status).toBe(201)
      const amounts = bill.body.shares.map((s) => s.amountCents)
      expect(amounts).toEqual([1, 1, 0, 0, 0])
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(2)
    })

    it('creates a bill with 1 cent total split among many members', async () => {
      const { homeId } = await createHome(['A', 'B', 'C'])

      const bill = await createBill(homeId, 1)

      expect(bill.status).toBe(201)
      expect(bill.body.shares.map((s) => s.amountCents)).toEqual([1, 0, 0])
    })

    it('returns the correct response shape', async () => {
      const { homeId, members } = await createHome(['Asha'])

      const bill = await createBill(homeId, 500)

      expect(bill.status).toBe(201)
      expect(bill.body).toMatchObject({
        id: expect.any(String),
        homeId,
        title: 'Electricity',
        totalCents: 500,
      })
      expect(bill.body.shares).toHaveLength(1)
      expect(bill.body.shares[0]).toMatchObject({
        id: expect.any(String),
        memberId: members[0]?.id,
        amountCents: 500,
        paidAt: null,
      })
    })

    it('rejects missing title', async () => {
      const { homeId } = await createHome(['Asha'])

      const res = await call('POST', `/api/homes/${homeId}/bills`, {
        body: { totalCents: 1000 },
      })

      expect(res.status).toBe(400)
    })

    it('rejects empty title', async () => {
      const { homeId } = await createHome(['Asha'])

      const res = await call('POST', `/api/homes/${homeId}/bills`, {
        body: { title: '', totalCents: 1000 },
      })

      expect(res.status).toBe(400)
    })

    it('shares from multiple bills are independent', async () => {
      const { homeId } = await createHome(['Asha', 'Ben'])

      const bill1 = await createBill(homeId, 1000)
      const bill2 = await createBill(homeId, 600)

      expect(bill1.status).toBe(201)
      expect(bill2.status).toBe(201)
      expect(bill1.body.shares.map((s) => s.amountCents)).toEqual([500, 500])
      expect(bill2.body.shares.map((s) => s.amountCents)).toEqual([300, 300])

      // Share IDs should be different
      const allIds = [...bill1.body.shares.map((s) => s.id), ...bill2.body.shares.map((s) => s.id)]
      expect(new Set(allIds).size).toBe(allIds.length)
    })
  })
})
