#!/usr/bin/env bash
# Launch 13 sharded agents in parallel, each handling ~10 leads.
# Usage:
#   ./scripts/run_agents.sh              # all 13 shards
#   ./scripts/run_agents.sh 3            # only shard 3
#   ./scripts/run_agents.sh --limit 2    # dry run, 2 per shard
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NUM_SHARDS=13
LIMIT_ARG=""
FORCE=""
SHARD_FILTER=""

for arg in "$@"; do
  case "$arg" in
    --limit=*) LIMIT_ARG="$arg" ;;
    --limit) echo "use --limit=N"; exit 1 ;;
    --force) FORCE="--force" ;;
    [0-9]* ) SHARD_FILTER="$arg" ;;
    *) LIMIT_ARG="$arg" ;;
  esac
done

run_one() {
  local shard=$1
  echo "=== launching agent shard $shard ==="
  python3 scripts/fetch_pfps_v2.py --shard "$shard" --num-shards "$NUM_SHARDS" $LIMIT_ARG $FORCE --shards-file data/pfp_shards.json 2>&1 | sed "s/^/[shard $shard] /" &
}

if [ -n "${SHARD_FILTER:-}" ]; then
  run_one "$SHARD_FILTER"
  wait
  echo "shard $SHARD_FILTER done. aggregate:"
  python3 scripts/aggregate.py || true
  exit 0
fi

for i in $(seq 0 $((NUM_SHARDS-1))); do
  run_one "$i"
  sleep 0.7  # stagger to avoid thundering herd on Bing/DDG
done

echo "All 13 agents launched. Waiting..."
wait
echo ""
echo "=== ALL AGENTS DONE — AGGREGATE ==="
python3 scripts/aggregate.py || true
echo "Review at http://localhost:3000/pfp-review"
