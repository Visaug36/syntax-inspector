// Shared utilities used by every per-language test file. Each test loads its
// own fixture set (valid + invalid) and asserts diagnostics behave correctly.
//
// Diagnostic shape (per the contract every checker produces):
//   { line, column, severity, message, type }

import { expect } from 'vitest'

/**
 * Run a list of fixture cases through a checker.
 *
 * @param {object} opts
 * @param {(code:string)=>Diagnostic[]} opts.checker — sync or async checker
 * @param {Array<[name:string, code:string]>} opts.valid — should produce 0 diagnostics
 * @param {Array<[name:string, code:string, expectedFirstMessage?:string|RegExp]>} opts.invalid — should produce ≥1 diagnostic
 */
export async function runFixtures({ checker, valid = [], invalid = [] }) {
  const results = { valid: [], invalid: [] }

  for (const [name, code] of valid) {
    const d = await checker(code)
    results.valid.push({ name, count: d.length, first: d[0] })
    expect(d, `expected valid ${name} to produce no diagnostics, got: ${JSON.stringify(d)}`).toHaveLength(0)
  }

  for (const [name, code, expectedMsg] of invalid) {
    const d = await checker(code)
    results.invalid.push({ name, count: d.length, first: d[0] })
    expect(d.length, `expected invalid ${name} to produce ≥1 diagnostic`).toBeGreaterThanOrEqual(1)
    if (expectedMsg) {
      const ok = expectedMsg instanceof RegExp
        ? expectedMsg.test(d[0].message)
        : d[0].message.includes(expectedMsg)
      expect(ok, `${name}: first diagnostic "${d[0].message}" did not match ${expectedMsg}`).toBe(true)
    }
    // Every diagnostic must have valid line/column types
    for (const diag of d) {
      expect(typeof diag.line).toBe('number')
      expect(typeof diag.column).toBe('number')
      expect(typeof diag.message).toBe('string')
      expect(['error', 'warning']).toContain(diag.severity)
    }
  }

  return results
}
