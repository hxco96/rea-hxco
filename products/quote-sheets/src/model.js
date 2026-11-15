// Pure reference implementation of the quote and profit maths.
// The spreadsheet formulas are checked against this in test/workbook.test.js
// by recalculating the real .xlsx with LibreOffice, so a formula typo fails a test.

const r2 = (n) => Math.round((n + Number.EPSILON * Math.sign(n)) * 100) / 100;

export function computeJob(trade, job) {
  const s = trade.settings;
  const svc = new Map(trade.services.map((x) => [x.name, x]));
  let subtotal = 0, hours = 0, materials = 0;
  for (const line of job.lines) {
    const x = svc.get(line.service);
    if (!x) throw new Error(`Unknown service: ${line.service}`);
    subtotal += r2(line.qty * x.price);
    hours += (line.qty * x.minutes) / 60;
    materials += line.qty * x.materials;
  }
  subtotal = r2(subtotal);
  const miles = job.miles ?? 0;
  const travel = r2(miles * s.travelChargePerMile);
  const discount = r2(-(subtotal + travel) * (job.discountPct ?? 0));
  const topUp = subtotal === 0 ? 0 : r2(Math.max(0, s.minimumCharge - (subtotal + travel + discount)));
  const preTax = r2(subtotal + travel + discount + topUp);
  const tax = r2(preTax * s.taxRate);
  const total = r2(preTax + tax);
  const labourCost = hours * s.labourCostPerHour;
  const travelCost = miles * s.travelCostPerMile;
  const cost = labourCost + materials + travelCost;
  const profit = preTax - cost;
  const margin = preTax === 0 ? 0 : profit / preTax;
  const perHour = hours === 0 ? 0 : profit / hours;
  const verdict = preTax === 0 ? '' : margin >= s.targetMargin ? 'On target' : 'Below target margin - raise price or cut scope';
  return { subtotal, travel, discount, topUp, preTax, tax, total, hours, materials, labourCost, travelCost, cost, profit, margin, perHour, verdict };
}
