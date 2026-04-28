// HTML5-aware structural checker.
//
// Rationale: the previous implementation used DOMParser('application/xhtml+xml')
// which treats real HTML5 (unquoted attrs, void elements like <br>/<img>/<meta>
// without a closing slash) as malformed. Students typing valid HTML got
// false-positive errors. Real HTML5 parsers like parse5 are too lenient and
// don't report errors at all.
//
// Solution: walk the source ourselves looking for the bugs students actually
// make — unclosed tags, mismatched closers, orphan closing tags — while
// honoring HTML5 conventions (void elements, raw-text elements, comments).

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

// <script>/<style>/<textarea>/<title> contain raw text — angle brackets
// inside them aren't tags. Skip until matching close tag.
const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title'])

// HTML5 optional-closing-tag rules. Map: element → set of opening tags that
// implicitly close it. So <ul><li>a<li>b</ul> is valid — the second <li>
// auto-closes the first. Same for <p>, <tr>, <td>, etc.
// Reference: https://html.spec.whatwg.org/multipage/syntax.html#optional-tags
const AUTO_CLOSE_BEFORE = {
  li:      new Set(['li']),
  dt:      new Set(['dt', 'dd']),
  dd:      new Set(['dt', 'dd']),
  p:       new Set(['address', 'article', 'aside', 'blockquote', 'details',
                    'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer',
                    'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr',
                    'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul']),
  tr:      new Set(['tr']),
  td:      new Set(['td', 'th']),
  th:      new Set(['td', 'th']),
  thead:   new Set(['tbody', 'tfoot']),
  tbody:   new Set(['tbody', 'tfoot']),
  option:  new Set(['option', 'optgroup']),
  optgroup:new Set(['optgroup']),
}

// Parent → set of children that auto-close when the parent closes. So
// </ul> implicitly closes any open <li>.
const AUTO_CLOSE_ON_PARENT_CLOSE = {
  ul: new Set(['li']),
  ol: new Set(['li']),
  dl: new Set(['dt', 'dd']),
  table:    new Set(['tr', 'td', 'th', 'thead', 'tbody', 'tfoot']),
  thead:    new Set(['tr', 'td', 'th']),
  tbody:    new Set(['tr', 'td', 'th']),
  tfoot:    new Set(['tr', 'td', 'th']),
  tr:       new Set(['td', 'th']),
  select:   new Set(['option', 'optgroup']),
  optgroup: new Set(['option']),
}

export function check(code) {
  if (!code.trim()) return []

  const errors = []
  const stack  = []   // [{ name, line, col }]
  let i = 0

  while (i < code.length) {
    // ── Skip <!-- comments --> ─────────────────────────────────────────
    if (code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i + 4)
      if (end < 0) {
        errors.push(diag(code, i, 'Unclosed HTML comment'))
        return errors
      }
      i = end + 3
      continue
    }

    // ── Skip <!DOCTYPE …>, <!CDATA[…]]>, <?xml …?> ─────────────────────
    if (code.startsWith('<!', i) || code.startsWith('<?', i)) {
      const end = code.indexOf('>', i)
      i = end < 0 ? code.length : end + 1
      continue
    }

    if (code[i] !== '<') { i++; continue }

    // ── Closing tag </name> ────────────────────────────────────────────
    if (code[i + 1] === '/') {
      const m = code.slice(i).match(/^<\/([a-zA-Z][\w-]*)\s*>/)
      if (!m) { i++; continue } // malformed </ — skip

      const name = m[1].toLowerCase()

      // Auto-close any optional-closing children sitting on top of the
      // stack when their parent is being closed. e.g. </ul> closes <li>.
      const autoChildren = AUTO_CLOSE_ON_PARENT_CLOSE[name]
      if (autoChildren) {
        while (stack.length && autoChildren.has(stack[stack.length - 1].name)) {
          stack.pop()
        }
      }

      if (!stack.length) {
        errors.push(diag(code, i, `Unexpected closing tag </${name}> with no matching opening tag`))
      } else if (stack[stack.length - 1].name !== name) {
        // Mismatch — try to find a matching open further down the stack
        // (handles cases like <div><p></div> where <p> was never closed)
        const matchIdx = findInStack(stack, name)
        if (matchIdx >= 0) {
          // Everything above matchIdx was never closed
          for (let k = stack.length - 1; k > matchIdx; k--) {
            const orphan = stack[k]
            errors.push(diag(code, orphan.pos, `<${orphan.name}> was never closed`))
          }
          stack.length = matchIdx
        } else {
          const top = stack[stack.length - 1]
          errors.push(diag(code, i, `Mismatched closing tag </${name}> (expected </${top.name}>)`))
        }
      } else {
        stack.pop()
      }
      i += m[0].length
      continue
    }

    // ── Opening tag <name …> or <name …/> ──────────────────────────────
    // The previous regex `((?:\s+[^>]*)?)(\/?)>` had a greedy `[^>]*`
    // that ate the trailing `/`, so `<svg/>` and `<my-icon name="x"/>`
    // were treated as opening (never-closed) tags. Now we capture the
    // attributes liberally and detect the trailing `/` by inspecting
    // the captured attrs after matching.
    const m = code.slice(i).match(/^<([a-zA-Z][\w-]*)((?:\s+[^>]*?)?)\s*>/)
    if (!m) { i++; continue } // stray <, treat as text

    const name        = m[1].toLowerCase()
    const attrs       = m[2]
    const selfClosing = attrs.trimEnd().endsWith('/')
    const isVoid      = VOID_ELEMENTS.has(name)

    // Auto-close previous siblings the spec lets us elide. <li>a<li>b is
    // valid: the second <li> closes the first.
    while (stack.length) {
      const top = stack[stack.length - 1]
      const closes = AUTO_CLOSE_BEFORE[top.name]
      if (closes && closes.has(name)) stack.pop()
      else break
    }

    i += m[0].length

    if (selfClosing || isVoid) continue

    // Raw-text elements: jump to matching close
    if (RAW_TEXT_ELEMENTS.has(name)) {
      const re = new RegExp(`</${name}\\s*>`, 'i')
      const rest = code.slice(i)
      const closeMatch = rest.match(re)
      if (!closeMatch) {
        errors.push(diag(code, i, `<${name}> was never closed`))
        return errors
      }
      i += closeMatch.index + closeMatch[0].length
      continue
    }

    // Track on stack so we can match closes
    stack.push({ name, pos: i - m[0].length })
  }

  // Anything left = unclosed. EXCEPT elements whose closing tag is optional
  // per HTML5 spec — end-of-document implicitly closes them.
  for (const open of stack) {
    if (AUTO_CLOSE_BEFORE[open.name]) continue
    errors.push(diag(code, open.pos, `<${open.name}> was never closed`))
  }

  return errors
}

function findInStack(stack, name) {
  for (let k = stack.length - 1; k >= 0; k--) {
    if (stack[k].name === name) return k
  }
  return -1
}

function diag(code, idx, message) {
  const before = code.slice(0, idx)
  const lines  = before.split('\n')
  return {
    line:     lines.length,
    column:   lines[lines.length - 1].length,
    severity: 'error',
    message,
    type:     'Structural',
  }
}
