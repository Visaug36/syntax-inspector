import * as csstree from 'css-tree'

// css-tree's parser is forgiving — it auto-closes braces and silently
// recovers from many malformed declarations. To catch real structural
// bugs we layer a hand-rolled balance check on top.
//
// css-tree also doesn't know modern CSS (Nesting, @container, @layer,
// @scope, @starting-style, etc.) and emits noisy errors on those. When
// we detect those features we suppress css-tree's diagnostics and rely
// on the brace-balance check alone.
const MODERN_AT_RULES = /@(container|layer|scope|starting-style|property|when)\b/

export function check(code) {
  if (!code.trim()) return []
  const errors = []
  const usesModernAtRules = MODERN_AT_RULES.test(code)
  const usesNesting       = /^\s*&|^\s*[.#][\w-]+\s*\{[^}]*[.#]/m.test(code) // heuristic

  // Skip css-tree entirely on modern syntax — it'll false-positive.
  if (!usesModernAtRules && !usesNesting) {
    try {
      csstree.parse(code, {
        parseAtrulePrelude: true,
        parseRulePrelude:   true,
        parseValue:         true,
        onParseError(err) { errors.push(toDiag(err)) },
      })
    } catch (err) {
      errors.push(toDiag(err))
    }
  }

  // Brace + comment balance — css-tree won't flag `.foo { color: red` (no
  // closing `}`) or `/* comment` (no closing `*/`).
  const balance = checkStructuralBalance(code)
  if (balance) errors.push(balance)

  return errors
}

function toDiag(err) {
  return {
    line:     err.line ?? 1,
    column:   Math.max(0, (err.column ?? 1) - 1),
    severity: 'error',
    message:  err.message,
    type:     'Parse',
  }
}

// Walk the source counting { and }, plus tracking comment open/close. Skips
// content inside strings and /* */ comments. Returns the first structural
// imbalance found (unclosed/extra brace OR unclosed comment).
function checkStructuralBalance(code) {
  let depth = 0
  let openLine = 1, openCol = 0
  let commentOpenLine = 1, commentOpenCol = 0
  let line = 1, col = 0
  let inStr = null      // '"' or "'" when inside a string
  let inComment = false

  for (let i = 0; i < code.length; i++) {
    const c = code[i]
    const n = code[i + 1] ?? ''

    if (c === '\n') { line++; col = 0; continue }
    col++

    if (inComment) {
      if (c === '*' && n === '/') { inComment = false; i++; col++ }
      continue
    }
    if (inStr) {
      if (c === '\\') { i++; col++; continue }
      if (c === inStr) inStr = null
      continue
    }
    if (c === '/' && n === '*') {
      inComment = true
      commentOpenLine = line
      commentOpenCol  = col - 1
      i++; col++
      continue
    }
    if (c === '"' || c === "'") { inStr = c; continue }

    if (c === '{') {
      if (depth === 0) { openLine = line; openCol = col - 1 }
      depth++
    } else if (c === '}') {
      if (depth === 0) {
        return {
          line, column: col - 1, severity: 'error',
          message: "Unexpected '}' — no matching '{'",
          type: 'Parse',
        }
      }
      depth--
    }
  }

  if (inComment) {
    return {
      line:    commentOpenLine,
      column:  commentOpenCol,
      severity:'error',
      message: "'/*' comment was never closed",
      type:    'Parse',
    }
  }
  if (depth > 0) {
    return {
      line: openLine, column: openCol, severity: 'error',
      message: `'{' was never closed`,
      type: 'Parse',
    }
  }
  return null
}
