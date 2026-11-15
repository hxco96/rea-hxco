# pkg-guard: package safety check for AI coding agents

AI coding agents install npm and PyPI packages, sometimes ones that do not exist (hallucinated names) or that imitate a popular package. `pkg-guard` takes a package name and returns a JSON risk report in about a second, from public registry APIs only.

```json
{ "ecosystem": "npm", "name": "lodahs", "exists": true, "verdict": "medium", "riskScore": 40,
  "recommendation": "Review the reasons below before installing. Its name resembles \"lodash\"; ...",
  "reasons": [{ "signal": "lookalike_name", "points": 40, "detail": "..." }] }
```

Signals: exists (a registry 404 only), age, release burst, publisher change on the latest release, install scripts (npm lifecycle hooks, PyPI source-only builds), lookalike of a popular name, deprecated, linked repository, weekly downloads (npm only). Verdicts: `low`, `medium`, `high`, `does_not_exist`, `unknown`.

`unknown` means a registry timeout, 429, 5xx, a non-JSON reply, or a name with no installable release. It is never reported as "does not exist", and it is never charged (the API answers 502, the Actor skips the charge).

> **Scores are heuristics.** The weights are judgement, not measured false-positive rates, and the popular-name list is a ~450-name hand-picked seed. A `low` verdict is not a safety guarantee. Every report carries its own `limitations`.

One core function (`src/core/check.js`) serves every channel, so each listing sells identical data.

## Run it locally

Node 20+. No build step.

```bash
cd products/pkg-guard
npm install
npm test                          # 25 tests, no network needed
npm run smoke                     # offline 402 paywall check via a mock facilitator
node src/cli.js lodash pypi:requests
```

## The three sales channels, and who gets paid how

| Channel | Entry point | Price | How you are paid |
|---|---|---|---|
| **x402 API** | `npm run serve` (`src/api/`) | $0.005 per check | **USDC on Base straight to your wallet** (`PAY_TO_ADDRESS`, a public address only) |
| **Apify Actor** | `src/actor/`, `.actor/` | $0.005 per check (pay per event) | Apify payouts: PayPal, Wise or bank. **Not crypto.** |
| **MCP server** | `npm run mcp` (`src/mcp/`) | free | Nothing directly. It is the discovery channel that sends agents to the paid two. |

So the crypto requirement is met by the x402 channel only. If you want the Apify income in crypto too, you convert it yourself.

### x402 API

```bash
export PAY_TO_ADDRESS=0xYourPublicBaseAddress   # required; the server refuses to start without it
npm run serve                                   # testnet by default (Base Sepolia, free test USDC)
curl -i "localhost:8787/check?name=lodash"      # 402 Payment Required + payment requirements
curl localhost:8787/health                      # shows network and "earning": false on testnet
curl localhost:8787/sample                      # free static example report
```

- Fails closed: no valid address, no start. There is no default address. The server only ever holds your **public** address. It never sees a private key.
- Mainnet: `PKG_GUARD_NETWORK=mainnet` plus `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` (Coinbase facilitator). Testnet payments earn nothing, and the logs and `/health` say so.
- Price: `PKG_GUARD_PRICE` (default `$0.005`). Results are cached for 5 minutes.
- Offline check of the paywall: `npm run smoke` (or run `node scripts/mock-facilitator.js`, then `FACILITATOR_URL=http://localhost:8788 npm run serve`). The mock rejects every payment, so it proves the 402 gate only.

### Apify Actor

`apify login && apify push` from this folder. Input: `{ "packages": ["npm:lodash", "pypi:requests"] }`. Set the pay-per-event price in the Apify console using `.actor/pay_per_event.json` (event `package-check`, $0.005). Check Apify's current fee and minimum-price rules before pricing: they take a share and running costs come out of the payout, so very cheap checks can lose money.

### MCP server

`npm run mcp` speaks MCP over stdio with one tool, `check_package`. Example client config: `{ "command": "node", "args": ["/path/to/products/pkg-guard/src/mcp/server.js"] }`.

## Setup costs (budget: $100 maximum)

| Item | Cost | Needed to launch? |
|---|---|---|
| Hosting for the API on a free tier (Cloudflare, Fly, Render, or similar) | $0 | Yes |
| Apify account and Actor | $0 | Yes |
| Coinbase Developer Platform account and API key | $0 | Yes, for mainnet |
| Wallet (you create it; we never touch keys) | $0 | Yes |
| Domain name | about $12 per year | Optional but looks trustworthy |
| About $10 of USDC on Base, to pay your own API once end to end | about $10, mostly returned to your wallet | Recommended |
| Paid hosting tier if traffic exceeds free limits | about $5 per month | Only if needed |
| **Planned total** | **about $22 to launch, under $100 with reserve** | |

These figures are estimates from the earlier research session; confirm current prices when you sign up. Income is taxable.

## Listing steps

Only you can do the account steps (about 45 minutes, once).

1. **Wallet.** Create or pick a Base wallet. Copy only its public `0x` address.
2. **Host the API.** Deploy `npm run serve` to a free host with env vars `PAY_TO_ADDRESS`, `PKG_GUARD_NETWORK=mainnet`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `PUBLIC_URL`. Put the API key secret in the host's secret store, never in git.
3. **Test on testnet first**, then mainnet. Make one real $0.005 payment from a second wallet and confirm USDC lands at `PAY_TO_ADDRESS`.
4. **Discovery.** The 402 response already carries the x402 Bazaar discovery metadata. After the first successful mainnet payment through the Coinbase facilitator, the endpoint should appear in the Bazaar catalogue. Confirm in the CDP docs; indexing rules can change.
5. **Apify.** Create the account, add payout details, `apify push`, set the pay-per-event price, and publish to the Store with a clear title and the sample output.
6. **MCP.** Publish the MCP server (npm package or repository link) to an MCP registry once a public repository exists.
7. **Stop rule.** If both paid channels together earn under $25 by day 60, stop and pick the next idea.

## Not yet verified

Run in this prototype: unit tests with fixture registry responses, live CLI lookups against npm and PyPI, and the 402 gate through a mock facilitator. **Not run:** a real settled payment, a real Apify run, the Bazaar listing, an MCP client session, and npm weekly-download counts (the downloads API was unreachable from the build sandbox; the code treats that as unknown and does not penalise the package).

## Next steps

Refresh the popular-name list from registry download rankings. Add a maintainer-history signal for PyPI. Measure false positives on a labelled set before trusting the weights. Add rate limiting before a public launch.
