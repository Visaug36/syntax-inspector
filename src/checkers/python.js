/**
 * Custom Python 3 syntax checker.
 *
 * Catches in order of likelihood:
 *   1. Mixed tabs/spaces indentation
 *   2. Unmatched brackets/parens/braces
 *   3. Unclosed string literals (incl. triple-quoted)
 *   4. Missing colon after block-introducing keywords (if/for/def/class/…)
 *   5. Single = used where == is expected (if/while/elif conditions)
 *
 * Why not filbert: it targets Python 2 and fails on ~every Python 3 program.
 * We walk the source once, tracking bracket/string state so heuristic checks
 * can skip continuation lines that look like errors but aren't.
 */

const BLOCK_KWS = /^(\s*)(if|elif|else|for|while|def|class|try|except|finally|with|async\s+def|async\s+for|async\s+with)\b(.*)$/

export function check(code) {
  if (!code.trim()) return []
  const errors = []
  const lines  = code.split('\n')

  // ── 1. Mixed tabs and spaces ────────────────────────────────────────────
  let hasTabs = false, hasSpaces = false
  for (const ln of lines) {
    const m = ln.match(/^(\s+)/)
    if (!m) continue
    if (m[1].includes('\t')) hasTabs = true
    if (m[1].includes(' '))  hasSpaces = true
  }
  if (hasTabs && hasSpaces) {
    errors.push({
      line: 1, column: 0, severity: 'error',
      message: 'TabError: inconsistent use of tabs and spaces in indentation',
      type: 'Structural',
    })
  }

  // ── 2. Brackets + strings (single pass with per-line depth record) ──────
  const opens   = { '(': ')', '[': ']', '{': '}' }
  const closeOf = { ')': '(', ']': '[', '}': '{' }
  const stack   = []
  /** bracketDepthAtLineEnd[i] = stack.length after processing line i */
  const depthAtEnd = new Array(lines.length).fill(0)

  let inTripleDQ = false, inTripleSQ = false
  let inDoubleQ  = false, inSingleQ  = false

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    if (!inTripleDQ && !inTripleSQ) { inDoubleQ = false; inSingleQ = false }

    let i = 0
    while (i < line.length) {
      const ch   = line[i]
      const rest = line.slice(i)

      if (!inTripleDQ && !inTripleSQ && !inDoubleQ && !inSingleQ) {
        if (ch === '#') break
        if (rest.startsWith('"""')) { inTripleDQ = true;  i += 3; continue }
        if (rest.startsWith("'''")) { inTripleSQ = true;  i += 3; continue }
        if (ch === '"')             { inDoubleQ  = true;  i++;    continue }
        if (ch === "'")             { inSingleQ  = true;  i++;    continue }

        if (opens[ch]) {
          stack.push({ ch, line: li + 1, col: i })
        } else if (closeOf[ch]) {
          const top = stack[stack.length - 1]
          if (!top || top.ch !== closeOf[ch]) {
            errors.push({
              line: li + 1, column: i, severity: 'error',
              message: `SyntaxError: unmatched '${ch}'`,
              type: 'Syntax',
            })
          } else {
            stack.pop()
          }
        }
      } else if (inTripleDQ) {
        if (rest.startsWith('"""')) { inTripleDQ = false; i += 3; continue }
      } else if (inTripleSQ) {
        if (rest.startsWith("'''")) { inTripleSQ = false; i += 3; continue }
      } else if (inDoubleQ) {
        if (ch === '\\') { i += 2; continue }
        if (ch === '"')  inDoubleQ = false
      } else if (inSingleQ) {
        if (ch === '\\') { i += 2; continue }
        if (ch === "'")  inSingleQ = false
      }

      i++
    }

    // Unclosed single-line string at end of line (and no line-continuation)
    if (!inTripleDQ && !inTripleSQ && (inDoubleQ || inSingleQ)) {
      const trimmed = line.trimEnd()
      if (!trimmed.endsWith('\\')) {
        errors.push({
          line: li + 1, column: line.length, severity: 'error',
          message: `SyntaxError: EOL while scanning string literal`,
          type: 'Syntax',
        })
        inDoubleQ = false
        inSingleQ = false
      }
    }

    depthAtEnd[li] = stack.length
  }

  // Unclosed brackets
  for (const b of stack) {
    errors.push({
      line: b.line, column: b.col, severity: 'error',
      message: `SyntaxError: '${b.ch}' was never closed`,
      type: 'Syntax',
    })
  }

  // Unclosed triple quotes
  if (inTripleDQ) {
    errors.push({
      line: lines.length, column: 0, severity: 'error',
      message: 'SyntaxError: EOF while scanning triple-quoted string literal (""")',
      type: 'Syntax',
    })
  }
  if (inTripleSQ) {
    errors.push({
      line: lines.length, column: 0, severity: 'error',
      message: "SyntaxError: EOF while scanning triple-quoted string literal (''')",
      type: 'Syntax',
    })
  }

  // ── 3. Missing colon after block-introducing keywords ─────────────────────
  // Only flag when the line is "at depth 0" at its end (no open brackets
  // carrying onto the next line), not inside a string, and not using
  // backslash line-continuation.
  for (let li = 0; li < lines.length; li++) {
    if (depthAtEnd[li] > 0) continue
    // Skip lines that are part of a multi-line bracket group that opened earlier
    if (li > 0 && depthAtEnd[li - 1] > 0) continue

    const rawLine = lines[li]
    // Strip inline comment (respecting strings is hard; this is heuristic)
    const noComment = stripInlineComment(rawLine)
    const trimmed   = noComment.trimEnd()
    if (!trimmed.trim()) continue
    if (trimmed.endsWith('\\')) continue

    const m = trimmed.match(BLOCK_KWS)
    if (!m) continue

    const kw    = m[2].replace(/\s+/g, ' ')
    const lastCh = trimmed[trimmed.length - 1]

    if (lastCh !== ':') {
      errors.push({
        line: li + 1,
        column: trimmed.length,
        severity: 'error',
        message: `SyntaxError: expected ':' after '${kw}' statement`,
        type: 'Syntax',
      })
    }

    // ── 4. Single '=' in if/while/elif condition (common typo) ────────────
    // Matches patterns like `if x = 5:` — real Python requires `==`.
    if (/^(if|elif|while)\b/.test(kw)) {
      // Strip the keyword and trailing colon, scan for a bare `=`
      const body = trimmed.replace(BLOCK_KWS, '$3').replace(/:\s*$/, '')
      if (hasBareAssignment(body)) {
        errors.push({
          line: li + 1,
          column: Math.max(0, trimmed.indexOf('=')),
          severity: 'error',
          message: `SyntaxError: invalid syntax — did you mean '==' instead of '='?`,
          type: 'Syntax',
        })
      }
    }
  }

  return errors
}

function stripInlineComment(line) {
  let inD = false, inS = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '\\') { i++; continue }
    if (!inS && c === '"')  inD = !inD
    else if (!inD && c === "'") inS = !inS
    else if (!inD && !inS && c === '#') return line.slice(0, i)
  }
  return line
}

// Detect `=` used as assignment (not == / >= / <= / != / walrus :=) inside
// what's supposed to be a conditional expression.
function hasBareAssignment(s) {
  let inD = false, inS = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const p = s[i - 1] ?? ''
    const n = s[i + 1] ?? ''
    if (c === '\\') { i++; continue }
    if (!inS && c === '"')  { inD = !inD; continue }
    if (!inD && c === "'")  { inS = !inS; continue }
    if (inD || inS) continue
    if (c === '=' && p !== '=' && p !== '<' && p !== '>' && p !== '!' && p !== ':' && n !== '=') {
      return true
    }
  }
  return false
}
