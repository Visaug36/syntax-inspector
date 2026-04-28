import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  keymap,
} from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
} from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { lintGutter, setDiagnostics as cmSetDiagnostics } from '@codemirror/lint'
// CodeMirror language packs are lazy-loaded — picking JSON shouldn't pull
// in @codemirror/lang-cpp (50KB+) or the legacy-modes Ruby grammar.
// Vite splits each into its own chunk; first load awaits the import,
// later switches reuse the cached extension via langCache.
import { StreamLanguage } from '@codemirror/language'

const LANG_LOADERS = {
  javascript: () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true })),
  typescript: () => import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true, jsx: true })),
  python:     () => import('@codemirror/lang-python').then(m => m.python()),
  json:       () => import('@codemirror/lang-json').then(m => m.json()),
  html:       () => import('@codemirror/lang-html').then(m => m.html()),
  css:        () => import('@codemirror/lang-css').then(m => m.css()),
  sql:        () => import('@codemirror/lang-sql').then(m => m.sql()),
  yaml:       () => import('@codemirror/lang-yaml').then(m => m.yaml()),
  java:       () => import('@codemirror/lang-java').then(m => m.java()),
  cpp:        () => import('@codemirror/lang-cpp').then(m => m.cpp()),
  ruby:       () => import('@codemirror/legacy-modes/mode/ruby').then(m => StreamLanguage.define(m.ruby)),
}

const langCache = new Map()

export async function getLangExtension(lang) {
  if (langCache.has(lang)) return langCache.get(lang)
  const loader = LANG_LOADERS[lang] ?? LANG_LOADERS.javascript
  const ext    = await loader()
  langCache.set(lang, ext)
  return ext
}

function lineColToPos(doc, line, col) {
  const safeL = Math.max(1, Math.min(line, doc.lines))
  const lineObj = doc.line(safeL)
  const safeC = Math.max(0, Math.min(col ?? 0, lineObj.length))
  return lineObj.from + safeC
}

export function createEditor(parent, { onChange, initialCode = '' } = {}) {
  const langCompartment  = new Compartment()
  const themeCompartment = new Compartment()

  const state = EditorState.create({
    doc: initialCode,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),
      history(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        indentWithTab,
      ]),
      lintGutter(),
      // Empty initial language extension — getLangExtension is async and
      // we don't want to block editor creation. setLanguage(initialLang)
      // is called by App right after mount.
      langCompartment.of([]),
      themeCompartment.of([]),
      EditorView.updateListener.of(update => {
        if (update.docChanged && onChange) {
          onChange(update.state.doc.toString())
        }
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '13px' },
        '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)' },
        '.cm-content': { padding: '16px 0', minHeight: '100%' },
        '.cm-line': { padding: '0 20px' },
        '.cm-gutters': { borderRight: '1px solid var(--border)', background: 'var(--gutter-bg)', paddingRight: '4px' },
        '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 16px', color: 'var(--gutter-fg)', fontFamily: 'var(--font-mono)', fontSize: '12px' },
        '.cm-activeLine': { background: 'var(--line-active)' },
        '.cm-activeLineGutter': { background: 'var(--line-active)' },
        '.cm-lintRange-error': { backgroundImage: 'none', borderBottom: '2px solid var(--error-color)' },
        '.cm-lintRange-warning': { backgroundImage: 'none', borderBottom: '2px solid var(--warn-color)' },
        '.cm-diagnosticText': { fontFamily: 'var(--font-mono)', fontSize: '12px' },
        '.cm-tooltip': { border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface)' },
        '.cm-selectionBackground, ::selection': { background: 'var(--selection)' },
      }),
    ],
  })

  const view = new EditorView({ state, parent })

  return {
    view,

    async setLanguage(lang) {
      const ext = await getLangExtension(lang)
      // Editor may have been destroyed while we awaited
      if (view.contentDOM.isConnected === false) return
      view.dispatch({
        effects: langCompartment.reconfigure(ext),
      })
    },

    setTheme(darkExt) {
      view.dispatch({
        effects: themeCompartment.reconfigure(darkExt ?? []),
      })
    },

    setCode(code) {
      if (view.state.doc.toString() === code) return
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code },
      })
    },

    jumpTo(line, column = 0) {
      const pos = lineColToPos(view.state.doc, line, column)
      view.dispatch({
        selection: { anchor: pos },
        scrollIntoView: true,
      })
      view.focus()
    },

    pushDiagnostics(rawDiags) {
      const doc = view.state.doc
      const cmDiags = rawDiags.map(d => {
        const from = lineColToPos(doc, d.line, d.column)
        return {
          from,
          to: Math.min(from + 1, doc.length),
          severity: d.severity ?? 'error',
          message: d.message,
          source: d.type,
        }
      })
      view.dispatch(cmSetDiagnostics(view.state, cmDiags))
    },

    clearDiagnostics() {
      view.dispatch(cmSetDiagnostics(view.state, []))
    },

    destroy() {
      view.destroy()
    },
  }
}
