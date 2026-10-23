#!/bin/bash
# Restores the REA MCP registration, REA skill and the pinned JADX engine JAR
# in fresh Claude Code cloud containers. Idempotent and non-interactive.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

JAR_VERSION=0.7.1
JAR_SHA256=6e5eacf500b64292bfb73c49797c1958f6ee44646e43e868039ae7feb573ff75
JAR_DIR="$HOME/.local/share/rea/android"
JAR="$JAR_DIR/jadx-headless-mcp-$JAR_VERSION-all.jar"

verify() { echo "$JAR_SHA256  $JAR" | sha256sum -c - >/dev/null 2>&1; }

if ! verify; then
  mkdir -p "$JAR_DIR"
  curl -fL -sS -o "$JAR" \
    "https://github.com/1013503897/jadx-headless-mcp/releases/download/v$JAR_VERSION/jadx-headless-mcp-$JAR_VERSION-all.jar"
  verify || { rm -f "$JAR"; echo "JADX JAR SHA-256 mismatch" >&2; exit 1; }
fi

# Only the Claude Code registration, with the JAR path recorded; setup backs up
# existing configuration and does not install Hopper, Ghidra or Java.
REA_JADX_MCP_JAR="$JAR" npx -y rea-agents@latest setup --client claude_code --yes >/dev/null

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export REA_JADX_MCP_JAR=\"$JAR\"" >> "$CLAUDE_ENV_FILE"
fi
