import { runCheck } from './javascript.js'

export function check(code) {
  if (!code.trim()) return []
  return runCheck(code, ['typescript', 'jsx'], 'Parse')
}
