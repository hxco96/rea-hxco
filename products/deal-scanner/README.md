# deal-scanner (prototype)

A decision aid for physical-goods resale arbitrage. It reads deal feeds, matches each deal to a
resale price reference **you** supply, subtracts fees/shipping/risk, flags traps, and writes a ranked
HTML/JSON shortlist with the buy link and exact steps. **You press buy.**

```
python3 -m deal_scanner --offline --all          # fake fixture data, writes shortlist.html
python3 -m deal_scanner --feed <RSS_URL> --comps my_comps.csv
python3 -m deal_scanner --ai claude ...          # optional, needs ANTHROPIC_API_KEY (costs money)
python3 -m unittest discover -s tests            # stdlib only, Python 3.9+
```

## Read this first (blunt)

- This is **not a money machine.** Retail arbitrage is crowded. A deal on a public feed has been seen
  by thousands of people; the edge is usually gone in minutes. Expect most alerts to be unprofitable or dead.
- Truly "enormous" discounts are rare and are mostly **pricing errors**. Retailers often cancel those
  orders, so you may wait, then get a refund and nothing else. The tool flags `PRICING_ERROR_LIKELY`.
- Fees, shipping, returns and sales tax eat margins. With **~$100** you can fund about 1-3 items at a time,
  so absolute profit is small and a single bad buy (counterfeit, return fraud, cancelled order) can wipe out the bankroll. You can lose the whole $100.
- Resale has rules: some categories are gated, some brands are counterfeit-prone, marketplaces have
  policies, and you owe taxes on income. You are responsible for ToS, tax and authenticity.
- **All profit and confidence numbers are judgement from assumptions in `config.py`, not data.**
  The fee rates, shipping defaults and risk margins are my approximations and are unverified; check them.
- Resale comps are the weak point. I do **not** scrape sold-listing pages (ToS risk, and they break).
  Instead you fill `comps.csv` (title,price,kind,n) from the marketplace "Sold items" filter, ~2 minutes per item.
  `kind=asking` comps are shaved by 20% and get low confidence. With no comp the tool says "unknown", never a guess.
- The AI layer only classifies and rewrites explanations. It never sets prices and cannot remove a flag: flags and numbers are computed by rules first, and a model-written explanation is discarded unless it still contains the profit figure and names every risk flag.
  On any API error it falls back to the offline heuristic.

## Why there is no auto-buying

Acquiring is deliberately human-in-the-loop. Autonomous purchasing would mean storing card numbers or
logins and bypassing checkout protections, which is unsafe and often against retailer terms. The tool
prepares the link and a checklist (verify price, variant, stock, sold comps, then you pay with your own
method). That is the honest limit; faking full automation would just be a risk to your money.

## What is verified vs not

Verified (in this repo, `python3 -m unittest discover -s tests`, 14 tests passing):
RSS/Atom parsing, price extraction, robots.txt fail-closed logic (with injected fetcher), comp matching
(model numbers must overlap), profit arithmetic, flags, ranking, Claude fallback, HTML escaping, CLI.

**Not verified:**
- **No live fetch was ever run.** The build sandbox blocked outbound access to Slickdeals, Reddit and
  DealNews (proxy returned 403), so real feeds, their robots.txt/ToS, and their formats are untested.
  Run it from your own machine and check each site's terms before polling.
- The Claude path was only tested with a simulated failing HTTP opener, not a real API call.
- Whether any real deal clears `MIN_PROFIT` / `MIN_ROI`. The fixture data is **fake**.
- Marketplace fee table, API quotas and tax rules.

## Only you can do

1. Create selling/marketplace accounts (identity checks, payout setup; new sellers may have payouts held).
2. Choose payment method (a debit card has weaker buyer protection than credit) and make every purchase.
3. Build `comps.csv` from real sold listings; log results to tune `config.py`.
4. Check each feed's terms and, if you want AI, create an API key (set a spend cap; keep it in an env var, never in code).
5. Handle shipping, returns, taxes/resale certificates for your state.

Budget: the tool costs $0 to run (stdlib, offline heuristics). Optional Claude calls are cents. The $100 is for inventory.

## Layout

`deal_scanner/` sources/rss.py (feeds + robots), comps.py, normalize.py, flags.py, profit.py, ai.py, report.py, cli.py, config.py.
Not built yet: marketplace API sources, sqlite dedupe/"seen" store, email alerts, ETag caching/rate limiting
(fetch is once per run, no retries, no evasion by design).

## Known limits (from review)

- Title matching is crude. Model-number sets must be equal when both titles have them, but titles
  without model numbers can still mismatch on variant/size/bundle. Always confirm the match by eye.
- Price parsing is heuristic ("now $X" preferred; "save $X"/"$X off" dropped). Verify on the retailer page.
- A missing robots.txt (404) blocks a feed (fail-closed); redirects are not re-checked; RSS 1.0 (RDF) feeds are not parsed.
- The capital cap ignores sales tax.
