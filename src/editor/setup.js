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
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { sql } from '@codemirror/lang-sql'
import { yaml } from '@codemirror/lang-yaml'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { StreamLanguage } from '@codemirror/language'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'

export function getLangExtension(lang) {
  switch (lang) {
    case 'javascript': return javascript({ jsx: true })
    case 'typescript': return javascript({ typescript: true, jsx: true })
    case 'python':     return python()
    case 'json':       return json()
    case 'html':       return html()
    case 'css':        return css()
    case 'sql':        return sql()
    case 'yaml':       return yaml()
    case 'java':       return java()
    case 'cpp':        return cpp()
    case 'ruby':       return StreamLanguage.define(ruby)
    default:           return javascript({ jsx: true })
  }
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
      langCompartment.of(javascript({ jsx: true })),
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

    setLanguage(lang) {
      view.dispatch({
        effects: langCompartment.reconfigure(getLangExtension(lang)),
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
