# quote-sheets: trade quote and profit calculators, sold as Etsy digital downloads

A small generator that builds Excel (and Google Sheets compatible) **quote + job-profit calculators** for micro-service trades, plus ready-to-paste Etsy listing text and preview images. Four trades are included: mobile car detailing, laser engraving, junk removal, window cleaning.

> **Honest expectation (judgement, not data).** Etsy is a real marketplace with built-in buyers, but spreadsheet templates are crowded. A fair guess for four listings is **$0 to roughly $75 in the first 90 days**, with maybe a **10 to 25% chance of at least one sale in 60 days** for a brand-new shop with no reviews (judgement, and **provisional**: it rests on none of the four trades having been checked for crowding yet, see step 2 below). It is not a salary. It becomes "mostly hands-off" only after the one-time setup below, and it only grows if you add more listings.

## What was verified and what was not

| Claim | Status |
|---|---|
| Workbooks build, with formulas and drop-down validation present, and the Quote sheet marked protected | Verified (`npm test`). Profit sheet protection is not asserted separately |
| Every spreadsheet formula matches an independent JavaScript model, on 3 jobs per trade (12 jobs), plus edge cases: empty quote, unknown service, blank quantity, discount with minimum charge | Verified: each workbook is filled in, recalculated by real LibreOffice, and the results compared |
| Etsy title and tag limits (140 chars, 13 whole-phrase tags, 20 chars each) | Checked by tests |
| Preview images render | Verified by eye on one trade (LibreOffice rendering, not Excel) |
| Opens correctly in **Microsoft Excel** (and Google Sheets) | **NOT verified.** Only LibreOffice was available. The listings therefore claim Excel only, and say Excel in the title. Open each file in real Excel before listing |
| Demand, sale prices and sale counts | **NOT verified.** All revenue figures here are judgement |
| Etsy fees and rules | Fees checked on Etsy's policy page: $0.20 per listing, 6.5% transaction fee, plus payment processing (about 3% + $0.25 for a US bank account). Etsy likely also charges a one-time shop setup fee of about $15 in many countries (**unchecked**, confirm in the dashboard). That still fits the under-$20 estimate |
| How crowded each of the four trades is on Etsy | **NOT verified.** Pressure washing was checked and has 8+ result pages of near-identical listings, so it was left out. Do the 15-minute check below for the rest |

## How it makes money, and what you keep

Price about $9 to $12 per listing (judgement). Per $9 sale Etsy fees come to roughly $1.40 (listing renewal $0.20, 6.5%, 3% + $0.25), so you net about **$7.60**. Nothing ships, nothing needs support in the normal case.

## The options that were compared

All "odds" and "autonomy" scores are my judgement. Evidence is noted where I actually looked.

| Option | Viability | Autonomy after setup | Setup cost | Odds of a first sale in ~60 days (judgement) | Verdict |
|---|---|---|---|---|---|
| **A. Trade quote spreadsheets on Etsy** (this PR) | Real marketplace and real buyers; crowded niche, differentiate by trade and tested formulas | High (instant digital delivery) | about $1 to $20 | 10 to 25% | **Picked, provisional** |
| B. Apify Actor on government data, pay per event | Market exists, but I probed 8 topics (recalls, SEC Form D, OSHA, FDA warning letters, CFPB, EPA ECHO, Federal Register, FCC) and **each already has 4 to 5+ near-identical Actors priced about $1 to $2 per 1,000 results** | Medium (breaks when a source changes) | $0 | 5 to 10% | Dropped on that evidence. Apify keeps 20% plus compute and payout minimums apply |
| C. Programmatic SEO site (Cloudflare Pages) with affiliate and ads | Real, but a new domain takes months to rank | High | about $12 domain | under 10% in 60 days | Dropped: too slow for a first sale |
| D. Dataset sold on Gumroad or Lemon Squeezy | Good product shape, but no marketplace search, so no audience means no buyers | High | $0 | under 10% | Dropped |
| E. Paid Chrome extension | Weak discovery plus licensing and support work | Low | $5 store fee | 5 to 10% | Dropped |
| F. Sponsored newsletter | Needs an audience first | Low | $0 | under 5% | Dropped |

Already rejected earlier: the package safety checker (PR #6) and AI-agent pay-per-call APIs.

## Run it

Needs Node 20+. For the tests and preview images also LibreOffice (`soffice`) and `pdftoppm`.

```bash
cd products/quote-sheets
npm install
npm test            # 11 tests, recalculated with LibreOffice
npm run build       # writes dist/<trade>-quote-calculator.xlsx
npm run listings    # writes listings/<trade>.md
npm run previews    # writes previews/<trade>-N.png
```

Add a trade by copying a file in `trades/` and editing the JSON (services, example rates, keywords). Rerun the commands. The tests cover every trade file automatically.

The ready-made outputs are committed: `dist/` (the .xlsx files), `listings/` (Etsy text), `previews/` (images).

## What only you can do (about 1.5 hours once, then occasional)

I cannot create accounts, pay, upload or receive money. These steps are yours:

1. **Open each `.xlsx` in real Excel.** Check the drop-down on the Quote sheet works, a quote total updates, and no repair prompt appears. If anything looks off, tell me and I will fix it. Do this before listing. (Google Sheets is untested; do not advertise it unless you test it yourself.)
2. **15-minute crowding check per trade.** On Etsy search "[trade] quote template", "[trade] estimate calculator" and "[trade] pricing spreadsheet". Keep a trade if top listings show many sales yet fewer than about a page of close matches. Drop or reword trades that look swamped.
3. **Decide the rates.** The numbers in the workbooks are examples, not market data, and the listing says so.
4. **Create the Etsy seller account** yourself. Etsy asks for identity verification and a **bank account for payouts**. A prepaid card may not be accepted for the payout side, so check this first, and use your real details only. Use your own card for fees.
5. **Create one listing per trade** from `listings/<trade>.md`: paste the title, tags and description, upload the `.xlsx` as the digital file, and upload the `previews/` images. Answer Etsy's "who made this and how" questions truthfully. The files are generated by code written with AI assistance, so disclose AI involvement where Etsy asks.
6. **Check Etsy fees in your seller dashboard** before paying anything. Four listings should cost about $0.80 in listing fees. If a one-time setup fee appears, confirm it before you accept.
7. **Keep most of your $100.** Expected spend is under $20 (about $0.80 of listing fees, plus a possible one-time setup fee of about $15). I would not spend any of it on Etsy ads until a listing has shown a sale.
8. **Later:** if a trade sells, copy its pattern into more trades (ask me), and put the bundle of all four on sale. If nothing sells in 60 to 90 days, retitle the tags once, then stop.

Never share card numbers, passwords or keys with me. None of the above needs them.

## Known limits

- Hours on Job Profit are on-site work only (no driving time). Tax is a flat rate. It is a planning tool, not tax, legal or accounting advice.
- Sheets are protected without a password, only to stop accidental edits.
- Previews come from LibreOffice, so fonts differ slightly from Excel. They are rendered at roughly 2000 px.
- A discount can never take a job below your minimum charge: the minimum is topped up afterwards.
- The listing text has an AI-disclosure line. Match it to whatever Etsy's creation-process questions ask.
- Income from sales is taxable and Etsy may issue tax forms. That is yours to handle.
- Do not copy competitors' text or images, and do not use brand names in tags.
