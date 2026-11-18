import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, csvCell, localDateISO } from './utils.js';

test('HTML escaping protects markup and quotes', () => {
  assert.equal(escapeHtml(`<script>alert("x")</script>'`), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&#39;');
});

test('CSV cells quote delimiters and neutralize formulas', () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('  @SUM(A1:A2)'), '"\'  @SUM(A1:A2)"');
});

test('localDateISO uses the local calendar date', () => {
  assert.equal(localDateISO(new Date(2026, 10, 18, 0, 15)), '2026-11-18');
});
