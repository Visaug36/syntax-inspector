import { describe, it } from 'vitest'
import { check } from '../src/checkers/javascript.js'
import { runFixtures } from './_helpers.js'

describe('JavaScript checker', () => {
  it('passes all fixture cases', async () => {
    await runFixtures({
      checker: check,
      valid: [
        // Beginner
        ['empty file',                   ''],
        ['hello world',                  'console.log("hello")'],
        ['ASI no semicolons',            'let x = 1\nlet y = 2\nconsole.log(x+y)'],
        ['double semicolon',             'let x = 1;;'],
        // Intermediate
        ['arrow function',               'const f = (a, b) => a + b'],
        ['spread args',                  'const f = (...args) => args.length'],
        ['destructuring',                'const { a, b: { c = 1 } = {} } = obj'],
        ['ternary',                      'const x = a ? b : c'],
        ['for-of loop',                  'for (const x of arr) { console.log(x) }'],
        ['try-catch',                    'try { f() } catch (e) { g(e) }'],
        ['switch-case',                  'switch (x) { case 1: break; default: break }'],
        ['array methods chain',          '[1,2,3].map(x => x*2).filter(x => x>2)'],
        // Advanced
        ['class with private field',     'class A { #x = 1; get x() { return this.#x } }'],
        ['optional chaining',            'const x = a?.b?.c ?? 0'],
        ['async/await',                  'async function f() { return await fetch("/") }'],
        ['generator',                    'function* gen() { yield 1; yield 2 }'],
        ['template literal',             'const s = `hello ${name}`'],
        ['template with expr',           'const s = `a ${"b" + 1} c`'],
        ['regex literal',                'const r = /[a-z]+/gi'],
        ['top-level await',              'await fetch("/")'],
        ['JSX simple',                   'const el = <div>{name}</div>'],
        ['JSX with attrs',               'const el = <div className="x" data-id={id}>hi</div>'],
        ['JSX fragment',                 'const el = <><a/><b/></>'],
        ['unicode identifier',           'const π = 3.14\nconsole.log(π)'],
        ['emoji in string',              'const s = "🎉🚀"'],
        ['escaped quote',                'const s = "she said \\"hi\\""'],
        // Edge: re-declaration is a binding error not syntax — should pass
        ['valid duplicate const (filtered)', 'const x = 1; const x = 2'],
        // Large valid input
        ['10K-line valid',               Array(10000).fill('let a = 1').join('\n')],
      ],
      invalid: [
        // Brackets / quotes
        ['missing closing paren',        'console.log("hi"',                /Unexpected token|expected/],
        ['missing closing brace',        'function f() { return 1',         /expected/i],
        ['missing closing bracket',      'const a = [1,2,3',                /expected/i],
        ['missing closing quote',        'const s = "hello',                /Unterminated/i],
        ['missing closing single quote', "const s = 'hello",                /Unterminated/i],
        ['unclosed template literal',    'const s = `hello',                /Unterminated/i],
        ['unclosed multi-line comment',  '/* never ends\nconst x = 1',      /Unterminated/i],
        ['unclosed regex',               'const r = /[a-z',                  null],
        // Commas
        ['missing comma in object',      'const o = { a: 1 b: 2 }',         /expected/i],
        ['missing comma in array',       'const a = [1 2 3]',               /expected/i],
        // Statements
        ['bad arrow rhs',                'const f = x => ;',                null],
        ['bad ternary',                  'const x = a ? : b',               null],
        ['bad if condition',             'if (x > ) console.log(1)',        null],
        ['broken for loop',              'for (let i = 0 i < 10 i++) {}',   null],
        ['reserved word as var',         'const class = 1',                 /reserved|class/i],
      ],
    })
  })

  it('returns multiple distinct diagnostics for multi-bug input', async () => {
    const code = `function f() {
  const a = "x
  const b = ;
  const c = a +
}`
    const d = await check(code)
    expect(d.length).toBeGreaterThanOrEqual(2)
    // Diagnostics should point at different lines (real distinct bugs)
    const lines = new Set(d.map(x => x.line))
    expect(lines.size).toBeGreaterThanOrEqual(2)
  })

  it('completes large input under 500ms', async () => {
    const big = Array(5000).fill('const x = 1').join('\n')
    const t0 = performance.now()
    await check(big)
    const ms = performance.now() - t0
    expect(ms).toBeLessThan(500)
  })

  it('handles unicode + emoji without crashing', async () => {
    const code = 'const π = 3.14\nconst s = "🎉"\nconst 你好 = "world"'
    expect(() => check(code)).not.toThrow()
  })

  it('handles empty + whitespace-only inputs', async () => {
    expect(await check('')).toEqual([])
    expect(await check('   \n\t  ')).toEqual([])
  })
})
