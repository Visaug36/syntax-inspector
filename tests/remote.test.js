import { describe, it, beforeEach, afterEach, vi } from 'vitest'
import { checkRemote } from '../src/checkers/_remote.js'

// Mock the fetch API for every test. Each test sets up the response it
// expects; afterEach restores the global. This validates the request
// shape, retry behavior, timeout handling, and 429 semantics — all of
// which are pure-frontend concerns we can test without booting the
// real backend.

let originalFetch

beforeEach(() => {
  originalFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.useRealTimers()
})

function mockResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

describe('checkRemote', () => {
  it('sends POST to /check with language + code', async () => {
    let captured
    globalThis.fetch = vi.fn(async (url, init) => {
      captured = { url, init }
      return mockResponse({ diagnostics: [] })
    })

    await checkRemote('python', 'print("hi")')

    expect(captured.url).toMatch(/\/check$/)
    expect(captured.init.method).toBe('POST')
    expect(captured.init.headers['content-type']).toBe('application/json')
    const body = JSON.parse(captured.init.body)
    expect(body).toEqual({ language: 'python', code: 'print("hi")' })
  })

  it('returns diagnostics from the response on success', async () => {
    globalThis.fetch = vi.fn(async () => mockResponse({
      diagnostics: [{ line: 3, column: 5, severity: 'error', message: 'bad', type: 'Syntax' }],
    }))

    // Use unique code so the in-memory cache doesn't short-circuit
    const d = await checkRemote('python', 'unique-code-success ' + Math.random())
    expect(d).toHaveLength(1)
    expect(d[0].message).toBe('bad')
  })

  it('returns empty diagnostics for empty/whitespace input without hitting fetch', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy

    expect(await checkRemote('python', '')).toEqual([])
    expect(await checkRemote('python', '   \n')).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('surfaces 429 rate-limit responses with the backend hint', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ hint: 'Slow down — 30s wait' }),
    }))

    const d = await checkRemote('python', 'unique-code-429 ' + Math.random())
    expect(d).toHaveLength(1)
    expect(d[0].type).toBe('Network')
    expect(d[0].message).toContain('Slow down')
  })

  it('retries once on 5xx then surfaces error', async () => {
    let attempts = 0
    globalThis.fetch = vi.fn(async () => {
      attempts++
      return mockResponse({}, 503)
    })

    const d = await checkRemote('python', 'unique-code-5xx ' + Math.random())
    // Allow a beat for the retry-delay timer
    expect(attempts).toBe(2)
    expect(d).toHaveLength(1)
    expect(d[0].type).toBe('Network')
  }, 5000)

  it('retries once on network error then surfaces error', async () => {
    let attempts = 0
    globalThis.fetch = vi.fn(async () => {
      attempts++
      throw new Error('TypeError: Failed to fetch')
    })

    const d = await checkRemote('python', 'unique-code-net ' + Math.random())
    expect(attempts).toBe(2)
    expect(d).toHaveLength(1)
    expect(d[0].type).toBe('Network')
    expect(d[0].message).toContain('Cannot reach')
  }, 5000)

  it('caches successful results so duplicate requests skip the network', async () => {
    let calls = 0
    globalThis.fetch = vi.fn(async () => {
      calls++
      return mockResponse({ diagnostics: [{ line: 1, column: 0, severity: 'error', message: 'cached', type: 'Syntax' }] })
    })

    const code = 'unique-cache-test-' + Math.random()
    const d1 = await checkRemote('python', code)
    const d2 = await checkRemote('python', code)

    expect(calls).toBe(1)               // second call hit cache
    expect(d1[0].message).toBe('cached')
    expect(d2[0].message).toBe('cached')
  })
})
