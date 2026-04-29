import { describe, it } from 'vitest'
import { check } from '../src/checkers/css.js'
import { runFixtures } from './_helpers.js'

describe('CSS checker', () => {
  it('passes all fixture cases', async () => {
    await runFixtures({
      checker: check,
      valid: [
        ['simple rule',                  '.x { color: red; }'],
        ['empty body',                   '.x {}'],
        ['multiple rules',               '.x { color: red; } .y { color: blue; }'],
        ['@media query',                 '@media (max-width: 600px) { .x { color: red; } }'],
        ['@keyframes',                   '@keyframes spin { 0% { rotate: 0deg } 100% { rotate: 360deg } }'],
        ['pseudo-classes',               '.x:hover, .y:focus { color: blue; }'],
        ['pseudo-elements',              '.x::before { content: ""; }'],
        ['attribute selector',           'input[type="text"] { padding: 4px; }'],
        ['CSS variables',                ':root { --x: red; } .y { color: var(--x); }'],
        ['calc()',                       '.x { width: calc(100% - 20px); }'],
        ['color-mix()',                  '.x { color: color-mix(in srgb, red, blue); }'],
        ['comments',                     '/* hi */ .x { /* inner */ color: red; }'],
        ['unicode content',              '.x::after { content: "→ ★"; }'],
        ['string with brace inside',     '.x::before { content: "{ not real }"; }'],
        // Modern (these used to false-positive)
        ['@container',                   '@container (min-width: 400px) { .x { color: red; } }'],
        ['@layer',                       '@layer base { .x { color: red; } }'],
        ['@scope',                       '@scope (.card) { p { color: red; } }'],
        ['@property',                    '@property --x { syntax: "<color>"; inherits: false; initial-value: red }'],
        ['empty input',                  ''],
      ],
      invalid: [
        ['unclosed brace',               '.x { color: red',                /never closed/i],
        ['extra closing brace',          '.x { color: red; } }',           null],
        ['unclosed comment',             '/* never ends .x { color: red; }', /comment was never closed/i],
      ],
    })
  })
})
