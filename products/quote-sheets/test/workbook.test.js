import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { loadTrades, buildWorkbook, fillJob } from '../src/build.js';
import { computeJob } from '../src/model.js';
import { recalc, hasLibreOffice } from '../src/recalc.js';
import * as L from '../src/layout.js';

const trades = loadTrades();

function jobsFor(t) {
  const [a, b, c, d] = t.services;
  return [
    { name: 'single small line (minimum charge applies)', lines: [{ service: a.name, qty: 1 }], miles: 0, discountPct: 0 },
    { name: 'multi line with miles and discount', lines: [{ service: a.name, qty: 2 }, { service: b.name, qty: 1 }, { service: c.name, qty: 3 }], miles: 18, discountPct: 0.1 },
    { name: 'large job, fractional qty', lines: [{ service: b.name, qty: 5 }, { service: c.name, qty: 2.5 }, { service: d.name, qty: 4 }, { service: a.name, qty: 7 }], miles: 42.5, discountPct: 0 },
  ];
}

test('every trade config is internally valid', () => {
  assert.ok(trades.length >= 4);
  for (const t of trades) {
    assert.ok(t.services.length >= 4 && t.services.length <= L.MAX_SERVICES, t.id);
    const names = t.services.map((s) => s.name);
    assert.equal(new Set(names).size, names.length, `${t.id} duplicate service names`);
    for (const s of t.services) {
      assert.ok(s.price > 0 && s.minutes >= 0 && s.materials >= 0, `${t.id}/${s.name}`);
    }
    assert.ok(t.settings.targetMargin > 0 && t.settings.targetMargin < 1);
  }
});

test('formulas, protection and validation are present in the built workbook', async () => {
  const wb = buildWorkbook(trades[0]);
  const q = wb.getWorksheet('Quote');
  assert.ok(q.getCell('E28').value.formula);
  assert.equal(q.getCell(`A${L.LINE_FIRST}`).dataValidation.type, 'list');
  assert.equal(q.getCell(`A${L.LINE_FIRST}`).protection.locked, false);
  assert.ok(q.sheetProtection, 'Quote sheet should be protected');
});

test('spreadsheet formulas match the reference model (recalculated by LibreOffice)', { skip: !hasLibreOffice() && 'LibreOffice (soffice) not installed' }, async () => {
  for (const t of trades) {
    for (const job of jobsFor(t)) {
      const wb = buildWorkbook(t);
      fillJob(wb, job);
      const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qs-')), `${t.id}.xlsx`);
      await wb.xlsx.writeFile(tmp);
      const done = new ExcelJS.Workbook();
      await done.xlsx.readFile(recalc(tmp));
      const q = done.getWorksheet('Quote'), p = done.getWorksheet('Job Profit');
      const want = computeJob(t, job);
      const tag = `${t.id} / ${job.name}`;
      const num = (ws, addr) => { const v = ws.getCell(addr).value; if (v !== null && typeof v === 'object') return v.result ?? 0; /* LibreOffice omits a cached result of zero */ return v; };
      const close = (got, exp, what) => assert.ok(Math.abs(got - exp) < 0.0051, `${tag}: ${what} got ${got} want ${exp}`);
      close(num(q, L.QUOTE.subtotal), want.subtotal, 'subtotal');
      close(num(q, L.QUOTE.travel), want.travel, 'travel');
      close(num(q, L.QUOTE.discountAmt), want.discount, 'discount');
      close(num(q, L.QUOTE.topUp), want.topUp, 'topUp');
      close(num(q, L.QUOTE.preTax), want.preTax, 'preTax');
      close(num(q, L.QUOTE.tax), want.tax, 'tax');
      close(num(q, L.QUOTE.total), want.total, 'total');
      close(num(p, L.PROFIT.hours), want.hours, 'hours');
      close(num(p, L.PROFIT.materials), want.materials, 'materials');
      close(num(p, L.PROFIT.cost), want.cost, 'cost');
      close(num(p, L.PROFIT.profit), want.profit, 'profit');
      close(num(p, L.PROFIT.margin), want.margin, 'margin');
      close(num(p, L.PROFIT.perHour), want.perHour, 'profit/hour');
      assert.equal(num(p, L.PROFIT.verdict), want.verdict, `${tag}: verdict`);
    }
  }
});

test('fixtures exercise both verdicts and the minimum-charge branch', () => {
  const all = trades.flatMap((t) => jobsFor(t).map((j) => computeJob(t, j)));
  assert.ok(all.some((r) => r.topUp > 0), 'a fixture should trigger the minimum charge');
  assert.ok(all.some((r) => r.verdict === 'On target'));
});
