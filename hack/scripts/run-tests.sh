#!/usr/bin/env bash
set -euo pipefail

if node -e "const p=require('./package.json');process.exit((p.scripts&&p.scripts['test:unit'])?0:1)"; then
  echo "[test] Running test:unit"
  npm run test:unit
elif node -e "const p=require('./package.json');process.exit((p.scripts&&p.scripts['test'])?0:1)"; then
  echo "[test] Running test"
  npm test -- --ci
else
  echo "[test] No test script configured (expected test:unit or test). Skipping."
fi
