// Backend-driven syntax checking for compiled languages (C++, Java, Ruby)
// where browser-only parsers can't match real compiler error messages.
//
// Resolution order:
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

export async function checkRemote(language, code) {
  if (!code.trim()) return []

  const cacheKey = `${language}:${code}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  try {
    const res = await fetch(`${BASE_URL}/check`, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ language, code }),
    })

    if (!res.ok) {
      return [{
        line: 1, column: 0, severity: 'error',
        message: `Sandbox unreachable (HTTP ${res.status}). The backend may be sleeping — retry in a few seconds.`,
        type: 'Network',
      }]
    }

    const { diagnostics = [] } = await res.json()

    if (cache.size > 64) cache.delete(cache.keys().next().value)
    cache.set(cacheKey, diagnostics)

    return diagnostics
  } catch (err) {
    return [{
      line: 1, column: 0, severity: 'error',
      message: `Cannot reach syntax server: ${err.message}. Working offline — try refreshing.`,
      type: 'Network',
    }]
  }
}

export const REMOTE_LANGUAGES = ['cpp', 'java', 'ruby']
