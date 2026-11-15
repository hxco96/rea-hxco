import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { loadTrades, buildWorkbook, fillJob } from '../src/build.js';
import { computeJob } from '../src/model.js';
import { listingFor, TAG_MAX, TAG_COUNT, TITLE_MAX } from '../src/listing.js';
import { recalc, hasLibreOffice } from '../src/recalc.js';
import * as L from '../src/layout.js';

const trades = loadTrades();
const skip = !hasLibreOffice() && 'LibreOffice (soffice) not installed';
const val = (ws, a) => { const v = ws.getCell(a).value; return v !== null && typeof v === 'object' ? (v.result ?? 0) : v; };

async function calc(t, mutate) {
  const wb = buildWorkbook(t);
  mutate(wb);
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qs-')), 'x.xlsx');
  await wb.xlsx.writeFile(f);
  const d = new ExcelJS.Workbook();
  await d.xlsx.readFile(recalc(f));
  return d;
}

test('an empty quote totals zero, with no minimum charge and no verdict', { skip }, async () => {
  const t = trades[0];
  const d = await calc(t, () => {});
  assert.equal(val(d.getWorksheet('Quote'), L.QUOTE.total), 0);
  // an empty-string formula result is cached as missing, which the helper reads as 0
  assert.ok([0, ''].includes(val(d.getWorksheet('Job Profit'), L.PROFIT.verdict)));
  assert.equal(computeJob(t, { lines: [] }).total, 0);
});

test('a service not on the Rates sheet is flagged, not silently priced at zero', { skip }, async () => {
  const t = trades[0];
  const d = await calc(t, (wb) => {
    const q = wb.getWorksheet('Quote');
    q.getCell('A9').value = t.services[0].name + ' ';   // trailing space, no longer matches
    q.getCell('B9').value = 1;
  });
  const q = d.getWorksheet('Quote');
  assert.match(String(val(q, 'F9')), /NOT ON RATES/);
  assert.match(String(val(q, 'A30')), /WARNING/);
});

test('a blank quantity prices a selected service at zero', { skip }, async () => {
  const t = trades[0];
  const d = await calc(t, (wb) => { wb.getWorksheet('Quote').getCell('A9').value = t.services[0].name; });
  assert.equal(val(d.getWorksheet('Quote'), 'E9'), 0);
});

test('a big discount is topped back up to the minimum charge (documented behaviour)', { skip }, async () => {
  const t = trades[0];
  const job = { lines: [{ service: t.services[0].name, qty: 1 }], discountPct: 0.5 };
  const d = await calc(t, (wb) => fillJob(wb, job));
  const want = computeJob(t, job);
  assert.ok(want.topUp > 0);
  assert.ok(Math.abs(val(d.getWorksheet('Quote'), L.QUOTE.total) - want.total) < 0.005);
});

test('both margin verdicts occur across the fixtures', () => {
  const t = trades[0];
  const easy = computeJob({ ...t, settings: { ...t.settings, targetMargin: 0.01 } }, { lines: [{ service: t.services[0].name, qty: 1 }] });
  const underpriced = computeJob({ ...t, settings: { ...t.settings, targetMargin: 0.99 } }, { lines: [{ service: t.services[0].name, qty: 1 }] });
  assert.equal(easy.verdict, 'On target');
  assert.match(underpriced.verdict, /^Below target margin/);
});

test('drop-down formula has no leading equals sign (OOXML stores formulas without it)', () => {
  for (const t of trades) {
    const dv = buildWorkbook(t).getWorksheet('Quote').getCell(`A${L.LINE_FIRST}`).dataValidation;
    assert.ok(!dv.formulae[0].startsWith('='));
  }
});

test('Etsy listing limits: title, 13 tags, whole-phrase tags, no brand-name tags', () => {
  for (const t of trades) {
    const l = listingFor(t);
    assert.ok(l.title.length <= TITLE_MAX, `${t.id} title ${l.title.length}`);
    assert.equal(l.tags.length, TAG_COUNT, t.id);
    assert.equal(new Set(l.tags).size, l.tags.length, `${t.id} duplicate tags`);
    for (const tag of l.tags) {
      assert.ok(tag.length <= TAG_MAX, `${t.id} tag too long: ${tag}`);
      assert.doesNotMatch(tag, /google|microsoft|invoice/i, `${t.id} tag: ${tag}`);
    }
    assert.doesNotMatch(l.description + l.title, /google sheets/i, `${t.id} makes an untested Google Sheets claim`);
    assert.match(l.description, /Created with the help of AI/);
  }
});
