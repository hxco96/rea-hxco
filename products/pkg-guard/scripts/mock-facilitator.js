#!/usr/bin/env node
/**
 * Local stand-in for an x402 facilitator so the paywall can be exercised
 * offline. It advertises the testnet and rejects every payment, so it can
 * only ever prove the 402 gate, never a real settlement.
 */
import { createServer } from "node:http";

const port = Number(process.env.MOCK_FACILITATOR_PORT ?? 8788);
const send = (res, body) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  if (req.url?.startsWith("/supported")) {
    return send(res, {
      kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:84532" }],
      extensions: [],
      signers: {},
    });
  }
  if (req.url?.startsWith("/verify")) {
    return send(res, { isValid: false, invalidReason: "mock_facilitator" });
  }
  return send(res, { success: false, errorReason: "mock_facilitator" });
}).listen(port, () => console.log(`mock facilitator on :${port}`));
