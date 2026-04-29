// Backend-driven syntax checking for compiled languages (Python, C++, Java,
// Ruby) where browser-only parsers can't match real compiler error messages.
//
// Resolution order for the backend URL:
//   1. ?backend=<url> URL param   — runtime override, useful for QA / forks
//   2. VITE_SANDBOX_URL build env — baked into production bundle by CI
//   3. localhost:4000              — dev default (matches code-sandbox `npm start`)
function resolveBaseUrl() {
  if (typeof window !== 'undefined') {
    const fromQuery = new URLSearchParams(window.location.search).get('backend')
    if (fromQuery) return fromQuery.replace(/\/$/, '')
  }
  return (import.meta.env.VITE_SANDBOX_URL || 'http://localhost:4000').replace(/\/$/, '')
}
const BASE_URL = resolveBaseUrl()

const cache = new Map() // code → diagnostics, capped to ~64 entries

const REQUEST_TIMEOUT_MS = 45_000  // long enough for Render cold start
const RETRY_DELAY_MS     = 1_500   // single retry on transient network failure

export const REMOTE_LANGUAGES = ['cpp', 'java', 'ruby', 'python']

export async function checkRemote(language, code) {
  if (!code.trim()) return []

  const cacheKey = `${language}:${code}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  const result = await fetchWithRetry(language, code)
  if (result.diagnostics) {
    if (cache.size > 64) cache.delete(cache.keys().next().value)
    cache.set(cacheKey, result.diagnostics)
  }
  return result.diagnostics ?? result.error
}

async function fetchWithRetry(language, code) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      const res = await fetch(`${BASE_URL}/check`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ language, code }),
        signal:  controller.signal,
      })
      clearTimeout(timer)

      // Rate limited — surface the retry-after time, do NOT auto-retry
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}))
        return {
          error: [{
            line: 1, column: 0, severity: 'error',
            message: data.hint || 'Rate limited — slow down a bit and try again.',
            type: 'Network',
          }],
        }
      }

      if (!res.ok) {
        // 5xx — try once more after a beat
        if (res.status >= 500 && attempt === 1) {
          await sleep(RETRY_DELAY_MS)
          continue
        }
        return {
          error: [{
            line: 1, column: 0, severity: 'error',
            message: `Sandbox unreachable (HTTP ${res.status}). The backend may be sleeping — retry in a few seconds.`,
            type: 'Network',
          }],
        }
      }

      const { diagnostics = [] } = await res.json()
      return { diagnostics }
    } catch (err) {
      // Network error — retry once
      if (attempt === 1 && err.name !== 'AbortError') {
        await sleep(RETRY_DELAY_MS)
        continue
      }
      const isTimeout = err.name === 'AbortError'
      return {
        error: [{
          line: 1, column: 0, severity: 'error',
          message: isTimeout
            ? 'Syntax server timed out. Try again in a moment.'
            : `Cannot reach syntax server: ${err.message}. Working offline — try refreshing.`,
          type: 'Network',
        }],
      }
    }
  }
  return { error: [{ line: 1, column: 0, severity: 'error', message: 'Unknown network error', type: 'Network' }] }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
