import { describe, it } from 'vitest'
import { check } from '../src/checkers/json.js'
import { runFixtures } from './_helpers.js'

describe('JSON checker', () => {
  it('passes all fixture cases', async () => {
    await runFixtures({
      checker: check,
      valid: [
        ['empty object',         '{}'],
        ['empty array',          '[]'],
        ['scalar number',        '42'],
        ['scalar string',        '"hello"'],
        ['scalar true',          'true'],
        ['scalar null',          'null'],
        ['nested',               '{"a":{"b":{"c":1}}}'],
        ['array of objects',     '[{"a":1},{"a":2}]'],
        ['unicode escape',       '{"a":"\\u00e9"}'],
        ['BOM prefix',           '﻿{"a":1}'],
        ['whitespace padding',   '   { "a" : 1 }   '],
      ],
      invalid: [
        ['unquoted key',         '{a: 1}',                /JSON/],
        ['single quotes',        "{'a': 1}",              /JSON/],
        ['trailing comma',       '{"a":1,}',              /JSON/],
        ['missing comma',        '{"a":1 "b":2}',         /JSON/],
        ['unclosed array',       '{"a":[1,2',             /JSON/],
        ['unclosed string',      '{"a":"hello',           /JSON/],
        ['bad unicode escape',   '{"a":"\\u00ZZ"}',       /Unicode/i],
        ['NaN literal',          '{"a":NaN}',             null],
        ['Infinity literal',     '{"a":Infinity}',        null],
        ['JS-style comment',     '{"a":1 // comment\n}',  null],
      ],
    })
  })
})
