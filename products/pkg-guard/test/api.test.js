import test from "node:test";
import assert from "node:assert/strict";
import { createApp, loadConfig } from "../src/api/app.js";

const ADDRESS = "0x" + "ab".repeat(20);

test("refuses to start without a valid payout address", () => {
  assert.throws(() => loadConfig({}), /PAY_TO_ADDRESS/);
  assert.throws(() => loadConfig({ PAY_TO_ADDRESS: "0x123" }), /PAY_TO_ADDRESS/);
  assert.throws(() => loadConfig({ PAY_TO_ADDRESS: "a".repeat(64) }), /PAY_TO_ADDRESS/);
});

test("mainnet requires facilitator credentials", () => {
  assert.throws(
    () => loadConfig({ PAY_TO_ADDRESS: ADDRESS, PKG_GUARD_NETWORK: "mainnet" }),
    /CDP_API_KEY_ID/,
  );
  assert.equal(loadConfig({ PAY_TO_ADDRESS: ADDRESS }).mode, "testnet");
});

// Minimal facilitator stand-in so the test never touches the network.
const facilitator = {
  getSupported: async () => ({
    kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:84532" }],
    extensions: [],
    signers: {},
  }),
  verify: async () => ({ isValid: false, invalidReason: "test" }),
  settle: async () => ({ success: false }),
};

test("/check without payment answers 402 with payment requirements", async () => {
  let called = 0;
  const app = await createApp(loadConfig({ PAY_TO_ADDRESS: ADDRESS }), {
    facilitator,
    check: async () => { called++; return { verdict: "low" }; },
  });
  const res = await app.request("/check?name=lodash");
  assert.equal(res.status, 402);
  assert.equal(called, 0, "unpaid requests must not run a lookup");
  const header = res.headers.get("payment-required");
  const body = header ? JSON.parse(Buffer.from(header, "base64").toString()) : await res.json();
  assert.equal(body.accepts[0].payTo.toLowerCase(), ADDRESS);
  assert.equal(body.accepts[0].network, "eip155:84532");
});

test("/health and /sample are free and honest about testnet", async () => {
  const app = await createApp(loadConfig({ PAY_TO_ADDRESS: ADDRESS }), { facilitator });
  const health = await (await app.request("/health")).json();
  assert.equal(health.earning, false);
  const sample = await app.request("/sample");
  assert.equal(sample.status, 200);
  assert.equal((await sample.json()).reportVersion, 1);
});

test("price must be a sane dollar amount", () => {
  for (const bad of ["5", "$5", "$0.5x", "free"]) {
    assert.throws(() => loadConfig({ PAY_TO_ADDRESS: ADDRESS, PKG_GUARD_PRICE: bad }), /PKG_GUARD_PRICE/, bad);
  }
  assert.equal(loadConfig({ PAY_TO_ADDRESS: ADDRESS, PKG_GUARD_PRICE: "$0.01" }).price, "$0.01");
});

test("mainnet puts the Base network and price into the requirements", async () => {
  const cfg = loadConfig({
    PAY_TO_ADDRESS: ADDRESS, PKG_GUARD_NETWORK: "mainnet",
    CDP_API_KEY_ID: "x", CDP_API_KEY_SECRET: "y",
  });
  assert.equal(cfg.network, "eip155:8453");
  const mainnetFacilitator = {
    ...facilitator,
    getSupported: async () => ({
      kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:8453" }],
      extensions: [], signers: {},
    }),
  };
  const app = await createApp(cfg, { facilitator: mainnetFacilitator });
  const res = await app.request("/check?name=lodash");
  assert.equal(res.status, 402);
  const body = JSON.parse(Buffer.from(res.headers.get("payment-required"), "base64").toString());
  assert.equal(body.accepts[0].network, "eip155:8453");
  assert.equal(body.accepts[0].amount, "5000");
});
