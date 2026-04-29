// Web Worker that runs the heavy local checkers off the main thread.
// Babel parsing 5,000-line files takes ~90ms — without a worker that's
// 90ms of frozen UI. With this worker, the editor stays responsive and
// React can keep painting while the parser runs.
//
// Vite's "import worker via ?worker" support means we get a real ESM
// worker bundle out of the box, with proper code-splitting per checker.

const LOADERS = {
  javascript: () => import('./javascript.js'),
  typescript: () => import('./typescript.js'),
  json:       () => import('./json.js'),
  html:       () => import('./html.js'),
  css:        () => import('./css.js'),
  sql:        () => import('./sql.js'),
  yaml:       () => import('./yaml.js'),
}

// Cache loaded checker modules so subsequent calls are fast
const cache = new Map()

self.addEventListener('message', async (event) => {
  const { id, language, code } = event.data
  try {
    let checker = cache.get(language)
    if (!checker) {
      const loader = LOADERS[language]
      if (!loader) {
        self.postMessage({ id, diagnostics: [] })
        return
      }
      const mod = await loader()
      checker = mod.check
      cache.set(language, checker)
    }
    const diagnostics = await checker(code)
    self.postMessage({ id, diagnostics })
  } catch (err) {
    self.postMessage({
      id,
      diagnostics: [{
        line: 1, column: 0, severity: 'error',
        message: 'Checker crashed: ' + (err?.message || String(err)),
        type: 'Internal',
      }],
    })
  }
})
