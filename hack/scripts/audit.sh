#!/usr/bin/env bash
set -euo pipefail

echo "[audit] Running npm audit report"
set +e
npm audit report
report_exit=$?
set -e

if [[ $report_exit -ne 0 ]]; then
  echo "[audit] npm audit report reported issues (exit $report_exit). Continuing to npm audit fix..."
fi

echo "[audit] Running npm audit fix"
npm audit fix

echo "[audit] Done"
