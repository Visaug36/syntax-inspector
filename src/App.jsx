import { useEffect, useRef, useState, useCallback } from 'react'
import { oneDark } from '@codemirror/theme-one-dark'
import { createEditor } from './editor/setup.js'
import { checkCode, LANGUAGES, SAMPLES, detectLanguage } from './checkers/index.js'
import ErrorCard from './components/ErrorCard.jsx'

const DEBOUNCE_MS = 450

// ── URL hash share: encode {lang, code} so a link reproduces the session ──
function encodeHash(lang, code) {
  if (!code) return ''
  try {
    const json = JSON.stringify({ l: lang, c: code })
    return '#s=' + btoa(unescape(encodeURIComponent(json)))
  } catch { return '' }
}
function decodeHash(hash) {
  if (!hash?.startsWith('#s=')) return null
  try {
    const json = decodeURIComponent(escape(atob(hash.slice(3))))
    const { l, c } = JSON.parse(json)
    if (typeof l === 'string' && typeof c === 'string') return { language: l, code: c }
  } catch { /* corrupt hash */ }
  return null
}

export default function App() {
  const [language,    setLanguage]    = useState('javascript')
  const [diagnostics, setDiagnostics] = useState([])
  const [isEmpty,     setIsEmpty]     = useState(true)
  const [isDark,      setIsDark]      = useState(false)
  const [isChecking,  setIsChecking]  = useState(false)

  const editorDomRef  = useRef(null)
  const editorRef     = useRef(null)
  const debounceRef   = useRef(null)
  const codeRef       = useRef('')
  const languageRef   = useRef('javascript')

  // ── Core: run checker and push diagnostics back to editor ──────────────────
  // checkCode may return Diagnostic[] (sync) OR a Promise<Diagnostic[]> for
  // remote-checked languages (C++, Java, Ruby). Sequence number guards
  // against stale promises overwriting newer results.
  const checkSeqRef = useRef(0)
  const runCheck = useCallback((code, lang) => {
    const seq = ++checkSeqRef.current
    const result = checkCode(code, lang)

    if (result instanceof Promise) {
      setIsChecking(true)
      result.then(diags => {
        if (seq !== checkSeqRef.current) return // stale — newer check started
        setIsChecking(false)
        setDiagnostics(diags)
        editorRef.current?.pushDiagnostics(diags)
      })
    } else {
      setIsChecking(false)
      setDiagnostics(result)
      editorRef.current?.pushDiagnostics(result)
    }
  }, [])

  // ── Editor onChange (fires on every keystroke) ──────────────────────────────
  const handleCodeChange = useCallback((code) => {
    codeRef.current = code
    setIsEmpty(!code.trim())
    setIsChecking(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runCheck(code, languageRef.current)
    }, DEBOUNCE_MS)
  }, [runCheck])

  // ── Mount editor once + restore from URL hash if present ──────────────────
  useEffect(() => {
    if (!editorDomRef.current) return
    editorDomRef.current.innerHTML = ''
    const ed = createEditor(editorDomRef.current, { onChange: handleCodeChange })
    editorRef.current = ed

    const shared = decodeHash(window.location.hash)
    if (shared) {
      setLanguage(shared.language)
      languageRef.current = shared.language
      ed.setLanguage(shared.language)
      ed.setCode(shared.code)
      codeRef.current = shared.code
      setIsEmpty(!shared.code.trim())
      runCheck(shared.code, shared.language)
    }

    return () => {
      ed.destroy()
      editorRef.current = null
    }
  }, []) // intentionally no deps — created once

  // ── Language change ─────────────────────────────────────────────────────────
  const handleLanguageChange = useCallback((lang) => {
    setLanguage(lang)
    languageRef.current = lang
    editorRef.current?.setLanguage(lang)
    runCheck(codeRef.current, lang)
  }, [runCheck])

  // ── Theme toggle ────────────────────────────────────────────────────────────
  useEffect(() => {
    editorRef.current?.setTheme(isDark ? oneDark : [])
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  // ── Keyboard shortcut: Cmd/Ctrl+Enter ──────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        clearTimeout(debounceRef.current)
        runCheck(codeRef.current, languageRef.current)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [runCheck])

  // ── Clipboard / file actions ────────────────────────────────────────────────
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      const lang = detectLanguage('', text)
      editorRef.current?.setCode(text)
      editorRef.current?.setLanguage(lang)
      setLanguage(lang)
      languageRef.current = lang
      codeRef.current = text
      setIsEmpty(false)
      runCheck(text, lang)
    } catch { /* clipboard permission denied */ }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeRef.current)
    } catch { /* clipboard permission denied */ }
  }

  const handleClear = () => {
    editorRef.current?.setCode('')
    editorRef.current?.clearDiagnostics()
    setDiagnostics([])
    setIsEmpty(true)
    codeRef.current = ''
  }

  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const lang = detectLanguage(file.name, text)
      editorRef.current?.setCode(text)
      editorRef.current?.setLanguage(lang)
      setLanguage(lang)
      languageRef.current = lang
      codeRef.current = text
      setIsEmpty(false)
      runCheck(text, lang)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSample = () => {
    const sample = SAMPLES[languageRef.current] ?? ''
    editorRef.current?.setCode(sample)
    codeRef.current = sample
    setIsEmpty(false)
    runCheck(sample, languageRef.current)
  }

  const handleRunCheck = () => {
    clearTimeout(debounceRef.current)
    runCheck(codeRef.current, languageRef.current)
  }

  const [shareStatus, setShareStatus] = useState(null)
  const handleShare = async () => {
    const hash = encodeHash(languageRef.current, codeRef.current)
    if (!hash) return
    const url = window.location.origin + window.location.pathname + hash
    history.replaceState(null, '', hash)
    try {
      await navigator.clipboard.writeText(url)
      setShareStatus('Link copied')
    } catch {
      setShareStatus('Link updated')
    }
    setTimeout(() => setShareStatus(null), 1800)
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const hasErrors  = diagnostics.length > 0
  const isClean    = !isEmpty && !hasErrors && !isChecking
  const errorCount = diagnostics.length

  return (
    <div className="app">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="wordmark">
          <span className="wordmark-primary">Syntax</span>
          <span className="wordmark-secondary">Inspector</span>
        </div>

        <div className="topbar-center">
          <select
            className="lang-select"
            value={language}
            onChange={e => handleLanguageChange(e.target.value)}
            aria-label="Select language"
          >
            {LANGUAGES.map(l => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>

        <div className="topbar-right">
          {errorCount > 0 && (
            <span className="error-badge" aria-label={`${errorCount} error${errorCount > 1 ? 's' : ''}`}>
              {errorCount}
            </span>
          )}
          <button
            className="theme-toggle"
            onClick={() => setIsDark(d => !d)}
            aria-label="Toggle theme"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '☀' : '◑'}
          </button>
          <button className="run-btn" onClick={handleRunCheck}>
            Run check <kbd>⌘↵</kbd>
          </button>
        </div>
      </header>

      {/* ── Main two-pane area ──────────────────────────────────────── */}
      <main className="workspace">

        {/* Left: editor pane */}
        <div className="pane pane-input">
          <div className="pane-label">Input</div>

          <div className="editor-wrap" ref={editorDomRef} />

          <div className="pane-actions">
            <button className="action-btn" onClick={handlePaste}>Paste</button>
            <button className="action-btn" onClick={handleClear}>Clear</button>
            <button className="action-btn" onClick={handleCopy}>Copy</button>
            <label className="action-btn upload-label">
              Upload
              <input
                type="file"
                accept=".js,.jsx,.ts,.tsx,.py,.json,.html,.htm,.css,.sql,.yaml,.yml"
                onChange={handleUpload}
                hidden
              />
            </label>
            <button className="action-btn" onClick={handleShare} disabled={isEmpty}>
              {shareStatus ?? 'Share'}
            </button>
            <button className="action-btn sample-btn" onClick={handleSample}>
              Try sample
            </button>
          </div>
        </div>

        <div className="pane-divider" />

        {/* Right: diagnostics pane */}
        <div className="pane pane-results">
          <div className="pane-label">
            Diagnostics
            {errorCount > 0 && <span className="diag-count">{errorCount} issue{errorCount > 1 ? 's' : ''}</span>}
          </div>

          <div className="results-scroll">
            {isEmpty ? (
              <div className="empty-state">
                <p className="empty-heading">Ready to inspect.</p>
                <p className="empty-sub">
                  Paste code, upload a file, or hit <strong>Try sample</strong> to see errors surface inline.
                </p>
              </div>
            ) : isClean ? (
              <div className="clean-state">
                <span className="clean-icon">✓</span>
                <p className="clean-heading">No syntax errors found</p>
                <p className="clean-sub">{language.charAt(0).toUpperCase() + language.slice(1)} — looks good.</p>
              </div>
            ) : (
              <div className="error-list">
                {diagnostics.map((d, i) => (
                  <ErrorCard
                    key={`${d.line}-${d.column}-${i}`}
                    index={i}
                    diagnostic={d}
                    code={codeRef.current}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

      </main>

      {/* ── Footer credit ─────────────────────────────────────────── */}
      <footer className="footer">
        <span className="footer-mark">
          Crafted by <strong>Naram Alawar</strong>
        </span>
        <a
          className="footer-link"
          href="https://github.com/Visaug36"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Naram's GitHub profile"
        >
          @Visaug36 <span className="footer-arrow">↗</span>
        </a>
      </footer>
    </div>
  )
}
