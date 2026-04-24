export function check(code) {
  if (!code.trim()) return []

  const parser = new DOMParser()
  const doc = parser.parseFromString(code, 'application/xhtml+xml')
  const errEls = doc.getElementsByTagName('parsererror')
  if (!errEls.length) return []

  const text = errEls[0].textContent ?? ''
  const lineM = text.match(/line[:\s]+(\d+)/i)
  const colM  = text.match(/column[:\s]+(\d+)/i)

  // Strip "error on line N at column M:" prefix and grab first meaningful line
  const msg = text
    .replace(/error on line \d+ at column \d+:\s*/i, '')
    .trim()
    .split('\n')[0]
    .trim()

  return [{
    line:    lineM ? parseInt(lineM[1]) : 1,
    column:  colM  ? Math.max(0, parseInt(colM[1]) - 1) : 0,
    severity: 'error',
    message: msg || text.split('\n')[0],
    type: 'Parse',
  }]
}
