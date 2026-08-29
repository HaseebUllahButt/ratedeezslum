#!/usr/bin/env python3
"""Aggregate pfp_candidates.json into a human-readable report + confidence stats."""
import json, os, pathlib, collections
ROOT=pathlib.Path(__file__).resolve().parent.parent
CAND=ROOT/"data"/"pfp_candidates.json"
PROF=ROOT/"data"/"professors.json"
SHARDS=ROOT/"data"/"pfp_shards.json"
VERDICTS=ROOT/"data"/"pfp_verdicts.json"

candidates=json.load(open(CAND)) if CAND.exists() else {}
professors=json.load(open(PROF))
missing=[p for p in professors if not p.get("photoUrl")]
total_missing=len(missing)
found=sum(1 for v in candidates.values() if v.get("status") in ("found","found_low_confidence"))
not_found=sum(1 for v in candidates.values() if v.get("status")=="not_found")
retry=sum(1 for v in candidates.values() if "retry" in str(v.get("status")))
no_entry=total_missing - len(candidates)

by_type=collections.Counter()
by_conf=collections.Counter()
scores=[]
for rec in candidates.values():
    for c in rec.get("candidates",[]):
        by_type[c.get("sourceType","other")] += 1
        by_conf[c.get("confidence","low")] += 1
        scores.append(c.get("score",0))

avg_score=sum(scores)/len(scores) if scores else 0
print("="*64)
print(f" PFP HUNT AGGREGATE  {len(candidates)}/{total_missing} professors touched")
print("="*64)
print(f"  found (high/med):        {found}")
print(f"  not_found:               {not_found}")
print(f"  retry/retry_bing_only:   {retry}")
print(f"  not yet attempted:       {no_entry}")
print(f"  total candidates scraped:{len(scores)}  avg score {avg_score:.2f}")
print(f"  by sourceType: {dict(by_type)}")
print(f"  by confidence: {dict(by_conf)}")
if scores:
    print(f"  score dist: min {min(scores):.1f}  max {max(scores):.1f}  median {sorted(scores)[len(scores)//2]:.1f}")
print()

# per-shard
if SHARDS.exists():
    shards=json.load(open(SHARDS))
    print(" Per-shard progress:")
    for k in sorted(shards, key=lambda x: int(x)):
        ids=set(shards[k])
        done=sum(1 for eid in ids if eid in candidates)
        fnd=sum(1 for eid in ids if eid in candidates and candidates[eid].get("status") in ("found","found_low_confidence"))
        print(f"   shard {int(k):02d}: {done}/{len(ids)} done  {fnd} found")
    print()

# verdicts if any
if VERDICTS.exists():
    v=json.load(open(VERDICTS))
    print(f" Verdicts: {len(v)} reviewed")
    yes=sum(1 for x in v.values() if (x.get("choice") or x.get("decisions") or x.get("overallDecision") not in (None,"skip")) )
    print(f"  (legacy + new): {yes} approved-ish (see pfp_verdicts.json)")
    print()

# top unsure
print(" Low-confidence examples (needs human eye):")
low=[]
for eid, rec in candidates.items():
    if rec.get("status")=="found_low_confidence" or any(c.get("confidence")=="low" for c in rec.get("candidates",[])):
        low.append(rec)
low=sorted(low, key=lambda r: r.get("candidates",[{}])[0].get("score",0))[:8]
for r in low:
    cands=r.get("candidates",[])
    scores_str=",".join(f"{c.get('score'):.1f}({c.get('confidence')[0]}/{c.get('sourceType')})" for c in cands[:2])
    print(f"  {r['lumsEmployeeId']:6s} {r['name']:28s} -> {scores_str} candidates={len(cands)}")

# not found samples
print()
print(" No candidate found (will need retry / manual search):")
nf=[r for r in candidates.values() if r.get("status") in ("not_found","retry","retry_bing_only")]
for r in sorted(nf, key=lambda x: x["name"])[:10]:
    print(f"  {r['lumsEmployeeId']:6s} {r['name']:30s} status={r['status']}  LUMS={r['profileUrl']}")

print()
print("Next: open http://localhost:3000/pfp-review and mark Yes/No/Skip + comments.")
print("Requeue: set pfp_requeue.json or use the 'Send back to agents' button -> creates pfp_requeue.json")
