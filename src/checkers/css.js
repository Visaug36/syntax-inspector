import * as csstree from 'css-tree'

// css-tree's parser is forgiving — it auto-closes braces and silently
// recovers from many malformed declarations. To catch real structural
// bugs we layer a hand-rolled balance check on top.
export function check(code) {
  if (!code.trim()) return []
  const errors = []

  try {
    csstree.parse(code, {
      parseAtrulePrelude: true,
      parseRulePrelude:   true,
      parseValue:         true,
      onParseError(err) {
        errors.push(toDiag(err))
      },
    })
  } catch (err) {
    errors.push(toDiag(err))
  }

  // Brace balance — css-tree won't flag `.foo { color: red` (no closing })
  const balance = checkBraceBalance(code)
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

// Walk the source counting { and }, skipping inside strings and /* */ comments.
// Report the first unbalanced position.
function checkBraceBalance(code) {
  let depth = 0
  let openLine = 1, openCol = 0
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
    if (c === '/' && n === '*') { inComment = true; i++; col++; continue }
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

  if (depth > 0) {
    return {
      line: openLine, column: openCol, severity: 'error',
      message: `'{' was never closed`,
      type: 'Parse',
    }
  }
  return null
}
