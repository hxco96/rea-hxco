import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTrades, buildWorkbook, fillJob, root } from './build.js';

/** Renders a filled-in sample job to PNG previews via LibreOffice + pdftoppm (both must be installed). */
export async function renderPreviews(outDir = path.join(root, 'previews')) {
  fs.mkdirSync(outDir, { recursive: true });
  const made = [];
  for (const t of loadTrades()) {
    const [a, b, c] = t.services;
    const wb = buildWorkbook(t);
    fillJob(wb, { customer: 'Sample Customer', miles: 12, discountPct: 0.05,
      lines: [{ service: a.name, qty: 2 }, { service: b.name, qty: 1 }, { service: c.name, qty: 3 }] });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qs-prev-'));
    const x = path.join(tmp, `${t.id}.xlsx`); await wb.xlsx.writeFile(x);
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qs-lo-'));
    execFileSync('soffice', [`-env:UserInstallation=file://${profile}`, '--headless', '--convert-to', 'pdf', '--outdir', tmp, x], { stdio: 'pipe', timeout: 120000 });
    execFileSync('pdftoppm', ['-png', '-r', '220', path.join(tmp, `${t.id}.pdf`), path.join(outDir, t.id)], { stdio: 'pipe' });
    made.push(...fs.readdirSync(outDir).filter((f) => new RegExp(`^${t.id}-\\d+\\.png$`).test(f)));
  }
  return made;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log((await renderPreviews()).join('\n'));
