#!/usr/bin/env bash
# Broadcast testnet demo runs. Preserve every raw run and stop on the first failure.
set -u
set -o pipefail
export PATH="$HOME/.cre/bin:$HOME/.bun/bin:$PATH"
export TZ=UTC
cd "$(dirname "$0")/.." || exit 1
evidence=${1:?Usage: recording-runner.sh /absolute/path/to/evidence}
mkdir -p "$evidence"
log="$evidence/runner.log"
run=0
while [[ -e "$evidence/run-$(printf '%02d' "$((run + 1))").log" ]]; do
  run=$((run + 1))
done
while [[ ! -e "$evidence/../stop.flag" ]]; do
  run=$((run + 1))
  raw="$evidence/run-$(printf '%02d' "$run").log"
  printf '[%s] CRE simulation %s · Monad testnet · broadcast\n' "$(date -u +%FT%TZ)" "$run" | tee -a "$log"
  cre workflow simulate my-workflow --target staging-settings --broadcast \
    --non-interactive --trigger-index 0 --skip-type-checks 2>&1 \
    | tee "$raw" \
    | awk '/USER LOG|failed|[Ee]rror|✗|RPC health|Initializing|Checking RPC|Compiling workflow/ {print; fflush()}' \
    | tee -a "$log"
  result=${PIPESTATUS[0]}
  if [[ "$result" -ne 0 ]] || grep -Eiq 'failed|error|✗|skipped,|RPC health check|not functioning properly' "$raw"; then
    printf 'STOPPED: this run needs attention. Full output: %s\n' "$raw" | tee -a "$log"
    exit 1
  fi
  if ! grep -q 'Workflow Simulation Result:' "$raw"; then
    printf 'STOPPED: the CLI did not confirm a simulation result.\n' | tee -a "$log"
    exit 1
  fi
  printf '[%s] Simulation completed successfully.\n' "$(date -u +%FT%TZ)" | tee -a "$log"
  if [[ "${CRE_RUN_ONCE:-0}" == 1 ]]; then break; fi
  for ((waited=0; waited<3; waited++)); do
    [[ -e "$evidence/../stop.flag" ]] && break
    sleep 1
  done
done
