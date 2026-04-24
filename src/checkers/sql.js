import { Parser } from 'node-sql-parser'

let parser
function getParser() {
  if (!parser) parser = new Parser()
  return parser
}

export function check(code) {
  if (!code.trim()) return []
  try {
    getParser().parse(code)
    return []
  } catch (err) {
    const msg  = (err.message || String(err)).split('\n')[0]
    const lineM = msg.match(/Line[:\s]+(\d+)/i) || msg.match(/line (\d+)/i)
    const colM  = msg.match(/col(?:umn)?[:\s]+(\d+)/i)

    return [{
      line:     lineM ? parseInt(lineM[1]) : 1,
      column:   colM  ? Math.max(0, parseInt(colM[1]) - 1) : 0,
      severity: 'error',
      message:  msg,
      type:     'Parse',
    }]
  }
}
