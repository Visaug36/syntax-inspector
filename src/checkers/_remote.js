// Backend-driven syntax checking for compiled languages (C++, Java, Ruby)
// where browser-only parsers can't match real compiler error messages.
//
// VITE_SANDBOX_URL points at a deployed code-sandbox instance exposing /check.
// In dev (no env var) we hit localhost:4000 so `npm start` in code-sandbox
// powers local development without changes.
const BASE_URL = import.meta.env.VITE_SANDBOX_URL || 'http://localhost:4000'

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
