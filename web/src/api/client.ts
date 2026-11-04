/**
 * Typed API Client for AbodeLedger
 * Connects to Hono endpoints over Cloudflare Workers
 */

export interface User {
  id: string
  email: string
  name: string
}

export interface Home {
  id: string
  name: string
  createdAt?: string
  memberCount: number
  userRole?: 'owner' | 'admin' | 'member'
  currentMemberId?: string | null
}

export interface Member {
  id: string
  homeId: string
  name: string
  position?: number
}

export interface Share {
  id: string
  billId: string
  memberId: string
  memberName: string
  amountCents: number
  paidAt: string | null
}

export interface Bill {
  id: string
  homeId: string
  title: string
  totalCents: number
  createdAt: string
  shares: Share[]
}

export interface Balance {
  memberId: string
  name: string
  outstandingCents: number
}

export interface Invitation {
  id: string
  homeId: string
  email: string
  role: 'admin' | 'member'
  token: string
  expiresAt: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  // Enforce CSRF defense custom header for all client API requests
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'XMLHttpRequest')
  }

  // Include credentials (HttpOnly session cookies) on all fetch requests
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  })

  let json: unknown
  try {
    json = await response.json()
  } catch {
    json = null
  }

  if (!response.ok) {
    const errorMsg =
      (json as { error?: string })?.error || `Request failed with HTTP status ${response.status}`
    throw new ApiError(errorMsg, response.status, json)
  }

  return json as T
}

export const api = {
  // Authentication
  register: async (email: string, password: string, name: string): Promise<{ user: User }> => {
    return request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    })
  },

  login: async (email: string, password: string): Promise<{ user: User }> => {
    return request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  logout: async (): Promise<void> => {
    await request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    })
  },

  getMe: async (): Promise<User | null> => {
    try {
      const res = await request<{ user: User }>('/api/auth/me')
      return res.user
    } catch {
      return null
    }
  },

  // Invitations
  createInvitation: async (
    homeId: string,
    email: string,
    role: 'admin' | 'member',
  ): Promise<Invitation> => {
    return request<Invitation>(`/api/homes/${homeId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    })
  },

  acceptInvitation: async (
    token: string,
  ): Promise<{ success: boolean; homeId: string; role: string }> => {
    return request<{ success: boolean; homeId: string; role: string }>(
      `/api/invitations/${token}/accept`,
      {
        method: 'POST',
      },
    )
  },

  // Homes
  getHomes: async (): Promise<Home[]> => {
    const res = await request<{ homes: Home[] }>('/api/homes')
    return res.homes || []
  },

  getHome: async (homeId: string): Promise<Home & { members: Member[] }> => {
    return request<Home & { members: Member[] }>(`/api/homes/${homeId}`)
  },

  createHome: async (name: string): Promise<{ id: string; name: string }> => {
    return request<{ id: string; name: string }>('/api/homes', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  },

  // Members
  addMember: async (
    homeId: string,
    name: string,
  ): Promise<{ id: string; homeId: string; name: string }> => {
    return request<{ id: string; homeId: string; name: string }>(`/api/homes/${homeId}/members`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  },

  // Bills
  getBills: async (homeId: string): Promise<Bill[]> => {
    const res = await request<{ bills: Bill[] }>(`/api/homes/${homeId}/bills`)
    return res.bills || []
  },

  createBill: async (homeId: string, title: string, totalCents: number): Promise<Bill> => {
    return request<Bill>(`/api/homes/${homeId}/bills`, {
      method: 'POST',
      body: JSON.stringify({ title, totalCents }),
    })
  },

  // Balances
  getBalances: async (homeId: string): Promise<Balance[]> => {
    const res = await request<{ balances: Balance[] }>(`/api/homes/${homeId}/balances`)
    return res.balances || []
  },

  // Payments
  payShare: async (billId: string, shareId: string, idempotencyKey: string): Promise<Share> => {
    return request<Share>(`/api/bills/${billId}/shares/${shareId}/pay`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    })
  },
}
