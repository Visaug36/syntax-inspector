import { Parser } from 'node-sql-parser'

let parser
function getParser() {
  if (!parser) parser = new Parser()
  return parser
}

export function check(code) {
  if (!code.trim()) return []
  try {
    // PostgreSQL is the broadest dialect for educational use — accepts
    // INTERVAL '7 days', RETURNING, ::cast, etc. that MySQL default rejects.
    getParser().parse(code, { database: 'PostgreSQL' })
    return []
  } catch (err) {
    const raw   = (err.message || String(err)).split('\n')[0]
    const lineM = raw.match(/Line[:\s]+(\d+)/i) || raw.match(/line (\d+)/i)
    const colM  = raw.match(/col(?:umn)?[:\s]+(\d+)/i)

    return [{
      line:     lineM ? parseInt(lineM[1]) : 1,
      column:   colM  ? Math.max(0, parseInt(colM[1]) - 1) : 0,
      severity: 'error',
      message:  humanizeSqlMessage(raw),
      type:     'Parse',
    }]
  }
}

// node-sql-parser surfaces PEG.js error messages like:
//   `Expected "#", "--", "/*", ":=", "=", or [ \t\n\r] but "u" found`
// which is a wall of low-level alternatives that confuses students. Trim
// to the first 3 alternatives + the "found" token, in plain English.
export function humanizeSqlMessage(raw) {
  const m = raw.match(/^Expected\s+(.+?)\s+but\s+(.+?)(?:\s+found)?\s*$/i)
  if (!m) return raw
  const wantedRaw = m[1]
  const found     = m[2].trim().replace(/\s+found$/i, '')

  // PEG alternatives are comma-separated, possibly with " or " before last
  const alternatives = wantedRaw
    .replace(/,?\s+or\s+/g, ', ')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  // Drop low-signal whitespace/comment alternatives that PEG always lists
  const NOISE = new Set(['"#"', '"--"', '"/*"', '[ \\t\\n\\r]', '" "', '"\\t"'])
  const meaningful = alternatives.filter(a => !NOISE.has(a))

  const top = meaningful.slice(0, 3).join(', ')
  const more = meaningful.length > 3 ? ` (or ${meaningful.length - 3} other tokens)` : ''
  return `Expected ${top || alternatives[0]}${more} but found ${found}`
}
