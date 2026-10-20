#!/usr/bin/env bash
# Runs the Cowrie CRE workflow on a loop with no prompts: draws full circles, settles ended rounds,
# pulls auto-pay shares. Stop with Ctrl+C.
cd "$(dirname "$0")/../cowrie-cre" || exit 1
while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] run"
  cre workflow simulate my-workflow --target staging-settings --broadcast --non-interactive --trigger-index 0 --skip-type-checks 2>&1 | grep -E "USER LOG|failed|rror|✗"
  sleep 3
done
