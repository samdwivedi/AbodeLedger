import { describe, expect, it } from 'vitest'
import { type Balance, call, createBill, createHome, type Share } from './helpers'

function pay(billId: string, shareId: string, key?: string) {
  return call<Share>('POST', `/api/bills/${billId}/shares/${shareId}/pay`, {
    headers: key !== undefined ? { 'Idempotency-Key': key } : {},
  })
}

function balances(homeId: string) {
  return call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
}

describe('payments & balances — edge cases & hidden requirements', () => {
  describe('Idempotency & Concurrency', () => {
    it('rejects whitespace-only Idempotency-Key header with 400', async () => {
      const { homeId } = await createHome(['Alice', 'Bob'])
      const bill = await createBill(homeId, 1000)
      const share = bill.body.shares[0]
      if (!share) throw new Error('Expected share')

      const res = await pay(bill.body.id, share.id, '   ')
      expect(res.status).toBe(400)
    })

    it('handles concurrent payments with different keys: exactly one succeeds, one gets 409', async () => {
      const { homeId } = await createHome(['Alice', 'Bob'])
      const bill = await createBill(homeId, 1000)
      const share = bill.body.shares[0]
      if (!share) throw new Error('Expected share')

      const key1 = crypto.randomUUID()
      const key2 = crypto.randomUUID()

      // Launch both requests concurrently
      const [res1, res2] = await Promise.all([
        pay(bill.body.id, share.id, key1),
        pay(bill.body.id, share.id, key2),
      ])

      const statuses = [res1.status, res2.status].sort()
      expect(statuses).toEqual([200, 409])
    })

    it('handles concurrent payments with the same key: both return 200 with matching paidAt', async () => {
      const { homeId } = await createHome(['Alice', 'Bob'])
      const bill = await createBill(homeId, 1000)
      const share = bill.body.shares[0]
      if (!share) throw new Error('Expected share')

      const sharedKey = crypto.randomUUID()

      const [res1, res2] = await Promise.all([
        pay(bill.body.id, share.id, sharedKey),
        pay(bill.body.id, share.id, sharedKey),
      ])

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)
      expect(res1.body.paidAt).toBe(res2.body.paidAt)
    })

    it('returns 404 when share exists but belongs to a different bill', async () => {
      const { homeId } = await createHome(['Alice', 'Bob'])
      const bill1 = await createBill(homeId, 1000)
      const bill2 = await createBill(homeId, 2000)

      const shareFromBill1 = bill1.body.shares[0]
      if (!shareFromBill1) throw new Error('Expected share')

      // Attempt to pay shareFromBill1 under bill2 URL
      const res = await pay(bill2.body.id, shareFromBill1.id, crypto.randomUUID())
      expect(res.status).toBe(404)
    })
  })

  describe('Balances edge cases', () => {
    it('returns 0 outstanding cents for home members with zero bills', async () => {
      const { homeId, members } = await createHome(['Alice', 'Bob', 'Charlie'])

      const res = await balances(homeId)
      expect(res.status).toBe(200)
      expect(res.body.balances).toEqual([
        { memberId: members[0]?.id, name: 'Alice', outstandingCents: 0 },
        { memberId: members[1]?.id, name: 'Bob', outstandingCents: 0 },
        { memberId: members[2]?.id, name: 'Charlie', outstandingCents: 0 },
      ])
    })

    it('accurately tracks zero-cent shares after 1-cent bill split', async () => {
      const { homeId, members } = await createHome(['Alice', 'Bob'])
      // 1 cent bill: Alice gets 1 cent, Bob gets 0 cents
      const bill = await createBill(homeId, 1)
      const aliceShare = bill.body.shares.find((s) => s.memberId === members[0]?.id)
      if (!aliceShare) throw new Error('Expected aliceShare')

      const initialBalances = await balances(homeId)
      expect(initialBalances.body.balances).toEqual([
        { memberId: members[0]?.id, name: 'Alice', outstandingCents: 1 },
        { memberId: members[1]?.id, name: 'Bob', outstandingCents: 0 },
      ])

      // Alice pays her 1 cent share
      const payRes = await pay(bill.body.id, aliceShare.id, crypto.randomUUID())
      expect(payRes.status).toBe(200)

      const finalBalances = await balances(homeId)
      expect(finalBalances.body.balances).toEqual([
        { memberId: members[0]?.id, name: 'Alice', outstandingCents: 0 },
        { memberId: members[1]?.id, name: 'Bob', outstandingCents: 0 },
      ])
    })
  })

  describe('UI Read endpoints', () => {
    it('GET /api/homes returns created homes with member counts', async () => {
      const { homeId } = await createHome(['X', 'Y', 'Z'])

      const res = await call<{ homes: { id: string; name: string; memberCount: number }[] }>(
        'GET',
        '/api/homes',
      )
      expect(res.status).toBe(200)
      const found = res.body.homes.find((h) => h.id === homeId)
      expect(found).toBeDefined()
      expect(found?.name).toBe('Test home')
      expect(found?.memberCount).toBe(3)
    })

    it('GET /api/homes/:homeId/bills returns bills with member names and paid status', async () => {
      const { homeId } = await createHome(['Sam', 'Leo'])
      const bill = await createBill(homeId, 1200)
      const firstShare = bill.body.shares[0]
      if (!firstShare) throw new Error('Expected firstShare')

      await pay(bill.body.id, firstShare.id, crypto.randomUUID())

      const res = await call<{
        bills: {
          id: string
          title: string
          totalCents: number
          shares: { id: string; memberName: string; amountCents: number; paidAt: string | null }[]
        }[]
      }>('GET', `/api/homes/${homeId}/bills`)

      expect(res.status).toBe(200)
      expect(res.body.bills.length).toBe(1)
      expect(res.body.bills[0]?.title).toBe('Electricity')
      expect(res.body.bills[0]?.shares.length).toBe(2)
      expect(res.body.bills[0]?.shares[0]?.paidAt).toBeTruthy()
      expect(res.body.bills[0]?.shares[1]?.paidAt).toBeNull()
    })
  })
})
