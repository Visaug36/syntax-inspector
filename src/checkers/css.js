import * as csstree from 'css-tree'

export function check(code) {
  if (!code.trim()) return []
  const errors = []

  try {
    csstree.parse(code, {
      parseAtrulePrelude: true,
      parseRulePrelude:   true,
      parseValue:         true,
      onParseError(err) {
        errors.push({
          line:     err.line ?? 1,
          column:   Math.max(0, (err.column ?? 1) - 1),
          severity: 'error',
          message:  err.message,
          type:     'Parse',
        })
      },
    })
  } catch (err) {
    errors.push({
      line:     err.line ?? 1,
      column:   Math.max(0, (err.column ?? 1) - 1),
      severity: 'error',
      message:  err.message,
      type:     'Parse',
    })
  }

  return errors
}
