import { useEffect, useRef, useState, useCallback } from 'react'
import { oneDark } from '@codemirror/theme-one-dark'
import { createEditor } from './editor/setup.js'
import { SAMPLES, detectLanguage, REMOTE_LANGUAGES } from './checkers/index.js'
import { useChecker } from './hooks/useChecker.js'
import TopBar      from './components/TopBar.jsx'
import EditorPane  from './components/EditorPane.jsx'
import ResultsPane from './components/ResultsPane.jsx'
import Footer      from './components/Footer.jsx'

// ── Lightweight persistence: remember the user's language pick and theme
//    across sessions. Keys are namespaced; reads are guarded so SSR or
//    blocked-storage environments fall through to defaults silently.
const LS_LANG  = 'si:lang'
const LS_THEME = 'si:theme'
const safeRead  = (k, fb) => { try { return localStorage.getItem(k) ?? fb } catch { return fb } }
const safeWrite = (k, v)  => { try { localStorage.setItem(k, v) }       catch { /* ignored */ } }

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
  // ── State ────────────────────────────────────────────────────────────────
  const [language,    setLanguage]    = useState(() => safeRead(LS_LANG, 'javascript'))
  const [isEmpty,     setIsEmpty]     = useState(true)
  const [isDark,      setIsDark]      = useState(() => safeRead(LS_THEME, 'light') === 'dark')
  const [shareStatus, setShareStatus] = useState(null)

  const editorDomRef = useRef(null)
  const editorRef    = useRef(null)
  const codeRef      = useRef('')
  const languageRef  = useRef(language)

  const { diagnostics, isChecking, run, debounce, reset } = useChecker()

  // ── Derived state ────────────────────────────────────────────────────────
  const errorCount        = diagnostics.length
  const hasErrors         = errorCount > 0
  const isClean           = !isEmpty && !hasErrors && !isChecking
  const showRemoteLoading = isChecking && REMOTE_LANGUAGES.includes(language) && !isEmpty

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

  // ── Keyboard shortcut: Cmd/Ctrl+Enter ───────────────────────────────────
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

  const applyContent = useCallback((text, lang) => {
    editorRef.current?.setCode(text)
    editorRef.current?.setLanguage(lang)
    setLanguage(lang)
    languageRef.current = lang
    safeWrite(LS_LANG, lang)
    codeRef.current = text
    setIsEmpty(!text.trim())
    run(text, lang)
  }, [run])

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      applyContent(text, detectLanguage('', text))
    } catch { /* clipboard permission denied */ }
  }

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(codeRef.current) } catch {}
  }

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
    reader.onload = (ev) => applyContent(ev.target.result, detectLanguage(file.name, ev.target.result))
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

  const handleRunCheck = () => run(codeRef.current, languageRef.current)

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

  const handleJumpTo = useCallback(
    (line, col) => editorRef.current?.jumpTo(line, col),
    []
  )

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <TopBar
        language={language}
        onLanguageChange={handleLanguageChange}
        errorCount={errorCount}
        isDark={isDark}
        onToggleTheme={() => setIsDark(d => !d)}
        onRunCheck={handleRunCheck}
      />

      <main className="workspace">
        <EditorPane
          editorRef={editorDomRef}
          onPaste={handlePaste}
          onCopy={handleCopy}
          onClear={handleClear}
          onUpload={handleUpload}
          onShare={handleShare}
          onSample={handleSample}
          shareStatus={shareStatus}
          isEmpty={isEmpty}
        />

        <div className="pane-divider" />

        <ResultsPane
          language={language}
          diagnostics={diagnostics}
          isEmpty={isEmpty}
          isClean={isClean}
          showRemoteLoading={showRemoteLoading}
          onJumpTo={handleJumpTo}
          onSample={handleSample}
          codeRef={codeRef}
        />
      </main>

      <Footer />
    </div>
  )
}
