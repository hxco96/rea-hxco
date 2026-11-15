#!/usr/bin/env node
/**
 * MCP stdio server exposing one tool, check_package. Runs the check locally
 * against the public registries. It is the free discovery channel; it earns
 * nothing by itself and points agents at the paid API for hosted use.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkPackage, parseSpec, InputError } from "../core/check.js";

const server = new McpServer({ name: "pkg-guard", version: "0.1.0" });

server.registerTool(
  "check_package",
  {
    title: "Check package safety",
    description:
      "Before installing an npm or PyPI package, check that it exists, is not a lookalike of a popular package, and has no recent publisher change or install scripts. Returns a heuristic risk report, not a guarantee.",
    inputSchema: {
      name: z.string().describe("Package name, e.g. lodash or @scope/pkg"),
      ecosystem: z.enum(["npm", "pypi"]).default("npm"),
    },
  },
  async ({ name, ecosystem }) => {
    try {
      const report = await checkPackage(parseSpec(name, ecosystem));
      return {
        content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
        isError: report.verdict === "unknown",
      };
    } catch (error) {
      if (error instanceof InputError) {
        return { content: [{ type: "text", text: error.message }], isError: true };
      }
      throw error;
    }
  },
);

await server.connect(new StdioServerTransport());
