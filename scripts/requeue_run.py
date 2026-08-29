#!/usr/bin/env python3
"""
Re-run only the professors that were marked ‘Send back to agents’ in the UI.
Reads data/pfp_requeue.json and re-invokes fetch_pfps_v2 with --force for those IDs,
respecting the original shard assignment so sleeps stay polite.

Usage:
  python scripts/requeue_run.py             # all requeued
  python scripts/requeue_run.py --limit 2   # dry run
  python scripts/requeue_run.py --shard 3   # only shard 3's requeued
"""
import json, argparse, os, sys, subprocess, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
REQUEUE = ROOT/"data"/"pfp_requeue.json"
SHARDS = ROOT/"data"/"pfp_shards.json"
CAND = ROOT/"data"/"pfp_candidates.json"

def load_json(p, default):
    if not p.exists(): return default
    return json.loads(p.read_text())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--shard", type=int, default=None)
    args = ap.parse_args()

    requeue = load_json(REQUEUE, [])
    if not requeue:
        print("No entries in data/pfp_requeue.json — nothing to requeue. Mark some in /pfp-review first.")
        return

    shards = load_json(SHARDS, {})
    # invert: employeeId -> shard
    id_to_shard = {}
    for k, ids in shards.items():
        for eid in ids:
            id_to_shard[str(eid)] = int(k)

    # group requeued ids by shard
    by_shard: dict[int, list[str]] = {}
    for entry in requeue:
        eid = str(entry.get("lumsEmployeeId"))
        shard = id_to_shard.get(eid)
        if shard is None:
            print(f"warn: {eid} not in shards map, assigning to 0")
            shard = 0
        by_shard.setdefault(shard, []).append(eid)
        print(f"  requeue: {eid} {entry.get('name')} shard={shard} instr={entry.get('instructions','')[:80]}")

    if args.shard is not None:
        by_shard = {k:v for k,v in by_shard.items() if k==args.shard}
        if not by_shard:
            print(f"No requeued entries for shard {args.shard}")
            return

    print(f"\n{len(requeue)} total requeued across {len(by_shard)} shards")

    # For each shard, we need to force re-scrape those specific IDs.
    # fetch_pfps_v2 supports --force but not --ids filter, so we temporarily
    # edit pfp_candidates.json to remove those ids so normal shard run will reprocess only them,
    # OR we call a one-off script that hits only those ids via --limit trick + manual list.
    # Simpler: spawn a tiny inline python that mimics fetch but for explicit list.
    # Here we just invoke fetch_pfps_v2 with --force and --limit large, but it will attempt all shard ids,
    # so we instead use a direct approach: call fetch logic via python -c with explicit IDs.

    # Easiest: remove from candidates.json so they become "not yet done", then run shard agents normally
    cand = load_json(CAND, {})
    removed = 0
    for shard, ids in by_shard.items():
        for eid in ids:
            if eid in cand:
                del cand[eid]
                removed += 1
    if removed:
        tmp = str(CAND)+".tmp"
        pathlib.Path(tmp).write_text(json.dumps(cand, indent=1))
        pathlib.Path(tmp).replace(CAND)
        print(f"Removed {removed} entries from pfp_candidates.json so shards will re-scrape them")

    # Now launch shards that had requeues
    for shard, ids in sorted(by_shard.items()):
        print(f"\n=== launching shard {shard} for {len(ids)} requeued ids: {ids} ===")
        cmd = [sys.executable, "scripts/fetch_pfps_v2.py", "--shard", str(shard), "--num-shards", "13", "--force", "--shards-file", "data/pfp_shards.json"]
        if args.limit:
            cmd += ["--limit", str(args.limit)]
        print(">", " ".join(cmd))
        subprocess.run(cmd, cwd=str(ROOT))

    print("\nDone. Clear requeue entries that were successfully found by checking /pfp-review and verifying.")
    print("To clear a requeue after verification: edit data/pfp_requeue.json manually or use the API.")

if __name__ == "__main__":
    main()
