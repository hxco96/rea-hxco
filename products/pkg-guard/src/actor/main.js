/**
 * Apify Actor wrapper. Input: { packages: ["npm:lodash", "pypi:requests"] }.
 * Each checked package is one pay-per-event charge ("package-check").
 * Run locally with `npm run actor` (uses ./storage) or deploy with `apify push`.
 */
import { Actor } from "apify";
import { checkPackage, parseSpec, InputError } from "../core/check.js";

await Actor.init();
try {
  const input = (await Actor.getInput()) ?? {};
  const specs = Array.isArray(input.packages) ? input.packages : [];
  const ecosystem = input.defaultEcosystem ?? "npm";
  if (specs.length === 0) {
    await Actor.fail("Input needs a non-empty `packages` list.");
  }
  for (const spec of specs.slice(0, 500)) {
    let item;
    try {
      const report = await checkPackage(parseSpec(spec, ecosystem));
      item = report;
      // Charge only for answers we actually produced, never lookup failures.
      if (report.verdict !== "unknown") {
        const charge = await Actor.charge({ eventName: "package-check" });
        if (charge?.eventChargeLimitReached) {
          await Actor.pushData(item);
          console.log("Maximum charge reached; stopping.");
          break;
        }
      }
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      item = { input: spec, error: error.message };
    }
    await Actor.pushData(item);
  }
} finally {
  await Actor.exit();
}
