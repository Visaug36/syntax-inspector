// Per-language broken samples used by the "Try sample" button. Each one
// contains 2-4 distinct bugs the corresponding checker should catch — they
// also serve as a quick smoke-test of multi-error reporting.
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
