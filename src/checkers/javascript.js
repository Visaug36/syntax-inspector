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
      // Collapse cascade WITHIN this parse iteration only.
      // ast.errors typically contains the parser flailing past one bad token
      // (same message, adjacent positions) — keep just the first.
      const iterDiags = (ast.errors ?? []).map(e => toDiag(e, type))
      errors.push(...collapseCascade(iterDiags))
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

  return dedupeExact(errors)
}

function maskLine(code, lineNum) {
  const lines = code.split('\n')
  if (lineNum < 1 || lineNum > lines.length) return null
  lines[lineNum - 1] = ' '.repeat(lines[lineNum - 1].length)
  return lines.join('\n')
}

// Within one parse iteration, Babel's errorRecovery often emits the same
// message at adjacent positions — that's the parser flailing past a single
// bad token. Keep only the first; the rest are noise.
function collapseCascade(diags) {
  const out = []
  let lastMsg = null
  for (const d of diags) {
    if (d.message === lastMsg) continue
    out.push(d)
    lastMsg = d.message
  }
  return out
}

// Across the full result list, drop only literal (line, col, message) repeats.
// Same message at different lines = different bugs; keep both.
function dedupeExact(errors) {
  const seen = new Set()
  return errors.filter(e => {
    const k = `${e.line}:${e.column}:${e.message}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
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
