# Syntax Inspector

A static web app that surfaces **every** syntax error in a snippet of code — not just the first — across eight languages.

Paste code, upload a file, or load a sample. Errors appear as red squigglies in the editor and as editorial numbered cards on the right. Works offline once loaded.

**Languages:** JavaScript · TypeScript · Python · JSON · HTML · CSS · SQL · YAML

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3030
```

Build for production:

```bash
npm run build
npm run preview
```

No backend. Entire app is a static bundle.

---

## How it works

### Architecture

```
src/
├── App.jsx                 # Main component, editor lifecycle, state
├── editor/setup.js         # CodeMirror 6 factory (language + theme compartments)
├── checkers/
│   ├── index.js            # Registry, language detection, samples
│   ├── javascript.js       # @babel/parser with retry-based multi-error loop
│   ├── typescript.js       # Same loop with typescript+jsx plugins
│   ├── python.js           # Hand-rolled Python 3 checker
│   ├── json.js, html.js, css.js, sql.js, yaml.js
└── components/ErrorCard.jsx
```

Each checker exports one function:

```js
check(code: string) => Diagnostic[]
// { line, column, severity, message, type }[]
```

The app runs the active checker on every keystroke (debounced 450 ms), pushes results into CodeMirror via `@codemirror/lint`, and renders the same results as cards.

### The multi-error trick

Most JS parsers (acorn, Espree) stop at the first syntax error — so the UI would only ever show one problem at a time. `@babel/parser` has `errorRecovery: true`, but in practice it still throws on most real-world errors.

Fix in [`src/checkers/javascript.js`](src/checkers/javascript.js):

1. Try to parse.
2. If Babel throws, record the error, **replace that line with whitespace**, try again.
3. Repeat up to 20 times, bailing if the error location stops advancing.
4. Collapse consecutive duplicate messages so one missing `{` doesn't produce four cascade errors.

Result: three bugs in one file → three distinct cards. Same loop powers the TypeScript checker.

### Python

`filbert` is the only published Python parser in JS land and it targets Python 2. It fails on basically every Python 3 program. So [`src/checkers/python.js`](src/checkers/python.js) is a hand-rolled walker that catches, in order of frequency:

- Mixed tabs and spaces in indentation
- Unmatched brackets (`(`, `[`, `{`) with per-line depth tracking
- Unclosed string literals (including triple-quoted)
- Missing `:` after `if` / `for` / `def` / `class` / etc. — *depth-aware* so it doesn't false-positive on multi-line bracket groups
- Bare `=` where `==` was meant inside `if`/`while`/`elif` conditions

### Editor

CodeMirror 6 with `Compartment` reconfiguration so language and theme swap without rebuilding the editor state. A React `useRef` holds the `{ view, setLanguage, setTheme, setCode, pushDiagnostics }` handle so imperative updates don't collide with React's render cycle.

---

## Features

- Live checking on every keystroke (debounced)
- `⌘↵` / `Ctrl↵` force-check
- Dark / light theme (swaps CodeMirror's `oneDark` under the hood)
- Share-via-URL: the current language + code are base64-packed into the hash, so a link reproduces the session
- Auto-detect language on paste or file upload (extension + content heuristics)
- Editorial design: Fraunces / IBM Plex Sans / IBM Plex Mono, warm cream paper in light mode, SVG grain overlay, hairline rules, staggered load-in animations

---

## Stack

Vite · React 18 · CodeMirror 6 · `@babel/parser` · `@codemirror/lint` · `css-tree` · `node-sql-parser` · `js-yaml`
