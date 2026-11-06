import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

interface ApiResult<T = unknown> {
  status: number
  body: T
  cookie: string | null
}

async function authCall<T = unknown>(
  method: 'GET' | 'POST',
  path: string,
  options: {
    body?: unknown
    headers?: Record<string, string>
    cookie?: string | null
  } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...options.headers,
  }

  if (options.cookie) {
    // Extract cookie value before semicolon if full Set-Cookie header string was passed
    const cleanCookie = options.cookie.split(';')[0]
    if (cleanCookie) {
      headers.cookie = cleanCookie
    }
  }

  const response = await exports.default.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
  )

  const setCookie = response.headers.get('set-cookie')
  const text = await response.text()
  let body: T
  try {
    body = JSON.parse(text)
  } catch {
    body = text as unknown as T
  }

  return { status: response.status, body, cookie: setCookie }
}

describe('Security & Authentication Audit Suite', { timeout: 15000 }, () => {
  describe('User Registration & Input Boundaries', () => {
    it('registers a new user and sets secure session cookie', async () => {
      const email = `alice_${Date.now()}@example.com`
      const res = await authCall<{ user: { id: string; email: string; name: string } }>(
        'POST',
        '/api/auth/register',
        {
          body: {
            email,
            password: 'StrongPassword123!',
            name: 'Alice Cooper',
          },
        },
      )

      expect(res.status).toBe(201)
      expect(res.body.user).toBeDefined()
      expect(res.body.user.email).toBe(email.toLowerCase())
      expect(res.body.user.name).toBe('Alice Cooper')
      expect(res.cookie).toContain('session=')
    })

    it('rejects duplicate registration with exact and normalized email', async () => {
      const baseEmail = `bob_${Date.now()}@example.com`
      const first = await authCall('POST', '/api/auth/register', {
        body: {
          email: baseEmail,
          password: 'Password123!',
          name: 'Bob',
        },
      })
      expect(first.status).toBe(201)

      // Attempt with uppercase variant and surrounding whitespace
      const duplicate = await authCall('POST', '/api/auth/register', {
        body: {
          email: `  ${baseEmail.toUpperCase()}  `,
          password: 'DifferentPassword456!',
          name: 'Bob Clone',
        },
      })
      expect(duplicate.status).toBe(409)
      expect(duplicate.body).toEqual({ error: 'An account with this email already exists' })
    })

    it('enforces password minimum length of 10 characters', async () => {
      const res = await authCall('POST', '/api/auth/register', {
        body: {
          email: `short_${Date.now()}@example.com`,
          password: 'Short9!', // 7 chars
          name: 'Short',
        },
      })
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    it('enforces password maximum length of 128 characters to thwart hashing DoS', async () => {
      const overlongPassword = 'A'.repeat(129)
      const res = await authCall('POST', '/api/auth/register', {
        body: {
          email: `dos_${Date.now()}@example.com`,
          password: overlongPassword,
          name: 'Attacker',
        },
      })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'Password must be 128 characters or fewer' })
    })

    it('rejects invalid email formats', async () => {
      const res = await authCall('POST', '/api/auth/register', {
        body: {
          email: 'not-an-email',
          password: 'StrongPassword123!',
          name: 'Tester',
        },
      })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'Valid email is required' })
    })
  })

  describe('Session Lifecycle & Access Control', () => {
    it('authenticates valid credentials and rejects invalid passwords', async () => {
      const email = `login_${Date.now()}@example.com`
      const password = 'CorrectPassword999!'

      await authCall('POST', '/api/auth/register', {
        body: { email, password, name: 'Login User' },
      })

      // Wrong password
      const badLogin = await authCall('POST', '/api/auth/login', {
        body: { email, password: 'WrongPassword123!' },
      })
      expect(badLogin.status).toBe(401)
      expect(badLogin.body).toEqual({ error: 'Invalid email or password' })

      // Non-existent email
      const ghostLogin = await authCall('POST', '/api/auth/login', {
        body: { email: 'ghost@example.com', password },
      })
      expect(ghostLogin.status).toBe(401)
      expect(ghostLogin.body).toEqual({ error: 'Invalid email or password' })

      // Valid login
      const goodLogin = await authCall<{ user: { email: string } }>('POST', '/api/auth/login', {
        body: { email, password },
      })
      expect(goodLogin.status).toBe(200)
      expect(goodLogin.body.user.email).toBe(email)
      expect(goodLogin.cookie).toBeDefined()
    })

    it('retrieves user profile via /api/auth/me with active session', async () => {
      const email = `me_${Date.now()}@example.com`
      const registerRes = await authCall<{ user: { id: string; email: string } }>(
        'POST',
        '/api/auth/register',
        {
          body: { email, password: 'StrongPassword123!', name: 'Self User' },
        },
      )

      const meRes = await authCall<{ user: { id: string; email: string } }>('GET', '/api/auth/me', {
        cookie: registerRes.cookie,
      })
      expect(meRes.status).toBe(200)
      expect(meRes.body.user.email).toBe(email)
    })

    it('revokes session on logout and rejects subsequent authenticated calls', async () => {
      const email = `logout_${Date.now()}@example.com`
      const reg = await authCall('POST', '/api/auth/register', {
        body: { email, password: 'StrongPassword123!', name: 'Logout User' },
      })

      // Confirm logged in
      const me1 = await authCall('GET', '/api/auth/me', { cookie: reg.cookie })
      expect(me1.status).toBe(200)

      // Logout
      const logoutRes = await authCall('POST', '/api/auth/logout', { cookie: reg.cookie })
      expect(logoutRes.status).toBe(200)

      // Attempt accessing /api/auth/me with revoked session
      const me2 = await authCall('GET', '/api/auth/me', { cookie: reg.cookie })
      expect(me2.status).toBe(401)
      expect(me2.body).toEqual({ error: 'Invalid or expired session' })
    })

    it('rejects unauthenticated requests when strict authentication is enforced', async () => {
      const res = await authCall('GET', '/api/homes', {
        headers: { 'X-Enforce-Auth': 'true' },
      })
      expect(res.status).toBe(401)
      expect(res.body).toEqual({ error: 'Authentication required' })
    })
  })

  describe('IDOR & Multi-Tenant Household Authorization', () => {
    it('prevents cross-household data access and manipulation', async () => {
      // 1. Register User A and create Home A
      const userA = await authCall('POST', '/api/auth/register', {
        body: {
          email: `usera_${Date.now()}@example.com`,
          password: 'Password123!',
          name: 'User A',
        },
      })
      const homeA = await authCall<{ id: string }>('POST', '/api/homes', {
        body: { name: 'Home Alpha' },
        cookie: userA.cookie,
      })
      expect(homeA.status).toBe(201)

      // Add a member to Home A
      const memberA = await authCall<{ id: string }>(
        'POST',
        `/api/homes/${homeA.body.id}/members`,
        {
          body: { name: 'Tenant Alpha' },
          cookie: userA.cookie,
        },
      )
      expect(memberA.status).toBe(201)

      // 2. Register User B and create Home B
      const userB = await authCall('POST', '/api/auth/register', {
        body: {
          email: `userb_${Date.now()}@example.com`,
          password: 'Password123!',
          name: 'User B',
        },
      })
      const homeB = await authCall<{ id: string }>('POST', '/api/homes', {
        body: { name: 'Home Beta' },
        cookie: userB.cookie,
      })
      expect(homeB.status).toBe(201)

      // 3. User B attempts IDOR read of Home A (must return 404 to avoid ID probing)
      const readHomeA = await authCall('GET', `/api/homes/${homeA.body.id}`, {
        cookie: userB.cookie,
      })
      expect(readHomeA.status).toBe(404)
      expect(readHomeA.body).toEqual({ error: 'Home not found' })

      // 4. User B attempts to read Home A's bills
      const readBillsA = await authCall('GET', `/api/homes/${homeA.body.id}/bills`, {
        cookie: userB.cookie,
      })
      expect(readBillsA.status).toBe(404)

      // 5. User B attempts to read Home A's balances
      const readBalancesA = await authCall('GET', `/api/homes/${homeA.body.id}/balances`, {
        cookie: userB.cookie,
      })
      expect(readBalancesA.status).toBe(404)

      // 6. User B attempts to create a bill in Home A
      const createBillInA = await authCall('POST', `/api/homes/${homeA.body.id}/bills`, {
        body: { title: 'Malicious Bill', totalCents: 5000 },
        cookie: userB.cookie,
      })
      expect(createBillInA.status).toBe(404)

      // 7. User B attempts to inject a member into Home A
      const addMemberInA = await authCall('POST', `/api/homes/${homeA.body.id}/members`, {
        body: { name: 'Intruder' },
        cookie: userB.cookie,
      })
      expect(addMemberInA.status).toBe(404)
    })

    it('prevents cross-household payment tampering', async () => {
      // User A setup
      const userA = await authCall('POST', '/api/auth/register', {
        body: {
          email: `payment_a_${Date.now()}@example.com`,
          password: 'Password123!',
          name: 'User A',
        },
      })
      const homeA = await authCall<{ id: string }>('POST', '/api/homes', {
        body: { name: 'Home Payments' },
        cookie: userA.cookie,
      })
      await authCall('POST', `/api/homes/${homeA.body.id}/members`, {
        body: { name: 'Resident 1' },
        cookie: userA.cookie,
      })
      const billRes = await authCall<{ id: string; shares: { id: string }[] }>(
        'POST',
        `/api/homes/${homeA.body.id}/bills`,
        {
          body: { title: 'Water Bill', totalCents: 1500 },
          cookie: userA.cookie,
        },
      )
      const share = billRes.body.shares[0]
      expect(share).toBeDefined()

      // User B setup (different user, not in Home A)
      const userB = await authCall('POST', '/api/auth/register', {
        body: {
          email: `payment_b_${Date.now()}@example.com`,
          password: 'Password123!',
          name: 'User B',
        },
      })

      // User B tries to pay User A's share
      const tamperPay = await authCall(
        'POST',
        `/api/bills/${billRes.body.id}/shares/${share?.id}/pay`,
        {
          headers: { 'Idempotency-Key': crypto.randomUUID() },
          cookie: userB.cookie,
        },
      )
      expect(tamperPay.status).toBe(404)

      // Legitimate payment by User A succeeds
      const legitPay = await authCall<{ paidAt: string }>(
        'POST',
        `/api/bills/${billRes.body.id}/shares/${share?.id}/pay`,
        {
          headers: { 'Idempotency-Key': crypto.randomUUID() },
          cookie: userA.cookie,
        },
      )
      expect(legitPay.status).toBe(200)
      expect(legitPay.body.paidAt).toBeDefined()
    })
  })

  describe('Role-Based Access Control (RBAC) & Invitations', () => {
    it('enforces RBAC: regular member cannot add members, owner can', async () => {
      // 1. Owner registers and creates home
      const owner = await authCall('POST', '/api/auth/register', {
        body: {
          email: `owner_${Date.now()}@example.com`,
          password: 'Password123!',
          name: 'Owner',
        },
      })
      const home = await authCall<{ id: string }>('POST', '/api/homes', {
        body: { name: 'Household RBAC' },
        cookie: owner.cookie,
      })

      // 2. Member registers
      const memberEmail = `member_${Date.now()}@example.com`
      const member = await authCall('POST', '/api/auth/register', {
        body: {
          email: memberEmail,
          password: 'Password123!',
          name: 'Regular Member',
        },
      })

      // 3. Owner invites member as 'member' role
      const invite = await authCall<{ token: string }>(
        'POST',
        `/api/homes/${home.body.id}/invitations`,
        {
          body: { email: memberEmail, role: 'member' },
          cookie: owner.cookie,
        },
      )
      expect(invite.status).toBe(201)

      // 4. Member accepts invitation
      const accept = await authCall('POST', `/api/invitations/${invite.body.token}/accept`, {
        cookie: member.cookie,
      })
      expect(accept.status).toBe(200)

      // 5. Member attempts to add another member (requires 'owner' or 'admin')
      const unauthorizedAdd = await authCall('POST', `/api/homes/${home.body.id}/members`, {
        body: { name: 'Forbidden Member' },
        cookie: member.cookie,
      })
      expect(unauthorizedAdd.status).toBe(403)
      expect(unauthorizedAdd.body).toEqual({
        error: 'Forbidden: Insufficient household permissions',
      })

      // 6. Owner adds the member successfully
      const ownerAdd = await authCall('POST', `/api/homes/${home.body.id}/members`, {
        body: { name: 'Allowed Member' },
        cookie: owner.cookie,
      })
      expect(ownerAdd.status).toBe(201)
    })

    it("ensures a regular member cannot change the payment status of another member's share", async () => {
      // 1. Owner registers, creates home, and adds two members: 'Asha' and 'Ben'
      const owner = await authCall('POST', '/api/auth/register', {
        body: {
          email: `owner_share_${Date.now()}@example.com`,
          password: 'Password123!',
          name: 'Owner User',
        },
      })
      const home = await authCall<{ id: string }>('POST', '/api/homes', {
        body: { name: 'Shared Flat' },
        cookie: owner.cookie,
      })
      const ashaMember = await authCall<{ id: string }>(
        'POST',
        `/api/homes/${home.body.id}/members`,
        {
          body: { name: 'Asha' },
          cookie: owner.cookie,
        },
      )
      const benMember = await authCall<{ id: string }>(
        'POST',
        `/api/homes/${home.body.id}/members`,
        {
          body: { name: 'Ben' },
          cookie: owner.cookie,
        },
      )

      // 2. Owner creates bill
      const bill = await authCall<{ id: string; shares: { id: string; memberId: string }[] }>(
        'POST',
        `/api/homes/${home.body.id}/bills`,
        {
          body: { title: 'Electricity', totalCents: 1000 },
          cookie: owner.cookie,
        },
      )

      const ashaShare = bill.body.shares.find((s) => s.memberId === ashaMember.body.id)
      const benShare = bill.body.shares.find((s) => s.memberId === benMember.body.id)
      expect(ashaShare).toBeDefined()
      expect(benShare).toBeDefined()

      // 3. User registers as 'Ben' and joins as regular member
      const benEmail = `ben_${Date.now()}@example.com`
      const benUser = await authCall('POST', '/api/auth/register', {
        body: {
          email: benEmail,
          password: 'Password123!',
          name: 'Ben',
        },
      })
      const invite = await authCall<{ token: string }>(
        'POST',
        `/api/homes/${home.body.id}/invitations`,
        {
          body: { email: benEmail, role: 'member' },
          cookie: owner.cookie,
        },
      )
      await authCall('POST', `/api/invitations/${invite.body.token}/accept`, {
        cookie: benUser.cookie,
      })

      // 4. Ben attempts to pay Asha's share (MUST BE FORBIDDEN 403)
      const payAshaShare = await authCall(
        'POST',
        `/api/bills/${bill.body.id}/shares/${ashaShare?.id}/pay`,
        {
          headers: { 'Idempotency-Key': crypto.randomUUID() },
          cookie: benUser.cookie,
        },
      )
      expect(payAshaShare.status).toBe(403)
      expect(payAshaShare.body).toEqual({
        error: "You cannot change the payment status of another member's share",
      })

      // 5. Ben pays his own share (MUST SUCCEED 200)
      const payBenShare = await authCall(
        'POST',
        `/api/bills/${bill.body.id}/shares/${benShare?.id}/pay`,
        {
          headers: { 'Idempotency-Key': crypto.randomUUID() },
          cookie: benUser.cookie,
        },
      )
      expect(payBenShare.status).toBe(200)
    })

    describe('Household Invitation Email Verification Security', () => {
      it('allows account with exact matching email to accept invitation', async () => {
        // 1. Owner registers and creates home
        const owner = await authCall('POST', '/api/auth/register', {
          body: {
            email: `owner_inv_${Date.now()}@example.com`,
            password: 'Password123!',
            name: 'Home Owner',
          },
        })
        const home = await authCall<{ id: string }>('POST', '/api/homes', {
          body: { name: 'Verified Invites Home' },
          cookie: owner.cookie,
        })

        // 2. Invitee registers
        const inviteeEmail = `invited_${Date.now()}@example.com`
        const invitee = await authCall('POST', '/api/auth/register', {
          body: {
            email: inviteeEmail,
            password: 'Password123!',
            name: 'Invited Member',
          },
        })

        // 3. Owner creates invitation
        const invite = await authCall<{ token: string }>(
          'POST',
          `/api/homes/${home.body.id}/invitations`,
          {
            body: { email: inviteeEmail, role: 'member' },
            cookie: owner.cookie,
          },
        )
        expect(invite.status).toBe(201)

        // 4. Correct email accepts invitation (succeeds 200)
        const accept = await authCall('POST', `/api/invitations/${invite.body.token}/accept`, {
          cookie: invitee.cookie,
        })
        expect(accept.status).toBe(200)
        expect(accept.body).toEqual({
          success: true,
          homeId: home.body.id,
          role: 'member',
        })
      })

      it('rejects different email from accepting invitation with HTTP 403 and generic error message', async () => {
        // 1. Owner registers and creates home
        const owner = await authCall('POST', '/api/auth/register', {
          body: {
            email: `owner_mismatch_${Date.now()}@example.com`,
            password: 'Password123!',
            name: 'Home Owner',
          },
        })
        const home = await authCall<{ id: string }>('POST', '/api/homes', {
          body: { name: 'Secure Invites Home' },
          cookie: owner.cookie,
        })

        // 2. Owner invites target recipient
        const targetEmail = `target_recipient_${Date.now()}@example.com`
        const invite = await authCall<{ token: string }>(
          'POST',
          `/api/homes/${home.body.id}/invitations`,
          {
            body: { email: targetEmail, role: 'member' },
            cookie: owner.cookie,
          },
        )
        expect(invite.status).toBe(201)

        // 3. Attacker registers with different email
        const attacker = await authCall('POST', '/api/auth/register', {
          body: {
            email: `attacker_${Date.now()}@example.com`,
            password: 'Password123!',
            name: 'Attacker User',
          },
        })

        // 4. Attacker attempts to accept invitation (MUST BE REJECTED 403)
        const unauthorizedAccept = await authCall(
          'POST',
          `/api/invitations/${invite.body.token}/accept`,
          {
            cookie: attacker.cookie,
          },
        )
        expect(unauthorizedAccept.status).toBe(403)
        expect(unauthorizedAccept.body).toEqual({
          error: 'You are not authorized to accept this invitation',
        })
      })

      it('normalizes email casing and whitespace when validating invitation acceptance', async () => {
        // 1. Owner registers and creates home
        const owner = await authCall('POST', '/api/auth/register', {
          body: {
            email: `owner_norm_${Date.now()}@example.com`,
            password: 'Password123!',
            name: 'Home Owner',
          },
        })
        const home = await authCall<{ id: string }>('POST', '/api/homes', {
          body: { name: 'Normalized Email Home' },
          cookie: owner.cookie,
        })

        // 2. Owner invites email with uppercase letters and whitespace
        const baseEmail = `normalize_test_${Date.now()}@example.com`
        const rawInviteEmail = `   ${baseEmail.toUpperCase()}   `
        const invite = await authCall<{ token: string }>(
          'POST',
          `/api/homes/${home.body.id}/invitations`,
          {
            body: { email: rawInviteEmail, role: 'admin' },
            cookie: owner.cookie,
          },
        )
        expect(invite.status).toBe(201)

        // 3. User registers with standard lowercase email
        const invitee = await authCall('POST', '/api/auth/register', {
          body: {
            email: baseEmail.toLowerCase(),
            password: 'Password123!',
            name: 'Normalized Invitee',
          },
        })

        // 4. Invitee accepts invitation (MUST SUCCEED 200 due to normalized matching)
        const accept = await authCall('POST', `/api/invitations/${invite.body.token}/accept`, {
          cookie: invitee.cookie,
        })
        expect(accept.status).toBe(200)
        expect(accept.body).toEqual({
          success: true,
          homeId: home.body.id,
          role: 'admin',
        })
      })

      it('leaves invitation reusable by the intended account after a failed acceptance by another account', async () => {
        // 1. Owner registers and creates home
        const owner = await authCall('POST', '/api/auth/register', {
          body: {
            email: `owner_reusable_${Date.now()}@example.com`,
            password: 'Password123!',
            name: 'Home Owner',
          },
        })
        const home = await authCall<{ id: string }>('POST', '/api/homes', {
          body: { name: 'Reusable Invite Home' },
          cookie: owner.cookie,
        })

        // 2. Intended recipient registers
        const intendedEmail = `intended_${Date.now()}@example.com`
        const intendedUser = await authCall('POST', '/api/auth/register', {
          body: {
            email: intendedEmail,
            password: 'Password123!',
            name: 'Intended User',
          },
        })

        // 3. Unintended user (attacker) registers
        const intruder = await authCall('POST', '/api/auth/register', {
          body: {
            email: `intruder_${Date.now()}@example.com`,
            password: 'Password123!',
            name: 'Intruder User',
          },
        })

        // 4. Owner creates invitation for intended user
        const invite = await authCall<{ token: string }>(
          'POST',
          `/api/homes/${home.body.id}/invitations`,
          {
            body: { email: intendedEmail, role: 'member' },
            cookie: owner.cookie,
          },
        )
        expect(invite.status).toBe(201)

        // 5. Intruder tries to accept first -> fails with 403
        const intruderAccept = await authCall(
          'POST',
          `/api/invitations/${invite.body.token}/accept`,
          {
            cookie: intruder.cookie,
          },
        )
        expect(intruderAccept.status).toBe(403)

        // 6. Intended recipient accepts the same token -> must succeed with 200
        const legitimateAccept = await authCall(
          'POST',
          `/api/invitations/${invite.body.token}/accept`,
          {
            cookie: intendedUser.cookie,
          },
        )
        expect(legitimateAccept.status).toBe(200)
        expect(legitimateAccept.body).toEqual({
          success: true,
          homeId: home.body.id,
          role: 'member',
        })

        // 7. Subsequent attempt on now-accepted token returns 404 (already accepted)
        const duplicateAccept = await authCall(
          'POST',
          `/api/invitations/${invite.body.token}/accept`,
          {
            cookie: intendedUser.cookie,
          },
        )
        expect(duplicateAccept.status).toBe(404)
      })
    })
  })
})
