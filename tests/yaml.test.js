import { describe, it } from 'vitest'
import { check } from '../src/checkers/yaml.js'
import { runFixtures } from './_helpers.js'

describe('YAML checker', () => {
  it('passes all fixture cases', async () => {
    await runFixtures({
      checker: check,
      valid: [
        ['scalar mapping',               'a: 1\nb: 2'],
        ['nested mapping',               'a:\n  b:\n    c: 1'],
        ['list',                         'a:\n  - x\n  - y'],
        ['anchor + alias',               'a: &x 1\nb: *x'],
        ['block scalar',                 'a: |\n  multiline\n  text'],
        ['quoted with colons',           'a: "with: colons"'],
        ['multi-document',               '---\na: 1\n---\nb: 2'],
        ['real K8s manifest',            'apiVersion: v1\nkind: Service\nmetadata:\n  name: x\nspec:\n  ports:\n    - port: 80'],
        ['empty',                        ''],
      ],
      invalid: [
        ['bad indent (mapping under list)', 'a: 1\n b: 2',                    /indent/i],
        ['unclosed flow array',          'a: [1, 2, 3\nb: ok',              /flow|comma/i],
        ['unclosed flow map',            'a: {x: 1, y: 2\nb: ok',           /flow|comma/i],
        ['tabs in indentation',          "a:\n\tb: 1",                       /tab/i],
      ],
    })
  })
})
