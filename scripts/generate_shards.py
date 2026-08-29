#!/usr/bin/env python3
"""Generate 13 balanced shards for the 134 missing professors."""
import json, os, math, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
PROF = ROOT/"data"/"professors.json"
OUT = ROOT/"data"/"pfp_shards.json"
with open(PROF) as f:
    data=json.load(f)
missing=sorted([p for p in data if not p.get("photoUrl")], key=lambda p: int(str(p["lumsEmployeeId"])))
n=13
# balanced: spread remainder — 134//13=10 remainder 4 => 4 shards get 11, 9 get 10
per=len(missing)//n
rem=len(missing)%n
shards={}
idx=0
for i in range(n):
    size=per+(1 if i<rem else 0)
    chunk=missing[idx:idx+size]
    shards[str(i)]=[p["lumsEmployeeId"] for p in chunk]
    idx+=size
with open(OUT,"w") as f:
    json.dump(shards,f,indent=2)
print(f"wrote {OUT} -> {len(missing)} across {n} shards")
for k,v in shards.items():
    print(f" shard {k}: {len(v)} ids={v[:3]}...{v[-2:]}" if len(v)>3 else f" shard {k}: {v}")
# also print detail for run script
print("\nshards json:", json.dumps(shards))
