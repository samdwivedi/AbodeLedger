import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { onRequest as pagesProxyHandler } from '../../web/functions/api/[[path]]'

describe('Production API Routing, CORS Policy & Cookie Security', () => {
  describe('CORS Policy Enforcement', () => {
    it('allows the exact production Cloudflare Pages origin with credentials', async () => {
      const response = await exports.default.fetch(
        new Request('http://localhost/api/health', {
          method: 'GET',
          headers: {
            Origin: 'https://abodeledger.pages.dev',
          },
        }),
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://abodeledger.pages.dev',
      )
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    })

    it('allows local Vite development origin (http://localhost:5173)', async () => {
      const response = await exports.default.fetch(
        new Request('http://localhost/api/health', {
          method: 'GET',
          headers: {
            Origin: 'http://localhost:5173',
          },
        }),
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    })

    it('allows local loopback origin (http://127.0.0.1:8787)', async () => {
      const response = await exports.default.fetch(
        new Request('http://localhost/api/health', {
          method: 'GET',
          headers: {
            Origin: 'http://127.0.0.1:8787',
          },
        }),
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:8787')
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    })

    it('rejects unauthorized third-party origins (no Access-Control-Allow-Origin header)', async () => {
      const response = await exports.default.fetch(
        new Request('http://localhost/api/health', {
          method: 'GET',
          headers: {
            Origin: 'https://unauthorized-malicious-site.com',
          },
        }),
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    it('answers pre-flight OPTIONS requests with 204 and allowed headers', async () => {
      const response = await exports.default.fetch(
        new Request('http://localhost/api/homes', {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://abodeledger.pages.dev',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type, Idempotency-Key, X-Requested-With',
          },
        }),
      )

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://abodeledger.pages.dev',
      )
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
      const allowedHeaders = response.headers.get('Access-Control-Allow-Headers') || ''
      expect(allowedHeaders).toContain('Content-Type')
      expect(allowedHeaders).toContain('Idempotency-Key')
      expect(allowedHeaders).toContain('X-Requested-With')
    })
  })

  describe('Cookie Security & __Host-session Enforcement', () => {
    it('sets __Host-session cookie over HTTPS with Secure and HttpOnly flags and no Domain', async () => {
      const email = `secure_cookie_${Date.now()}@example.com`
      const response = await exports.default.fetch(
        new Request('https://api.abodeledger.com/api/auth/register', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password: 'StrongPassword123!',
            name: 'Cookie User',
          }),
        }),
      )

      expect(response.status).toBe(201)
      const setCookie = response.headers.get('set-cookie') || ''
      expect(setCookie).toContain('__Host-session=')
      expect(setCookie.toLowerCase()).toContain('secure')
      expect(setCookie.toLowerCase()).toContain('httponly')
      expect(setCookie.toLowerCase()).toContain('samesite=lax')
      expect(setCookie.toLowerCase()).toContain('path=/')
      // RFC 6265bis: __Host- prefix MUST NOT have a Domain attribute
      expect(setCookie.toLowerCase()).not.toContain('domain=')
    })

    it('sets __Host-session when x-forwarded-proto is https', async () => {
      const email = `forwarded_cookie_${Date.now()}@example.com`
      const response = await exports.default.fetch(
        new Request('http://localhost/api/auth/register', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-proto': 'https',
          },
          body: JSON.stringify({
            email,
            password: 'StrongPassword123!',
            name: 'Forwarded User',
          }),
        }),
      )

      expect(response.status).toBe(201)
      const setCookie = response.headers.get('set-cookie') || ''
      expect(setCookie).toContain('__Host-session=')
      expect(setCookie.toLowerCase()).toContain('secure')
    })
  })

  describe('Cloudflare Pages Function Reverse Proxy Unit Tests', () => {
    it('returns 500 JSON if API_ORIGIN is not configured', async () => {
      const req = new Request('https://abodeledger.pages.dev/api/health')
      const res = await pagesProxyHandler({
        request: req,
        env: {},
        params: { path: ['health'] },
      })

      expect(res.status).toBe(500)
      const body = (await res.json()) as { error: string }
      expect(body.error).toContain('API_ORIGIN')
    })

    it('proxies requests and preserves Set-Cookie without comma merging', async () => {
      // Mock upstream worker that returns multiple Set-Cookie headers
      const originalFetch = globalThis.fetch
      const mockSetCookies = [
        '__Host-session=abc123token; Path=/; Secure; HttpOnly; SameSite=Lax',
        'session=; Path=/; Max-Age=0; HttpOnly',
      ]

      globalThis.fetch = async (input, init) => {
        expect(input.toString()).toBe('https://api.abodeledger.com/api/test?filter=active')
        expect(init?.method).toBe('POST')
        const headers = new Headers(init?.headers)
        expect(headers.get('idempotency-key')).toBe('test-key-123')
        expect(headers.get('x-requested-with')).toBe('XMLHttpRequest')

        const resHeaders = new Headers()
        resHeaders.set('content-type', 'application/json')
        for (const cookie of mockSetCookies) {
          resHeaders.append('set-cookie', cookie)
        }

        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: resHeaders,
        })
      }

      try {
        const req = new Request('https://abodeledger.pages.dev/api/test?filter=active', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'test-key-123',
            'X-Requested-With': 'XMLHttpRequest',
            Cookie: '__Host-session=existing-session-token',
          },
          body: JSON.stringify({ action: 'test' }),
        })

        const res = await pagesProxyHandler({
          request: req,
          env: { API_ORIGIN: 'https://api.abodeledger.com' },
          params: { path: ['test'] },
        })

        expect(res.status).toBe(200)

        // Verify that getSetCookie returns both cookies individually
        const returnedCookies = res.headers.getSetCookie()
        expect(returnedCookies.length).toBe(2)
        expect(returnedCookies[0]).toContain('__Host-session=abc123token')
        expect(returnedCookies[1]).toContain('Max-Age=0')
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })
})
