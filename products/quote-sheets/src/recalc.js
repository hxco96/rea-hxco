import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Recalculate an .xlsx with headless LibreOffice and return the path of the recalculated copy. */
export function recalc(file) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'qs-recalc-'));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qs-lo-'));
  execFileSync('soffice', [`-env:UserInstallation=file://${profile}`, '--headless', '--convert-to', 'xlsx', '--outdir', out, file],
    { stdio: 'pipe', timeout: 120000 });
  return path.join(out, path.basename(file));
}
export const hasLibreOffice = () => {
  try { execFileSync('soffice', ['--version'], { stdio: 'pipe' }); return true; } catch { return false; }
};
