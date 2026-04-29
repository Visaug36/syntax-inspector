import { describe, it } from 'vitest'
import { check } from '../src/checkers/html.js'
import { runFixtures } from './_helpers.js'

describe('HTML checker', () => {
  it('passes all fixture cases', async () => {
    await runFixtures({
      checker: check,
      valid: [
        ['simple page',                   '<!DOCTYPE html><html><body><p>Hi</p></body></html>'],
        ['void elements no /',            '<div><br><hr><img src="x"></div>'],
        ['void elements with /',          '<div><br/><hr/><img src="x"/></div>'],
        ['unquoted attrs',                '<div class=card data-id=42>Hi</div>'],
        ['mixed quotes',                  '<div title="a\'b" data-x=\'a"b\'>x</div>'],
        ['<script> with < inside',        '<script>if (x < 5) console.log(x)</script>'],
        ['<style> with { inside',         '<style>.x { color: red; }</style>'],
        ['comments',                      '<div><!-- hi --></div>'],
        ['CDATA in svg',                  '<svg><![CDATA[ < & > ]]></svg>'],
        // HTML5 optional close
        ['<li> auto-close',               '<ul><li>a<li>b</ul>'],
        ['<p> auto-close',                '<p>a<p>b<p>c'],
        ['<tr><td> chain',                '<table><tr><td>1<td>2<tr><td>3</table>'],
        ['<dt><dd> chain',                '<dl><dt>a<dd>1<dt>b<dd>2</dl>'],
        // Self-closing
        ['SVG self-closing circle',       '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>'],
        ['custom self-closing',           '<my-icon name="star"/>'],
        ['empty self-closed',             '<br/>'],
        // Real-world
        ['full doc with meta',            '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>x</title></head><body><p>Hi</p></body></html>'],
        ['unicode + emoji',               '<p>你好 — café — 🎉</p>'],
        ['deep nesting 50',               '<div>'.repeat(50) + 'x' + '</div>'.repeat(50)],
        ['empty input',                   ''],
      ],
      invalid: [
        ['unclosed div',                  '<div><span>text',                         /never closed/i],
        ['mismatched closer',             '<div><h1>x</h2></div>',                  /Mismatched|expected/i],
        // Stack-based matcher reports the first observable mismatch — for
        // <div></span></div> that's '</span> expected </div>'. Same root bug,
        // different message phrasing.
        ['orphan close',                  '<div></span></div>',                     /Mismatched|no matching/i],
        ['truly orphan close',            '</p>',                                    /no matching/i],
        ['unclosed <script>',             '<script>console.log(1)',                 /never closed/i],
        ['unclosed <style>',              '<style>.x { color: red }',               /never closed/i],
        ['unclosed comment',              '<!-- comment never ends',                /Unclosed/i],
      ],
    })
  })
})
