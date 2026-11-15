import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTrades, root } from './build.js';

const cap = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// Etsy limits: title <= 140 chars, up to 13 tags, each tag <= 20 chars.
// Tags are whole phrases (never truncated). Trade-specific tags are hand-written.
export const TAG_MAX = 20, TAG_COUNT = 13, TITLE_MAX = 140;
const TRADE_TAGS = {
  'mobile-detailing': ['car detailing quote', 'detailing estimate', 'detailing pricing', 'detailer template', 'auto detail pricing'],
  'laser-engraving': ['laser pricing sheet', 'engraving quote', 'engraver estimate', 'laser business', 'engraving pricing'],
  'junk-removal': ['junk removal quote', 'hauling estimate', 'junk pricing sheet', 'hauling quote', 'junk business'],
  'window-cleaning': ['window cleaning quote', 'window cleaner quote', 'window pricing', 'cleaning estimate', 'window cleaner sheet'],
};
const GENERIC_TAGS = ['quote template', 'estimate template', 'pricing calculator', 'job profit tracker', 'excel template',
  'small business', 'service pricing', 'business spreadsheet', 'instant download', 'self employed'];

export function listingFor(t) {
  const trade = t.trade;
  const title = `${cap(trade)} Quote Calculator, Estimate Template, Job Profit Tracker, Excel Spreadsheet, Instant Download`;
  const pool = [...(TRADE_TAGS[t.id] ?? []), ...GENERIC_TAGS].filter((x) => x.length <= TAG_MAX);
  const tags = [...new Set(pool)].slice(0, TAG_COUNT);
  const description = `Price ${trade} jobs in minutes and see your profit before you send the quote.

WHAT YOU GET
- One Excel workbook (.xlsx)
- Rates sheet: your hourly cost, travel, minimum charge, tax and target margin, plus up to 20 of your own services
- Quote sheet: pick services from a drop-down, enter quantities, get a clean printable quote with your business name
- Job Profit sheet: labour, materials, travel, profit, margin and profit per hour, with a warning when a job is under your target margin
- Start Here sheet with setup steps

HOW IT WORKS
1. Replace the example rates with yours. The numbers shown are examples only, not market prices.
2. Add your own services.
3. Build a quote, save it as PDF, send it.

GOOD TO KNOW
- Digital download only. Nothing is shipped.
- Built for Microsoft Excel. Other spreadsheet apps may open it, but drop-down lists can behave differently.
- The formulas were checked against an independent reference calculation.
- Sheets are protected without a password, only to prevent accidental edits.
- A planning tool, not tax, legal or accounting advice.
- Created with the help of AI tools and reviewed by the seller. [Keep this line only if it matches Etsy's creation-process disclosure for your shop.]
- Digital items cannot be returned. If the file will not open or something is wrong, message me and I will fix it.`;
  return { id: t.id, title, tags, description };
}

export function writeListings(outDir = path.join(root, 'listings')) {
  fs.mkdirSync(outDir, { recursive: true });
  const out = [];
  for (const t of loadTrades()) {
    const l = listingFor(t);
    const md = `# ${t.name}\n\n> **Do not publish until you have opened the .xlsx in real Excel and confirmed the drop-down and totals work (README step 1).**\n\n**Title (${l.title.length}/${TITLE_MAX}):** ${l.title}\n\n**Suggested price:** USD 9 to 12 (judgement, check comparable listings first)\n\n**Tags (${l.tags.length}/${TAG_COUNT}):** ${l.tags.join(', ')}\n\n**Files to upload:** dist/${t.id}-quote-calculator.xlsx, previews/${t.id}-*.png\n\n## Description\n\n${l.description}\n`;
    const f = path.join(outDir, `${t.id}.md`); fs.writeFileSync(f, md); out.push(f);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(writeListings().join('\n'));
