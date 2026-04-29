// Checker dispatch + worker bridge.
//
// Local-language checks run inside a single Web Worker so the heaviest
// parser (Babel, ~80KB gzip + non-trivial CPU) doesn't block the main
// thread. Remote languages (Python, C++, Java, Ruby) bypass the worker
// and hit the backend.
//
// The worker is created lazily — the first checkCode call triggers
// worker init, so users who never edit code never pay the worker cost.
import { checkRemote, REMOTE_LANGUAGES } from './_remote.js'
import { SAMPLES } from './samples.js'

// Vite's `?worker` import emits a separate worker bundle and gives us a
// Worker constructor with the URL + module type pre-baked. The dynamic
// import means the worker chunk only downloads when checkLocally is
// first called.
let workerPromise = null
let worker = null
let nextId = 1
const pending = new Map()

async function getWorker() {
  if (worker) return worker
  if (typeof Worker === 'undefined') return null  // Node tests, etc.
  if (!workerPromise) {
    workerPromise = import('./_worker.js?worker').then((m) => {
      const w = new m.default()
      w.addEventListener('message', (event) => {
        const { id, diagnostics } = event.data
        const resolver = pending.get(id)
        if (resolver) {
          pending.delete(id)
          resolver(diagnostics)
        }
      })
      w.addEventListener('error', () => {
        // Worker crashed — drop the singleton so next call tries again
        worker = null
        workerPromise = null
      })
      worker = w
      return w
    }).catch(() => null)
  }
  return workerPromise
}

// Synchronous fallback loaders — used when the worker isn't available
// (Node tests, old browsers, etc.). Same import map as the worker.
const FALLBACK_LOADERS = {
  javascript: () => import('./javascript.js'),
  typescript: () => import('./typescript.js'),
  json:       () => import('./json.js'),
  html:       () => import('./html.js'),
  css:        () => import('./css.js'),
  sql:        () => import('./sql.js'),
  yaml:       () => import('./yaml.js'),
}
const fallbackCache = new Map()

async function checkLocally(language, code) {
  const w = await getWorker()
  if (w) {
    return new Promise((resolve) => {
      const id = nextId++
      pending.set(id, resolve)
      w.postMessage({ id, language, code })
    })
  }
  // Fallback path: main-thread import + cache (used in test envs and any
  // browser where Worker creation failed)
  let checker = fallbackCache.get(language)
  if (!checker) {
    const loader = FALLBACK_LOADERS[language]
    if (!loader) return []
    const mod = await loader()
    checker = mod.check
    fallbackCache.set(language, checker)
  }
  return checker(code) ?? []
}

export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', ext: '.js' },
  { id: 'typescript', label: 'TypeScript', ext: '.ts' },
  { id: 'python',     label: 'Python',     ext: '.py', remote: true },
  { id: 'cpp',        label: 'C++',        ext: '.cpp', remote: true },
  { id: 'java',       label: 'Java',       ext: '.java', remote: true },
  { id: 'ruby',       label: 'Ruby',       ext: '.rb', remote: true },
  { id: 'json',       label: 'JSON',       ext: '.json' },
  { id: 'html',       label: 'HTML',       ext: '.html' },
  { id: 'css',        label: 'CSS',        ext: '.css' },
  { id: 'sql',        label: 'SQL',        ext: '.sql' },
  { id: 'yaml',       label: 'YAML',       ext: '.yaml' },
]

export async function checkCode(code, language) {
  if (REMOTE_LANGUAGES.includes(language)) return checkRemote(language, code)
  return checkLocally(language, code)
}

export { REMOTE_LANGUAGES, SAMPLES }

/** Guess language from file extension or code content heuristics */
export function detectLanguage(filename, code = '') {
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase()
    const byExt = {
      js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
      ts: 'typescript', tsx: 'typescript',
      py: 'python',
      cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', h: 'cpp', c: 'cpp',
      java: 'java',
      rb: 'ruby',
      json: 'json',
      html: 'html', htm: 'html',
      css: 'css',
      sql: 'sql',
      yaml: 'yaml', yml: 'yaml',
    }
    if (byExt[ext]) return byExt[ext]
  }

  const c = code.slice(0, 500)
  if (/^\s*#include\s*[<"]/m.test(c) || /\bstd::|\bcout\s*<<|using\s+namespace/m.test(c)) return 'cpp'
  if (/\bpublic\s+(static\s+)?class\b|\bSystem\.out\./m.test(c)) return 'java'
  if (/^\s*(require|require_relative)\s+['"]|^\s*def\s+\w+\s*$|\bend\s*$/m.test(c) && !/^\s*def\s+\w+\s*\(.*\):/m.test(c)) return 'ruby'
  if (/^#!.*python/i.test(c) || /^\s*def\s+\w+\s*\(.*\):|^\s*class\s+\w+|^\s*import\s+\w+/m.test(c)) return 'python'
  if (/^\s*<(!DOCTYPE|html|head|body)/i.test(c)) return 'html'
  if (/^\s*SELECT\s|^\s*INSERT\s|^\s*UPDATE\s|^\s*CREATE\s/im.test(c)) return 'sql'
  if (/^\s*[\{\[]/.test(c) && /"[^"]+"\s*:/.test(c)) return 'json'
  if (/^---\s*$|^\w[\w-]*:\s/m.test(c)) return 'yaml'
  if (/:\s*(string|number|boolean|any)\b|interface\s+\w+|type\s+\w+\s*=/m.test(c)) return 'typescript'
  return 'javascript'
}
