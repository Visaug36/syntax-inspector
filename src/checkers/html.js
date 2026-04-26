export function check(code) {
  if (!code.trim()) return []

  const parser = new DOMParser()
  const doc = parser.parseFromString(code, 'application/xhtml+xml')
  const errEls = doc.getElementsByTagName('parsererror')
  if (!errEls.length) return []

  const text = errEls[0].textContent ?? ''
  const lineM = text.match(/line[:\s]+(\d+)/i)
  const colM  = text.match(/column[:\s]+(\d+)/i)

  // Browsers wrap parser errors in chrome like "This page contains the
  // following errors: error on line N at column M:" — strip the chrome and
  // keep the actual diagnostic, which is the first non-empty line after.
  const msg = text
    .replace(/^This page contains the following errors:\s*/i, '')
    .replace(/Below is a rendering of the page up to the first error\.?\s*$/i, '')
    .replace(/error on line \d+ at column \d+:\s*/i, '')
    .trim()
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)[0] ?? text

  return [{
    line:    lineM ? parseInt(lineM[1]) : 1,
    column:  colM  ? Math.max(0, parseInt(colM[1]) - 1) : 0,
    severity: 'error',
    message: msg || text.split('\n')[0],
    type: 'Parse',
  }]
}
