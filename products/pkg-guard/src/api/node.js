#!/usr/bin/env node
import { serve } from "@hono/node-server";
import { createApp, loadConfig } from "./app.js";

let config;
try {
  config = loadConfig(process.env);
} catch (error) {
  console.error(`Refusing to start: ${error.message}`);
  process.exit(1);
}
const app = await createApp(config);
const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => {
  console.log(
    `pkg-guard listening on :${port} | network ${config.network} (${config.mode}) | ${config.price}/check | payouts to ${config.payTo}`,
  );
  if (config.mode !== "mainnet") {
    console.log("TESTNET: payments are test USDC and earn nothing.");
  }
});
