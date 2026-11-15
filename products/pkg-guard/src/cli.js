#!/usr/bin/env node
import { checkPackage, parseSpec, InputError } from "./core/check.js";

const args = process.argv.slice(2);
const ecosystemFlag = args.indexOf("--ecosystem");
let defaultEcosystem = "npm";
if (ecosystemFlag !== -1) {
  defaultEcosystem = args[ecosystemFlag + 1];
  args.splice(ecosystemFlag, 2);
}

if (args.length === 0 || args.includes("--help")) {
  console.error(
    "Usage: pkg-guard [--ecosystem npm|pypi] <name | npm:name | pypi:name>...",
  );
  process.exit(args.length === 0 ? 2 : 0);
}

let exitCode = 0;
for (const spec of args) {
  try {
    const report = await checkPackage(parseSpec(spec, defaultEcosystem));
    console.log(JSON.stringify(report, null, 2));
    if (report.verdict === "high" || report.verdict === "does_not_exist") {
      exitCode = Math.max(exitCode, 1);
    }
    if (report.verdict === "unknown") exitCode = 3;
  } catch (error) {
    console.error(error instanceof InputError ? error.message : error);
    exitCode = 2;
  }
}
process.exit(exitCode);
