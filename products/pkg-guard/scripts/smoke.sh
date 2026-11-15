#!/usr/bin/env bash
# Offline paywall check: mock facilitator + real server, expect HTTP 402.
# Proves the gate only. It cannot prove a payment settles.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/mock-facilitator.js >/dev/null & MOCK=$!
PAY_TO_ADDRESS=0x000000000000000000000000000000000000dEaD \
  FACILITATOR_URL=http://localhost:8788 PORT=8801 node src/api/node.js >/dev/null & API=$!
trap 'kill $MOCK $API 2>/dev/null' EXIT
sleep 3
code=$(curl -s -o /dev/null -w '%{http_code}' "localhost:8801/check?name=lodash")
sample=$(curl -s -o /dev/null -w '%{http_code}' "localhost:8801/sample")
echo "/check unpaid -> $code (want 402), /sample -> $sample (want 200)"
[ "$code" = 402 ] && [ "$sample" = 200 ]
