import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from './layout.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.join(here, '..');

export function loadTrades() {
  const dir = path.join(root, 'trades');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

const INPUT = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8D6' } };
const HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
const GREY = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
const MONEY = '$#,##0.00';
const BLANK0 = '$#,##0.00;-$#,##0.00;;@'; // hide zero on empty quote lines
const unlocked = { protection: { locked: false } };

function head(ws, row, labels) {
  labels.forEach((t, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = t; c.fill = HEAD; c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { wrapText: true, vertical: 'middle' };
  });
}
function title(ws, text, sub) {
  ws.getCell('A1').value = text; ws.getCell('A1').font = { bold: true, size: 16 };
  if (sub) { ws.getCell('A2').value = sub; ws.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } }; }
}
const RATES_TABLE = `Rates!$A$${L.SVC_FIRST}:$E$${L.SVC_LAST}`;

export function buildWorkbook(trade) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'quote-sheets generator'; wb.created = new Date('2026-01-01');
  const s = trade.settings;

  // ---- Start Here
  const st = wb.addWorksheet('Start Here', { views: [{ showGridLines: false }] });
  title(st, `${trade.name} Quote and Profit Calculator`);
  const steps = [
    '1. Open the Rates sheet. Yellow cells are yours to change. Every price and rate shown is an EXAMPLE, not market data. Replace them with your own numbers.',
    '2. Add your own services in the Rates table (up to 20). Keep one service per row. Minutes and materials are what you expect the job to cost you.',
    `3. On the Quote sheet, pick a service from the drop-down, enter the quantity, add miles driven and any discount. The ${trade.customerWord} total updates itself.`,
    '4. Print or save the Quote sheet as PDF to send to your customer. Do not send the Job Profit sheet.',
    '5. The Job Profit sheet shows your margin and profit per hour, and warns when a job falls under your target margin.',
    '',
    'Notes: Quote and Job Profit sheets are protected only to stop accidental edits. There is no password: use Review > Unprotect Sheet to customise.',
    'Hours on the Job Profit sheet cover on-site work only, not driving time. Tax is a flat rate you set. This is a planning tool, not tax, legal or accounting advice.',
    'Built for Microsoft Excel. Other spreadsheet apps (Google Sheets, LibreOffice) may open it, but features such as the drop-down lists can behave differently.',
    'A discount cannot take a job below your minimum charge: the minimum is topped up after the discount.',
    'If a quote line shows NOT ON RATES SHEET, the service name no longer matches the Rates sheet. Pick it again from the drop-down.',
  ];
  steps.forEach((t, i) => { const c = st.getCell(`A${3 + i}`); c.value = t; c.alignment = { wrapText: true, vertical: 'top' }; st.getRow(3 + i).height = t ? 34 : 8; });
  st.getColumn(1).width = 110;

  // ---- Rates
  const rt = wb.addWorksheet('Rates');
  title(rt, 'Your rates', 'Yellow cells are inputs. Example numbers only.');
  const settings = [
    ['Labour cost per hour (what the work costs you)', s.labourCostPerHour, MONEY],
    ['Travel cost per mile (your cost)', s.travelCostPerMile, MONEY],
    ['Sales tax rate', s.taxRate, '0.0%'],
    ['Travel charge per mile (billed to customer)', s.travelChargePerMile, MONEY],
    ['Minimum charge per job (before tax)', s.minimumCharge, MONEY],
    ['Target profit margin', s.targetMargin, '0%'],
  ];
  settings.forEach(([label, val, fmt], i) => {
    const r = 4 + i;
    rt.getCell(`A${r}`).value = label;
    const c = rt.getCell(`B${r}`); c.value = val; c.numFmt = fmt; c.fill = INPUT;
  });
  rt.getCell('A10').value = 'Your business name and contact (shown on the quote)';
  rt.getCell('B10').fill = INPUT;
  rt.getCell('A11').value = 'Services'; rt.getCell('A11').font = { bold: true, size: 13 };
  head(rt, 12, ['Service', 'Unit', 'Price per unit', 'Minutes per unit (your time)', 'Materials cost per unit']);
  for (let i = 0; i < L.MAX_SERVICES; i++) {
    const r = L.SVC_FIRST + i; const x = trade.services[i];
    ['A', 'B', 'C', 'D', 'E'].forEach((col) => { rt.getCell(`${col}${r}`).fill = INPUT; });
    if (x) {
      rt.getCell(`A${r}`).value = x.name; rt.getCell(`B${r}`).value = x.unit;
      rt.getCell(`C${r}`).value = x.price; rt.getCell(`D${r}`).value = x.minutes; rt.getCell(`E${r}`).value = x.materials;
    }
    rt.getCell(`C${r}`).numFmt = MONEY; rt.getCell(`E${r}`).numFmt = MONEY;
  }
  rt.getColumn(1).width = 52; [2, 3, 4, 5].forEach((i) => { rt.getColumn(i).width = 20; });
  rt.getRow(12).height = 32;

  // ---- Quote
  const q = wb.addWorksheet('Quote', { pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1 } });
  title(q, `${trade.name} Quote`, 'Prepared for the customer. Yellow cells are inputs.');
  [['Customer', null], ['Date', null], ['Round-trip miles', 0]].forEach(([label, v], i) => {
    q.getCell(`A${3 + i}`).value = label; q.getCell(`A${3 + i}`).font = { bold: true };
    const c = q.getCell(`B${3 + i}`); c.value = v; c.fill = INPUT; c.protection = { locked: false };
  });
  q.getCell('B4').numFmt = 'yyyy-mm-dd';
  head(q, 8, ['Service', 'Qty', 'Unit', 'Price per unit', 'Line total', 'Check']);
  q.getCell('A6').value = { formula: 'IF(Rates!B10="","",Rates!B10)' }; q.getCell('A6').font = { bold: true };
  q.getCell('A30').value = { formula: 'IF(COUNTIF(F9:F20,"NOT*")>0,"WARNING: a service on this quote is not on the Rates sheet and is priced at $0.","")' };
  q.getCell('A30').font = { bold: true, color: { argb: 'FFC00000' } };
  for (let r = L.LINE_FIRST; r <= L.LINE_LAST; r++) {
    q.getCell(`A${r}`).fill = INPUT; q.getCell(`B${r}`).fill = INPUT;
    q.getCell(`A${r}`).protection = { locked: false }; q.getCell(`B${r}`).protection = { locked: false };
    q.getCell(`A${r}`).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: true,
      errorTitle: 'Unknown service', error: 'Pick a service listed on the Rates sheet.',
      formulae: [`Rates!$A$${L.SVC_FIRST}:$A$${L.SVC_LAST}`] };
    q.getCell(`B${r}`).dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, showErrorMessage: true,
      errorTitle: 'Quantity', error: 'Enter a number, zero or more.', formulae: [0] };
    q.getCell(`C${r}`).value = { formula: `IF(A${r}="","",IFERROR(VLOOKUP(A${r},${RATES_TABLE},2,FALSE),""))` };
    q.getCell(`D${r}`).value = { formula: `IF(A${r}="","",IFERROR(VLOOKUP(A${r},${RATES_TABLE},3,FALSE),0))` };
    q.getCell(`E${r}`).value = { formula: `IF(A${r}="",0,ROUND(B${r}*D${r},2))` };
    q.getCell(`F${r}`).value = { formula: `IF(A${r}="","",IF(ISNA(MATCH(A${r},Rates!$A$${L.SVC_FIRST}:$A$${L.SVC_LAST},0)),"NOT ON RATES SHEET",""))` };
    q.getCell(`F${r}`).font = { bold: true, color: { argb: 'FFC00000' } };
    q.getCell(`D${r}`).numFmt = BLANK0; q.getCell(`E${r}`).numFmt = BLANK0;
  }
  const lines = [
    [22, 'Subtotal', `SUM(E${L.LINE_FIRST}:E${L.LINE_LAST})`],
    [23, 'Travel', `ROUND(B5*Rates!B7,2)`],
    [24, 'Discount', `ROUND(-(E22+E23)*B24,2)`],
    [25, 'Minimum charge top-up', `IF(E22=0,0,ROUND(MAX(0,Rates!B8-(E22+E23+E24)),2))`],
    [26, 'Total before tax', `E22+E23+E24+E25`],
    [27, 'Tax', `ROUND(E26*Rates!B6,2)`],
    [28, 'TOTAL DUE', `E26+E27`],
  ];
  lines.forEach(([r, label, f]) => {
    q.getCell(`D${r}`).value = label; q.getCell(`D${r}`).alignment = { horizontal: 'right' };
    q.getCell(`E${r}`).value = { formula: f }; q.getCell(`E${r}`).numFmt = MONEY; q.getCell(`E${r}`).fill = GREY;
  });
  q.getCell('D28').font = { bold: true }; q.getCell('E28').font = { bold: true, size: 13 };
  q.getCell('A24').value = 'Discount % (optional)'; q.getCell('B24').value = 0; q.getCell('B24').numFmt = '0%';
  q.getCell('B24').fill = INPUT; q.getCell('B24').protection = { locked: false };
  q.getCell('B24').dataValidation = { type: 'decimal', operator: 'between', allowBlank: true, showErrorMessage: true,
    errorTitle: 'Discount', error: 'Enter 0% to 100%.', formulae: [0, 1] };
  q.getColumn(1).width = 46; q.getColumn(2).width = 14; q.getColumn(3).width = 12; q.getColumn(4).width = 24; q.getColumn(5).width = 16; q.getColumn(6).width = 22;

  // ---- Job Profit
  const p = wb.addWorksheet('Job Profit');
  title(p, 'Job profit (private, do not send to the customer)', 'Reads the Quote sheet and your Rates.');
  head(p, 8, ['Service', 'On-site hours', 'Materials cost']);
  for (let r = L.LINE_FIRST; r <= L.LINE_LAST; r++) {
    p.getCell(`A${r}`).value = { formula: `IF(Quote!A${r}="","",Quote!A${r})` };
    p.getCell(`B${r}`).value = { formula: `IF(Quote!A${r}="",0,Quote!B${r}*IFERROR(VLOOKUP(Quote!A${r},${RATES_TABLE},4,FALSE),0)/60)` };
    p.getCell(`C${r}`).value = { formula: `IF(Quote!A${r}="",0,Quote!B${r}*IFERROR(VLOOKUP(Quote!A${r},${RATES_TABLE},5,FALSE),0))` };
    p.getCell(`B${r}`).numFmt = '0.00'; p.getCell(`C${r}`).numFmt = MONEY;
  }
  p.getCell('A22').value = 'Totals'; p.getCell('A22').font = { bold: true };
  p.getCell('B22').value = { formula: `SUM(B${L.LINE_FIRST}:B${L.LINE_LAST})` }; p.getCell('B22').numFmt = '0.00';
  p.getCell('C22').value = { formula: `SUM(C${L.LINE_FIRST}:C${L.LINE_LAST})` }; p.getCell('C22').numFmt = MONEY;
  const sum = [
    [24, 'Revenue before tax', 'Quote!E26', MONEY],
    [25, 'Labour cost', 'B22*Rates!B4', MONEY],
    [26, 'Materials cost', 'C22', MONEY],
    [27, 'Travel cost', 'Quote!B5*Rates!B5', MONEY],
    [28, 'Total cost', 'SUM(B25:B27)', MONEY],
    [29, 'Profit', 'B24-B28', MONEY],
    [30, 'Margin', 'IF(B24=0,0,B29/B24)', '0.0%'],
    [31, 'Profit per on-site hour', 'IF(B22=0,0,B29/B22)', MONEY],
    [32, 'Verdict', 'IF(B24=0,"",IF(B30>=Rates!B9,"On target","Below target margin - raise price or cut scope"))', '@'],
  ];
  sum.forEach(([r, label, f, fmt]) => {
    p.getCell(`A${r}`).value = label; p.getCell(`A${r}`).font = { bold: true };
    p.getCell(`B${r}`).value = { formula: f }; p.getCell(`B${r}`).numFmt = fmt; p.getCell(`B${r}`).fill = GREY;
  });
  p.getColumn(1).width = 40; p.getColumn(2).width = 22; p.getColumn(3).width = 18;
  for (const ws of [st, rt, q, p]) {
    ws.pageSetup = { ...ws.pageSetup, orientation: ws === rt ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }
  // No password: protection only prevents accidental overwrites.
  q.protect('', { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true });
  p.protect('', { selectLockedCells: true, selectUnlockedCells: true });
  return wb;
}

/** Fill the Quote sheet with a job (used by tests and the preview renderer). */
export function fillJob(wb, job) {
  if (job.lines.length > L.LINE_LAST - L.LINE_FIRST + 1) throw new Error('Too many quote lines');
  const q = wb.getWorksheet('Quote');
  q.getCell(L.QUOTE.customer).value = job.customer ?? 'Sample Customer';
  q.getCell(L.QUOTE.date).value = new Date('2026-06-01T00:00:00Z');
  q.getCell(L.QUOTE.miles).value = job.miles ?? 0;
  q.getCell(L.QUOTE.discount).value = job.discountPct ?? 0;
  job.lines.forEach((line, i) => {
    q.getCell(`A${L.LINE_FIRST + i}`).value = line.service;
    q.getCell(`B${L.LINE_FIRST + i}`).value = line.qty;
  });
}

export async function writeAll(outDir = path.join(root, 'dist')) {
  fs.mkdirSync(outDir, { recursive: true });
  const files = [];
  for (const t of loadTrades()) {
    const f = path.join(outDir, `${t.id}-quote-calculator.xlsx`);
    await buildWorkbook(t).xlsx.writeFile(f); files.push(f);
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = await writeAll();
  console.log(files.map((f) => path.relative(root, f)).join('\n'));
}
