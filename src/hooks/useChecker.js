import { useCallback, useRef, useState } from 'react'
import { checkCode, REMOTE_LANGUAGES } from '../checkers/index.js'

/**
 * Manages debounced async syntax checking with sequence-guarded results.
 *
 * Returns:
 *   diagnostics — current Diagnostic[] (for the results panel)
 *   isChecking  — true while a check is in flight (for loading UI)
 *   run(code, language)   — fire a fresh check, cancelling any pending debounce
 *   debounce(code, language) — schedule a debounced check (use on keystroke)
 *   reset()     — clear diagnostics (e.g. on Clear button)
 *
 * Sequence guarding prevents stale promises (slow remote checks that resolve
 * after a fresh local check has already completed) from overwriting newer
 * results.
 */
const DEBOUNCE_LOCAL_MS  = 450
const DEBOUNCE_REMOTE_MS = 1500

export function useChecker() {
  const [diagnostics, setDiagnostics] = useState([])
  const [isChecking,  setIsChecking]  = useState(false)
  const seqRef        = useRef(0)
  const debounceRef   = useRef(null)

  const run = useCallback(async (code, lang) => {
    clearTimeout(debounceRef.current)
    const seq = ++seqRef.current
    if (!code.trim()) {
      setIsChecking(false)
      setDiagnostics([])
      return
    }
    setIsChecking(true)
    try {
      const result = await checkCode(code, lang)
      if (seq !== seqRef.current) return
      setDiagnostics(result)
    } finally {
      if (seq === seqRef.current) setIsChecking(false)
    }
  }, [])

  const debounce = useCallback((code, lang) => {
    setIsChecking(true)
    clearTimeout(debounceRef.current)
    const wait = REMOTE_LANGUAGES.includes(lang) ? DEBOUNCE_REMOTE_MS : DEBOUNCE_LOCAL_MS
    debounceRef.current = setTimeout(() => run(code, lang), wait)
  }, [run])

  const reset = useCallback(() => {
    clearTimeout(debounceRef.current)
    seqRef.current++
    setDiagnostics([])
    setIsChecking(false)
  }, [])

  return { diagnostics, isChecking, run, debounce, reset }
}
