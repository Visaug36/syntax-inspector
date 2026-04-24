import { parse } from '@babel/parser'

// Babel's errorRecovery recovers only from a narrow set of errors and throws
// on everything else. To surface MULTIPLE errors per file, we retry: when
// parse throws, record the diagnostic, mask the offending line with whitespace,
// and re-parse. The loop bounds itself with MAX_ERRORS and stops if the error
// location doesn't advance (prevents infinite loops on unrecoverable code).
const MAX_ERRORS = 20

export function check(code) {
  if (!code.trim()) return []
  return runCheck(code, ['jsx'], 'Syntax')
}

export function runCheck(code, plugins, type) {
  const errors = []
  let working = code
  let lastKey = null

  for (let iter = 0; iter < MAX_ERRORS; iter++) {
    try {
      const ast = parse(working, {
        sourceType:    'module',
        plugins,
        errorRecovery: true,
        strictMode:    false,
        allowReturnOutsideFunction:  true,
        allowAwaitOutsideFunction:   true,
        allowImportExportEverywhere: true,
      })
      for (const err of (ast.errors ?? [])) errors.push(toDiag(err, type))
      break
    } catch (err) {
      const diag = toDiag(err, type)
      const key = `${diag.line}:${diag.column}`
      if (key === lastKey) break // no progress → bail
      lastKey = key
      errors.push(diag)
      working = maskLine(working, diag.line)
      if (working === null) break
    }
  }

  return dedupe(errors)
}

function maskLine(code, lineNum) {
  const lines = code.split('\n')
  if (lineNum < 1 || lineNum > lines.length) return null
  lines[lineNum - 1] = ' '.repeat(lines[lineNum - 1].length)
  return lines.join('\n')
}

// Dedupe exact repeats AND collapse consecutive cascading errors that share a
// message template (e.g. "Unexpected token, expected '{'" repeating 4 times
// as the parser flails past one missing brace).
function dedupe(errors) {
  const out = []
  const seen = new Set()
  let lastMsg = null
  for (const e of errors) {
    const k = `${e.line}:${e.column}:${e.message}`
    if (seen.has(k)) continue
    seen.add(k)
    if (e.message === lastMsg) continue
    out.push(e)
    lastMsg = e.message
  }
  return out
}

function toDiag(err, type) {
  const loc = err.loc ?? { line: 1, column: 0 }
  return {
    line:     loc.line   ?? 1,
    column:   loc.column ?? 0,
    severity: 'error',
    message:  (err.message || String(err)).replace(/\s*\(\d+:\d+\)\s*$/, ''),
    type,
  }
}
