import yaml from 'js-yaml'

export function check(code) {
  if (!code.trim()) return []
  try {
    yaml.load(code)
    return []
  } catch (err) {
    return [{
      line:     err.mark ? err.mark.line + 1 : 1,
      column:   err.mark ? err.mark.column  : 0,
      severity: 'error',
      message:  err.reason ?? err.message,
      type:     'Parse',
    }]
  }
}
