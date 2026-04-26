import { check as checkJs   } from './javascript.js'
import { check as checkTs   } from './typescript.js'
import { check as checkPy   } from './python.js'
import { check as checkJson } from './json.js'
import { check as checkHtml } from './html.js'
import { check as checkCss  } from './css.js'
import { check as checkSql  } from './sql.js'
import { check as checkYaml } from './yaml.js'
import { checkRemote, REMOTE_LANGUAGES } from './_remote.js'

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

const CHECKERS = {
  javascript: checkJs,
  typescript: checkTs,
  python:     checkPy,
  json:       checkJson,
  html:       checkHtml,
  css:        checkCss,
  sql:        checkSql,
  yaml:       checkYaml,
}

// Sync wrapper used by App.jsx — returns either Diagnostic[] or a Promise
// (for languages that need the backend). The caller awaits as needed.
export function checkCode(code, language) {
  if (REMOTE_LANGUAGES.includes(language)) return checkRemote(language, code)
  return CHECKERS[language]?.(code) ?? []
}

export { REMOTE_LANGUAGES }

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

export const SAMPLES = {
  javascript: `// Three distinct errors — all surface at once
function fetchUser(id) {
  const user = {
    id: id,
    name: "Alice
  }
  return user
}

const double = x => x ** ;

class Widget {
  constructor(name)
    this.name = name
  }
}`,

  typescript: `// Multiple TS errors in one pass
interface Config {
  host: string
  port: number,,
}

function connect(config: Config {
  console.log(\`Connecting to \${config.host}\`)
}

const enabled: boolean = "yes"
const items: number[] = [1, 2, , 3,]`,

  python: `# Unclosed bracket in list comprehension
def calculate(items):
    prices = [item['price'
               for item in items]
    return sum(prices)

result = calculate([
    {'price': 10},
    {'price': 20},
])`,

  json: `{
  "user": {
    "name": "Alice",
    "age": 30,
    "roles": ["admin", "editor",],
    "active": true
  }
}`,

  html: `<!DOCTYPE html>
<html>
  <head>
    <title>My Page</title>
  </head>
  <body>
    <div class="container">
      <h1>Hello <strong>World</h2>
    </div>
  </body>
</html>`,

  css: `.container {
  background: #fff;
  padding: 20px
  border-radius: 8px;
}

.broken {
  color: red;
  margin: ;
}`,

  sql: `SELECT
  u.id,
  u.name,
  COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active'
GROUP u.id
HAVING order_count > 0`,

  yaml: `name: my-app
version: 1.0.0
database:
  host: localhost
  port: 5432
tags:
  - web
  - api
config:
  debug: true
  log_level: [info
  max_connections: 10`,

  cpp: `// Three real bugs g++ will catch
#include <iostream>

int main() {
    int x = 5
    std::cout << y << std::endl;
    return 0
}`,

  java: `// javac will report each error with rich messages
public class Main {
    public static void main(String[] args) {
        int count = 5
        System.out.println("Count: " + count)
        if (count > 0)
            System.out.println("positive"
    }
}`,

  ruby: `# ruby -c catches each parse error
def greet(name)
  puts "Hello, #{name}"
  if name.length > 0
    puts "welcome"

end

greet("world"`,
}
