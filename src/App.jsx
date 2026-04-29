import { useEffect, useRef, useState, useCallback } from 'react'
import { oneDark } from '@codemirror/theme-one-dark'
import { createEditor } from './editor/setup.js'
import { SAMPLES, detectLanguage, REMOTE_LANGUAGES } from './checkers/index.js'
import { useChecker } from './hooks/useChecker.js'
import TopBar      from './components/TopBar.jsx'
import EditorPane  from './components/EditorPane.jsx'
import ResultsPane from './components/ResultsPane.jsx'
import Footer      from './components/Footer.jsx'

// Persistence: remember language + theme across sessions. Keys namespaced;
// reads guarded so blocked-storage / SSR fall through to defaults.
const LS_LANG  = 'si:lang'
const LS_THEME = 'si:theme'
const safeRead  = (k, fb) => { try { return localStorage.getItem(k) ?? fb } catch { return fb } }
const safeWrite = (k, v)  => { try { localStorage.setItem(k, v) }       catch { /* ignored */ } }

// Decode a shared-URL hash if present. Hash format: #s=base64(json{l,c}).
// (Encoding side was removed when the Share button was retired, but
// existing shared links still resolve.)
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
  // ── State ────────────────────────────────────────────────────────────────
  const [language, setLanguage] = useState(() => safeRead(LS_LANG, 'javascript'))
  const [isEmpty,  setIsEmpty]  = useState(true)
  const [isDark,   setIsDark]   = useState(() => safeRead(LS_THEME, 'light') === 'dark')

  const editorDomRef = useRef(null)
  const editorRef    = useRef(null)
  const codeRef      = useRef('')
  const languageRef  = useRef(language)

  const { diagnostics, isChecking, isSlow, run, debounce, reset } = useChecker()

  // ── Derived state ────────────────────────────────────────────────────────
  const errorCount  = diagnostics.length
  const hasErrors   = errorCount > 0
  const isClean     = !isEmpty && !hasErrors && !isChecking
  // Show the loading screen any time a check has been running >200ms.
  // Remote languages get richer copy explaining the cold start.
  const isRemoteLang = REMOTE_LANGUAGES.includes(language)
  const showLoading  = isSlow && !isEmpty

  // ── Sync diagnostics into the editor's lint gutter ──────────────────────
  useEffect(() => {
    editorRef.current?.pushDiagnostics(diagnostics)
  }, [diagnostics])

  // ── Editor onChange (fires on every keystroke) ──────────────────────────
  const handleCodeChange = useCallback((code) => {
    codeRef.current = code
    setIsEmpty(!code.trim())
    debounce(code, languageRef.current)
  }, [debounce])

  // ── Mount editor once + restore from URL hash if present ────────────────
  useEffect(() => {
    if (!editorDomRef.current) return
    editorDomRef.current.innerHTML = ''
    const ed = createEditor(editorDomRef.current, { onChange: handleCodeChange })
    editorRef.current = ed

    const shared = decodeHash(window.location.hash)
    const initialLang = shared?.language ?? language
    ed.setLanguage(initialLang)

    if (shared) {
      setLanguage(shared.language)
      languageRef.current = shared.language
      ed.setCode(shared.code)
      codeRef.current = shared.code
      setIsEmpty(!shared.code.trim())
      run(shared.code, shared.language)
    }

    return () => {
      ed.destroy()
      editorRef.current = null
    }
  }, []) // intentionally no deps — created once

  // ── Theme toggle ────────────────────────────────────────────────────────
  useEffect(() => {
    editorRef.current?.setTheme(isDark ? oneDark : [])
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    safeWrite(LS_THEME, isDark ? 'dark' : 'light')
  }, [isDark])

  // ── Keyboard shortcut: Cmd/Ctrl+Enter forces a check now ────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        run(codeRef.current, languageRef.current)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [run])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleLanguageChange = useCallback((lang) => {
    setLanguage(lang)
    languageRef.current = lang
    safeWrite(LS_LANG, lang)
    editorRef.current?.setLanguage(lang)
    run(codeRef.current, lang)
  }, [run])

  const handleClear = () => {
    editorRef.current?.setCode('')
    editorRef.current?.clearDiagnostics()
    reset()
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
      safeWrite(LS_LANG, lang)
      codeRef.current = text
      setIsEmpty(!text.trim())
      run(text, lang)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSample = () => {
    const sample = SAMPLES[languageRef.current] ?? ''
    editorRef.current?.setCode(sample)
    codeRef.current = sample
    setIsEmpty(!sample.trim())
    run(sample, languageRef.current)
  }

  const handleJumpTo = useCallback(
    (line, col) => editorRef.current?.jumpTo(line, col),
    []
  )

  const handleRetry = useCallback(() => {
    // Bypass the cache by adding the timestamp to the cache key path —
    // simplest is to call run() which re-fetches. _remote.js's cache uses
    // (language, code) so a fresh run with the same input will hit the
    // cache. Better: clear cache via reset, then re-run.
    reset()
    run(codeRef.current, languageRef.current)
  }, [reset, run])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <TopBar
        language={language}
        onLanguageChange={handleLanguageChange}
        errorCount={errorCount}
        isDark={isDark}
        onToggleTheme={() => setIsDark(d => !d)}
      />

      <main className="workspace">
        <EditorPane
          editorRef={editorDomRef}
          onClear={handleClear}
          onUpload={handleUpload}
        />

        <div className="pane-divider" />

        <ResultsPane
          language={language}
          diagnostics={diagnostics}
          isEmpty={isEmpty}
          isClean={isClean}
          showLoading={showLoading}
          isRemote={isRemoteLang}
          onJumpTo={handleJumpTo}
          onSample={handleSample}
          onRetry={handleRetry}
          codeRef={codeRef}
        />
      </main>

      <Footer />
    </div>
  )
}
