import { describe, it } from 'vitest'
import {
  LANGUAGES,
  REMOTE_LANGUAGES,
  SAMPLES,
  detectLanguage,
  checkCode,
} from '../src/checkers/index.js'

describe('Language registry', () => {
  it('has 11 supported languages', () => {
    expect(LANGUAGES).toHaveLength(11)
  })

  it('every language has a unique id, label, and ext', () => {
    const ids = new Set()
    for (const l of LANGUAGES) {
      expect(l.id).toBeTruthy()
      expect(l.label).toBeTruthy()
      expect(l.ext).toBeTruthy()
      expect(ids.has(l.id)).toBe(false)
      ids.add(l.id)
    }
  })

  it('every language has a SAMPLES entry', () => {
    for (const l of LANGUAGES) {
      expect(SAMPLES[l.id], `missing sample for ${l.id}`).toBeTruthy()
      expect(SAMPLES[l.id].length).toBeGreaterThan(20)
    }
  })

  it('REMOTE_LANGUAGES is a subset of LANGUAGES', () => {
    const ids = LANGUAGES.map(l => l.id)
    for (const r of REMOTE_LANGUAGES) {
      expect(ids).toContain(r)
    }
  })

  describe('detectLanguage', () => {
    it('detects by extension', () => {
      expect(detectLanguage('foo.js')).toBe('javascript')
      expect(detectLanguage('foo.ts')).toBe('typescript')
      expect(detectLanguage('foo.py')).toBe('python')
      expect(detectLanguage('foo.cpp')).toBe('cpp')
      expect(detectLanguage('foo.java')).toBe('java')
      expect(detectLanguage('foo.rb')).toBe('ruby')
      expect(detectLanguage('foo.json')).toBe('json')
      expect(detectLanguage('foo.html')).toBe('html')
      expect(detectLanguage('foo.css')).toBe('css')
      expect(detectLanguage('foo.sql')).toBe('sql')
      expect(detectLanguage('foo.yaml')).toBe('yaml')
      expect(detectLanguage('foo.yml')).toBe('yaml')
    })

    it('detects by content for cpp / java / ruby / python', () => {
      expect(detectLanguage('', '#include <iostream>')).toBe('cpp')
      expect(detectLanguage('', 'public class Foo {}')).toBe('java')
      expect(detectLanguage('', 'def greet\n  puts "hi"\nend')).toBe('ruby')
      expect(detectLanguage('', 'def f(x):\n    return x')).toBe('python')
    })

    it('falls through to javascript for unknown', () => {
      expect(detectLanguage('foo.xyz', 'random text')).toBe('javascript')
    })
  })

  describe('checkCode', () => {
    it('returns empty for empty input across local languages', async () => {
      for (const lang of ['javascript', 'typescript', 'json', 'html', 'css', 'sql', 'yaml']) {
        expect(await checkCode('', lang)).toEqual([])
      }
    })

    it('returns empty for unknown language', async () => {
      expect(await checkCode('any code', 'klingon')).toEqual([])
    })
  })
})
