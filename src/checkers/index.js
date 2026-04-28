// Each checker module is loaded lazily — picking JSON shouldn't pull in
// @babel/parser (~2MB) or css-tree (~500KB). Vite splits these into
// per-checker chunks at build time. After the first load they're cached
// in `loadedCheckers` so subsequent calls are sync-fast.
import { checkRemote, REMOTE_LANGUAGES } from './_remote.js'
import { SAMPLES } from './samples.js'

const LOADERS = {
  javascript: () => import('./javascript.js'),
  typescript: () => import('./typescript.js'),
  python:     () => import('./python.js'),
  json:       () => import('./json.js'),
  html:       () => import('./html.js'),
  css:        () => import('./css.js'),
  sql:        () => import('./sql.js'),
  yaml:       () => import('./yaml.js'),
}

const loadedCheckers = new Map()

async function loadChecker(lang) {
  if (loadedCheckers.has(lang)) return loadedCheckers.get(lang)
  const loader = LOADERS[lang]
  if (!loader) return null
  const mod = await loader()
  loadedCheckers.set(lang, mod.check)
  return mod.check
}

export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', ext: '.js' },
  { id: 'typescript', label: 'TypeScript', ext: '.ts' },
  { id: 'python',     label: 'Python',     ext: '.py' },
  { id: 'cpp',        label: 'C++',        ext: '.cpp', remote: true },
  { id: 'java',       label: 'Java',       ext: '.java', remote: true },
  { id: 'ruby',       label: 'Ruby',       ext: '.rb', remote: true },
  { id: 'json',       label: 'JSON',       ext: '.json' },
  { id: 'html',       label: 'HTML',       ext: '.html' },
  { id: 'css',        label: 'CSS',        ext: '.css' },
  { id: 'sql',        label: 'SQL',        ext: '.sql' },
  { id: 'yaml',       label: 'YAML',       ext: '.yaml' },
]

// Always async now — caller awaits. Local checkers resolve in a microtask
// after first load, remote ones hit the network.
export async function checkCode(code, language) {
  if (REMOTE_LANGUAGES.includes(language)) return checkRemote(language, code)
  const checker = await loadChecker(language)
  return checker?.(code) ?? []
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
