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
      // Also drop semantic errors (already-declared identifiers, etc.) —
      // those aren't syntax bugs, and students learning syntax shouldn't
      // see "Identifier 'x' has already been declared" mixed in.
      const iterDiags = (ast.errors ?? [])
        .map(e => toDiag(e, type))
        .filter(d => !isSemanticError(d.message))
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

  // Defense in depth: Babel occasionally accepts unbalanced brackets in
  // errorRecovery mode (esp. inside template literals or regex). If the
  // checker came up clean but a hand-rolled bracket scan disagrees, surface
  // the imbalance so students see it.
  if (errors.length === 0) {
    const imbalance = scanBracketBalance(code)
    if (imbalance) errors.push(imbalance)
  }

  return dedupeExact(errors)
}

// String/comment/template/regex aware bracket-balance scan. Used only as a
// fallback — Babel handles the common case correctly.
function scanBracketBalance(code) {
  const stack = []
  const opener = { ')': '(', ']': '[', '}': '{' }
  const opens  = { '(': ')', '[': ']', '{': '}' }
  let line = 1, col = 0
  let mode = 'code' // code | str-double | str-single | str-template | comment-line | comment-block | regex
  let templateDepth = 0 // nested ${...} inside template literals

  for (let i = 0; i < code.length; i++) {
    const c = code[i]
    const n = code[i + 1] ?? ''
    if (c === '\n') { line++; col = 0; continue }
    col++

    if (mode === 'comment-line') { if (c === '\n') mode = 'code'; continue }
    if (mode === 'comment-block') {
      if (c === '*' && n === '/') { mode = 'code'; i++; col++ }
      continue
    }
    if (mode === 'str-double') {
      if (c === '\\') { i++; col++; continue }
      if (c === '"')  mode = 'code'
      continue
    }
    if (mode === 'str-single') {
      if (c === '\\') { i++; col++; continue }
      if (c === "'")  mode = 'code'
      continue
    }
    if (mode === 'str-template') {
      if (c === '\\') { i++; col++; continue }
      if (c === '`')  mode = 'code'
      else if (c === '$' && n === '{') { mode = 'code'; templateDepth++; stack.push({ ch: '{', line, col, fromTemplate: true }); i++; col++ }
      continue
    }
    if (mode === 'regex') {
      if (c === '\\') { i++; col++; continue }
      if (c === '/')  mode = 'code'
      continue
    }

    // mode === 'code'
    if (c === '/' && n === '/') { mode = 'comment-line'; i++; col++; continue }
    if (c === '/' && n === '*') { mode = 'comment-block'; i++; col++; continue }
    if (c === '"')  { mode = 'str-double'; continue }
    if (c === "'")  { mode = 'str-single'; continue }
    if (c === '`')  { mode = 'str-template'; continue }

    if (opens[c]) {
      stack.push({ ch: c, line, col: col - 1 })
    } else if (opener[c]) {
      const top = stack.pop()
      if (!top || top.ch !== opener[c]) {
        return {
          line, column: col - 1, severity: 'error',
          message: `Unexpected '${c}' — no matching '${opener[c]}'`,
          type: 'Syntax',
        }
      }
      if (c === '}' && top.fromTemplate) {
        templateDepth--
        mode = 'str-template'
      }
    }
  }

  if (stack.length) {
    const t = stack[0]
    return {
      line: t.line, column: t.col, severity: 'error',
      message: `'${t.ch}' was never closed`,
      type: 'Syntax',
    }
  }
  return null
}

// Babel surfaces a few binding/scope errors via errorRecovery that aren't
// syntax issues. Keep them out of student-facing diagnostics.
const SEMANTIC_PATTERNS = [
  /already been declared/i,
  /Cannot find module/i,
  /Cannot redeclare block-scoped/i,
]
function isSemanticError(msg) {
  return SEMANTIC_PATTERNS.some(rx => rx.test(msg))
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
