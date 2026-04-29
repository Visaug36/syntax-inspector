import { describe, it } from 'vitest'
import { check } from '../src/checkers/typescript.js'
import { runFixtures } from './_helpers.js'

describe('TypeScript checker', () => {
  it('passes all fixture cases', async () => {
    await runFixtures({
      checker: check,
      valid: [
        ['empty',                          ''],
        ['typed function',                 'function add(a: number, b: number): number { return a + b }'],
        ['interface',                      'interface X { a: string; b: number }'],
        ['type alias',                     'type T = string | number'],
        ['generic function',               'function id<T>(x: T): T { return x }'],
        ['constrained generic',            'function f<T extends { id: string }>(x: T): T { return x }'],
        ['utility type',                   'type Y = Partial<{ a: string }>'],
        ['as const',                       'const x = { a: 1 } as const'],
        ['enum',                           'enum Color { Red, Green, Blue }'],
        ['namespace',                      'namespace N { export const x = 1 }'],
        ['JSX with TSX',                   'const el = <div className={"x"} />'],
        ['readonly array',                 'const a: readonly number[] = [1,2,3]'],
        ['mapped type',                    'type Readonly<T> = { readonly [K in keyof T]: T[K] }'],
        ['conditional type',               'type If<T, A, B> = T extends true ? A : B'],
      ],
      invalid: [
        ['broken interface (double comma)', 'interface X { a: string,, }', null],
        ['broken generic constraint',       'function f<T extends >(x: T): T { return x }', null],
        ['unclosed type union',             'type T = string |', null],
        ['missing closing brace',           'interface X { a: number', /expected/i],
        ['unclosed string in TS',           'const s: string = "hello', /Unterminated/i],
      ],
    })
  })
})
