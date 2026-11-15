/**
 * HTTP API. GET /check?name=lodash&ecosystem=npm is paid through x402 (USDC).
 * /health and /sample are free. The payment middleware only settles when the
 * handler returns a successful status, so registry failures (502) are not
 * charged.
 */

import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
} from "@x402/extensions/bazaar";
import { checkPackage, parseSpec, InputError } from "../core/check.js";
import { normalizeName } from "../core/similarity.js";
import { SAMPLE_REPORT } from "./sample.js";
import { TtlCache } from "./cache.js";

export const NETWORKS = Object.freeze({
  testnet: "eip155:84532", // Base Sepolia, free test USDC
  mainnet: "eip155:8453", // Base, real USDC
});

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * Read and validate configuration. Throws on anything unsafe; there is no
 * default pay-to address on purpose.
 *
 * @param {Record<string, string | undefined>} env
 */
export function loadConfig(env) {
  const payTo = env.PAY_TO_ADDRESS;
  if (!payTo || !EVM_ADDRESS.test(payTo)) {
    throw new Error(
      "PAY_TO_ADDRESS must be set to the public 0x address of a wallet you control (Base). Never put a private key here.",
    );
  }
  const mode = env.PKG_GUARD_NETWORK ?? "testnet";
  if (!(mode in NETWORKS)) {
    throw new Error('PKG_GUARD_NETWORK must be "testnet" or "mainnet".');
  }
  const cdp = { id: env.CDP_API_KEY_ID, secret: env.CDP_API_KEY_SECRET };
  if (mode === "mainnet" && !(cdp.id && cdp.secret)) {
    throw new Error(
      "Mainnet needs CDP_API_KEY_ID and CDP_API_KEY_SECRET (Coinbase facilitator).",
    );
  }
  const price = env.PKG_GUARD_PRICE ?? "$0.005";
  if (!/^\$\d+(\.\d{1,6})?$/.test(price) || Number(price.slice(1)) > 1) {
    throw new Error(
      'PKG_GUARD_PRICE must look like "$0.005" and be at most $1 per check.',
    );
  }
  return {
    payTo,
    mode,
    network: NETWORKS[mode],
    price,
    facilitatorUrl:
      env.FACILITATOR_URL ??
      (mode === "testnet" ? "https://x402.org/facilitator" : undefined),
    cdp,
    publicUrl: env.PUBLIC_URL,
  };
}

async function facilitatorFor(config) {
  if (config.mode === "mainnet") {
    const { createFacilitatorConfig } = await import("@coinbase/x402");
    return new HTTPFacilitatorClient(
      createFacilitatorConfig(config.cdp.id, config.cdp.secret),
    );
  }
  return new HTTPFacilitatorClient({ url: config.facilitatorUrl });
}

/**
 * @param {ReturnType<typeof loadConfig>} config
 * @param {{ check?: typeof checkPackage, facilitator?: object, syncFacilitatorOnStart?: boolean }} [deps]
 */
export async function createApp(config, deps = {}) {
  const check = deps.check ?? checkPackage;
  const cache = new TtlCache({ ttlMs: 5 * 60_000, max: 500 });
  const app = new Hono();

  const resourceServer = new x402ResourceServer(
    deps.facilitator ?? (await facilitatorFor(config)),
  )
    .register(config.network, new ExactEvmScheme())
    .registerExtension(bazaarResourceServerExtension);

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "pkg-guard",
      network: config.network,
      mode: config.mode,
      earning: config.mode === "mainnet",
    }),
  );
  app.get("/sample", (c) => c.json(SAMPLE_REPORT));

  app.use(
    paymentMiddleware(
      {
        "GET /check": {
          accepts: [
            {
              scheme: "exact",
              price: config.price,
              network: config.network,
              payTo: config.payTo,
              maxTimeoutSeconds: 60,
            },
          ],
          description:
            "Safety report for an npm or PyPI package: exists, age, publisher change, install scripts, lookalike names, risk score.",
          mimeType: "application/json",
          extensions: {
            ...declareDiscoveryExtension({
              method: "GET",
              input: { name: "lodash", ecosystem: "npm" },
              inputSchema: {
                properties: {
                  name: { type: "string", description: "Package name" },
                  ecosystem: { type: "string", enum: ["npm", "pypi"] },
                },
                required: ["name"],
              },
              output: { example: SAMPLE_REPORT },
            }),
          },
        },
      },
      resourceServer,
      undefined,
      undefined,
      deps.syncFacilitatorOnStart ?? true,
    ),
  );

  app.get("/check", async (c) => {
    let target;
    try {
      target = parseSpec(
        c.req.query("name") ?? "",
        c.req.query("ecosystem") ?? "npm",
      );
    } catch (error) {
      if (error instanceof InputError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
    const key = `${target.ecosystem}:${normalizeName(target.ecosystem, target.name)}`;
    let report = cache.get(key);
    if (!report) {
      report = await check(target);
      if (report.verdict !== "unknown") cache.set(key, report);
    }
    // Registry trouble must not look like a successful (billable) answer.
    return c.json(report, report.verdict === "unknown" ? 502 : 200);
  });

  return app;
}
