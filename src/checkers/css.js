import * as csstree from 'css-tree'

// Two-tier CSS checker:
//
//   1. css-tree (light, ~170 KB chunk) handles classic CSS — fast, well-
//      tested, decent error messages. It's our default path.
//
//   2. lightningcss-wasm (~500 KB chunk + WASM) handles modern syntax
//      css-tree doesn't know: @container, @layer, @scope, @starting-style,
//      native CSS Nesting (& {…}), :has(), etc. Only loaded the first time
//      a CSS file uses one of these — users writing 2010-era CSS never pay
//      for it.
//
// On top of both we run a hand-rolled brace + comment balance pass — both
// parsers tend to auto-recover where students would expect a real error
// (e.g. `/* comment` with no `*/`).
const MODERN_AT_RULES = /@(container|layer|scope|starting-style|property|when)\b/
const NESTING_HINT    = /^\s*&|^\s*[.#][\w-]+\s*\{[^}]*[.#]/m

let lightningPromise = null
async function getLightning() {
  if (lightningPromise) return lightningPromise
  lightningPromise = (async () => {
    const mod = await import('lightningcss-wasm')
    await mod.default() // initialise wasm
    return mod
  })().catch(() => null)
  return lightningPromise
}

export async function check(code) {
  if (!code.trim()) return []
  const errors = []
  const useModern = MODERN_AT_RULES.test(code) || NESTING_HINT.test(code)

  if (useModern) {
    const lightning = await getLightning()
    if (lightning) {
      try {
        // transform() throws on real parse errors; warnings come back on
        // the result object but we ignore them here (this is a *syntax*
        // checker, not a linter).
        lightning.transform({
          filename:  'input.css',
          code:      new TextEncoder().encode(code),
          minify:    false,
          sourceMap: false,
        })
      } catch (err) {
        errors.push(parseLightningError(err))
      }
    }
    // If lightning failed to load, just skip parser-level checks for modern
    // CSS — the brace balance below still catches structural bugs.
  } else {
    try {
      csstree.parse(code, {
        parseAtrulePrelude: true,
        parseRulePrelude:   true,
        parseValue:         true,
        onParseError(err)   { errors.push(toDiag(err)) },
      })
    } catch (err) {
      errors.push(toDiag(err))
    }
  }

  // Always run brace + comment balance — defends against parser leniency.
  const balance = checkStructuralBalance(code)
  if (balance) errors.push(balance)

  return dedupe(errors)
}

function parseLightningError(err) {
  // lightningcss-wasm errors arrive as { message, source, loc:{line,column} }
  // or sometimes a plain string. Normalize both into our diagnostic shape.
  const loc = err?.loc ?? {}
  const m = loc.line ? null : String(err?.message ?? err).match(/(\d+):(\d+)/)
  const message = (err?.data?.type ? `${err.data.type}: ` : '') +
                  String(err?.message ?? err).split('\n')[0]
  return {
    line:     loc.line ?? (m ? parseInt(m[1]) : 1),
    column:   Math.max(0, (loc.column ?? (m ? parseInt(m[2]) : 1)) - 1),
    severity: 'error',
    message,
    type:     'Parse',
  }
}

function dedupe(errors) {
  const seen = new Set()
  return errors.filter(e => {
    const k = `${e.line}:${e.column}:${e.message}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
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
