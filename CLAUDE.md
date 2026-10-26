# CLAUDE.md

Guidance for Claude Code in this repository. The shared agent rules live in
[AGENTS.md](AGENTS.md) and are imported below; follow them as written. This file
only adds what is specific to Claude Code and to this fork.

@AGENTS.md

## This repository

- `hxco96/rea-hxco` is a personal fork of [morluto/rea](https://github.com/morluto/rea)
  ("REA: Reverse Engineer Anything"), published upstream as the `rea-agents` npm
  package. Default branch is `main`. Links in README, CONTRIBUTING and the PR
  template point at upstream; open PRs against this fork unless told otherwise.
- Node.js is pinned by [.nvmrc](.nvmrc) (24.x) and npm by
  `package.json#packageManager`. TypeScript sources in `src/`, built with Turbo
  (see the Turborepo block in AGENTS.md before touching `turbo.json`).
- Git submodules in `third_party/` (jadx-headless-mcp, binwalk, unblob,
  ghidra-nativeaot, wakaru) are upstream code; do not edit them in place.

## Layout

| Path                                      | Contents                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/cli.ts`, `src/cli/`                  | One-shot CLI adapter (`rea ...`)                                                                                               |
| `src/main.ts`, `src/main/`, `src/server/` | MCP server adapter, tool registration                                                                                          |
| `src/composition/`                        | Production wiring of providers and sessions                                                                                    |
| `src/application/`                        | Shared CLI/MCP workflows, setup, doctor, investigations                                                                        |
| `src/domain/`, `src/contracts/`           | Domain semantics and contracts (innermost layer)                                                                               |
| `src/providers/`, `src/<engine>/`         | Provider adapters (`hopper`, `ghidra`, `ida`, `cutter`, `rizin`, `android`, `browser`, `frida`, ...)                           |
| `src/process/`                            | Child-process supervision and ownership primitives; reuse these                                                                |
| `bridge/`                                 | Code that runs inside engines (Hopper Python, Ghidra Java, etc.)                                                               |
| `scripts/`                                | Build, generation and `verify-*` scripts; `scripts/rea.mjs` is the `rea` binary                                                |
| `tests/`                                  | Acceptance, boundary, conformance and composition suites; unit tests sit next to sources as `*.test.ts`                        |
| `docs/`                                   | User and contributor docs; `docs/architecture.mermaid`, `docs/tool-design.md`, `docs/testing.md` are the key design references |
| `.agents/skills/`                         | Authored agent skills (the `skills/` output directory is generated and ignored)                                                |
| `website/`                                | rea.tools site sources                                                                                                         |

## Working in Claude Code

- Cloud sessions: `.claude/hooks/session-start.sh` runs on SessionStart only
  when `CLAUDE_CODE_REMOTE=true`. It downloads the pinned, SHA-256-checked JADX
  headless MCP JAR, registers REA for Claude Code via
  `npx rea-agents@latest setup --client claude_code --yes`, and exports
  `REA_JADX_MCP_JAR`. Keep it idempotent and non-interactive.
- `.claude/settings.json` pre-allows the `mcp__rea` tools and the
  `reverse-engineer-anything` skill. Use those for analysis tasks rather than
  ad-hoc scripts.
- Run `npm ci` before building or testing. Husky hooks run `lint-staged` on
  commit and `npm run check:fast` on push, so both need installed dependencies.
- Prefer the narrowest check that covers the change:
  `npm run test:local -- <paths>` for source tests,
  `npm run test:focused -- <paths>` when built artifacts are needed, then
  `npm run check:fast`. Run `npm run docs:check` after editing docs that feed
  generated output.
- Commits and PR titles use Conventional Commits (`type(scope): outcome`); CI
  checks the PR title.
- PRs use [.github/pull_request_template.md](.github/pull_request_template.md).
  Leave the **Author readiness** checkboxes for the human owner and keep the PR
  in draft until they declare it ready.

## Automation

`.github/workflows/ai-agent-developer.yml` runs `anthropics/claude-code-action`
when the repository owner adds the `build-feature` label to an issue. It works
on a new `claude/` branch and never pushes to `main`. The remaining workflows
(`ci.yml`, `ci-full-pr.yml`, `real-*.yml`, release and Pages jobs) are inherited
from upstream.
