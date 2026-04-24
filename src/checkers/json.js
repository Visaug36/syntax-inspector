export function check(code) {
  if (!code.trim()) return []
  try {
    JSON.parse(code)
    return []
  } catch (err) {
    // Chrome:  "Unexpected token , in JSON at position 47"
    // Firefox: "JSON.parse: ... at line 3 column 5 of the JSON data"
    const posMatch  = err.message.match(/at position (\d+)/)
    const lineMatch = err.message.match(/at line (\d+)/)
    const colMatch  = err.message.match(/column (\d+)/)

    let line = 1, column = 0
    if (posMatch) {
      const pos    = parseInt(posMatch[1])
      const before = code.substring(0, pos)
      const bLines = before.split('\n')
      line   = bLines.length
      column = bLines[bLines.length - 1].length
    } else if (lineMatch) {
      line   = parseInt(lineMatch[1])
      column = colMatch ? Math.max(0, parseInt(colMatch[1]) - 1) : 0
    }

    return [{
      line, column, severity: 'error',
      message: err.message,
      type: 'Parse',
    }]
  }
}
