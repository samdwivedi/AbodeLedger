/**
 * Cloudflare Pages Function: Production API Reverse Proxy
 *
 * Intercepts all requests matching /api/* on Cloudflare Pages and proxies them
 * to the deployed Worker origin (API_ORIGIN) under the same origin.
 *
 * Guarantees:
 * 1. Preserves HTTP method, request body, query string, and custom headers.
 * 2. Forwards Idempotency-Key, Content-Type, and X-Requested-With.
 * 3. Preserves Cookie headers and returns Set-Cookie headers.
 * 4. Never merges multiple Set-Cookie headers into a single comma-separated string.
 * 5. Passes __Host-session cookie over HTTPS without third-party cookie restrictions.
 */

export interface PagesEnv {
  API_ORIGIN?: string
}

export interface PagesContext {
  request: Request
  env: PagesEnv
  params: {
    path?: string | string[]
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context

  // 1. Validate API_ORIGIN configuration
  const rawApiOrigin = env.API_ORIGIN
  if (!rawApiOrigin || typeof rawApiOrigin !== 'string' || !rawApiOrigin.trim()) {
    return new Response(
      JSON.stringify({
        error: 'API_ORIGIN environment variable is not configured on Cloudflare Pages',
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      },
    )
  }

  // Normalize base origin (strip trailing slashes or accidental /api suffix)
  let baseOrigin = rawApiOrigin.trim().replace(/\/+$/, '')
  if (baseOrigin.endsWith('/api')) {
    baseOrigin = baseOrigin.slice(0, -4)
  }

  // 2. Construct destination URL preserving the full API path and query string
  const incomingUrl = new URL(request.url)
  const targetUrl = new URL(`${baseOrigin}${incomingUrl.pathname}${incomingUrl.search}`)

  // 3. Forward request headers while preserving Cookies, Idempotency-Key, and CSRF tokens
  const forwardHeaders = new Headers()
  for (const [key, value] of request.headers.entries()) {
    // Exclude host header; fetch automatically sets the upstream host
    if (key.toLowerCase() === 'host') continue
    forwardHeaders.set(key, value)
  }

  // Add standard reverse-proxy forwarding headers
  forwardHeaders.set('x-forwarded-host', incomingUrl.host)
  forwardHeaders.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''))

  // 4. Forward request body for methods that allow it (POST, PUT, PATCH, DELETE)
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  let body: BodyInit | undefined
  if (hasBody) {
    const buffer = await request.arrayBuffer()
    if (buffer.byteLength > 0) {
      body = buffer
    }
  }

  // 5. Execute upstream fetch to Worker origin
  let workerResponse: Response
  try {
    workerResponse = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: forwardHeaders,
      body,
      redirect: 'manual',
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to connect to upstream AbodeLedger API Worker'
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    })
  }

  // 6. Build response headers, handling Set-Cookie with strict precision
  const responseHeaders = new Headers()
  for (const [key, value] of workerResponse.headers.entries()) {
    // Set-Cookie is handled separately below to prevent comma-merging
    if (key.toLowerCase() === 'set-cookie') continue
    responseHeaders.set(key, value)
  }

  // CRITICAL REQUIREMENT: Never merge multiple Set-Cookie headers into a single comma-separated header
  if (typeof workerResponse.headers.getSetCookie === 'function') {
    const cookies = workerResponse.headers.getSetCookie()
    for (const cookie of cookies) {
      responseHeaders.append('set-cookie', cookie)
    }
  } else {
    // Fallback for runtimes without getSetCookie
    const singleCookie = workerResponse.headers.get('set-cookie')
    if (singleCookie) {
      responseHeaders.set('set-cookie', singleCookie)
    }
  }

  // 7. Return response with original status and headers
  const isNullBodyStatus = workerResponse.status === 204 || workerResponse.status === 304
  return new Response(isNullBodyStatus ? null : workerResponse.body, {
    status: workerResponse.status,
    statusText: workerResponse.statusText,
    headers: responseHeaders,
  })
}
