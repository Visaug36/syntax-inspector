import { describe, it } from 'vitest'
import { check, humanizeSqlMessage } from '../src/checkers/sql.js'
import { runFixtures } from './_helpers.js'

describe('SQL checker', () => {
  it('passes all fixture cases', async () => {
    await runFixtures({
      checker: check,
      valid: [
        ['SELECT basic',                 'SELECT id, name FROM users'],
        ['SELECT with WHERE',            'SELECT * FROM users WHERE active = true'],
        ['JOIN',                         'SELECT u.id, o.id FROM users u JOIN orders o ON u.id=o.user_id'],
        ['GROUP BY + HAVING',            'SELECT dept, COUNT(*) FROM emp GROUP BY dept HAVING COUNT(*)>5'],
        ['CASE WHEN',                    "SELECT CASE WHEN x>0 THEN 'pos' ELSE 'neg' END FROM t"],
        ['INSERT',                       "INSERT INTO users (id, name) VALUES (1, 'Alice')"],
        ['UPDATE',                       "UPDATE users SET name='Bob' WHERE id=1"],
        ['DELETE',                       'DELETE FROM users WHERE id = 1'],
        ['CREATE TABLE',                 'CREATE TABLE x (id INT PRIMARY KEY, name VARCHAR(100))'],
        // Postgres-specific
        ['PG INTERVAL',                  "SELECT NOW() - INTERVAL '7 days'"],
        ['PG type cast',                 'SELECT id::TEXT FROM users'],
        ['PG RETURNING',                 "INSERT INTO x (a) VALUES (1) RETURNING id"],
        ['PG window function',           'SELECT ROW_NUMBER() OVER (ORDER BY id) FROM t'],
        ['PG CTE',                       'WITH t AS (SELECT 1 AS x) SELECT * FROM t'],
        ['lowercase keywords',           'select id from users'],
        ['multi-statement',              'SELECT 1; SELECT 2'],
      ],
      invalid: [
        ['bad keyword',                  'SELET * FROM x',                  /Expected/],
        ['trailing comma in SELECT',     'SELECT id, name, FROM users',     null],
        ['GROUP missing BY',             'SELECT dept FROM emp GROUP dept', null],
        ['unclosed string',              "SELECT 'hello FROM x",            null],
        ['mismatched parens',            'SELECT * FROM x WHERE id IN (1, 2', null],
        ['just keyword',                 'SELECT',                          null],
      ],
    })
  })

  it('humanizes wall-of-alternatives PEG errors', () => {
    const raw = 'Expected "#", "--", "/*", ":=", "=", "FOR", or [ \\t\\n\\r] but "u" found'
    const out = humanizeSqlMessage(raw)
    // Drops the noise (#, --, /*, whitespace) and keeps meaningful alternatives
    expect(out).toMatch(/found/)
    expect(out).not.toMatch(/\\t\\n\\r/)
    expect(out.length).toBeLessThan(raw.length)
  })
})
