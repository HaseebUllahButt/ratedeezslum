#!/usr/bin/env python3
"""
Multi-source faculty photo hunter v2 — sharded agent.

For each professor missing photoUrl, scours:
  - LinkedIn (Bing + DDG image search, media.licdn.com profile-displayphoto)
  - LUMS official profile page (direct scrape)
  - Generic web (Bing generic images, DDG generic)
  - Scholar / ResearchGate / university domains (via query variants)

Each candidate is scored 0-10 with confidence label + evidence, then top 3-5
downloaded locally. Results are incrementally appended to data/pfp_candidates.json
so 13 agents can run in parallel on disjoint shards (file-lock + merge).

Usage:
  python scripts/fetch_pfps_v2.py --shard 0 --num-shards 13
  python scripts/fetch_pfps_v2.py --shard 2 --num-shards 13 --limit 3
  python scripts/fetch_pfps_v2.py --all --shard 0 --num-shards 1  # process all professors
"""
import html
import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request
import fcntl
from pathlib import Path

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROFESSORS = os.path.join(ROOT, "data", "professors.json")
OUT = os.path.join(ROOT, "data", "pfp_candidates.json")
IMGDIR = os.path.join(ROOT, "public", "pfp-candidates")

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
TITLES = re.compile(r"^(Dr|Mr|Mrs|Ms|Miss|Prof)\.?\s+", re.I)
LUMS_WORDS = ("lums", "lahore university of management sciences", "lahore university")
FACULTY_WORDS = ("professor", "faculty", "lecturer", "teaching", "dean", "provost", "assistant professor", "associate professor")
TRUSTED_DOMAINS = {
    "linkedin.com": 1.0,
    "lums.edu.pk": 2.5,
    "scholar.google": 1.8,
    "researchgate.net": 1.2,
    "orcid.org": 1.0,
    "twitter.com": 0.6,
    "facebook.com": 0.4,
}

def http_get(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(), resp.headers

def sleep(a=2.0, b=4.5):
    time.sleep(random.uniform(a, b))

# ---------- DDG / Bing helpers (ported from v1) ----------
DDG_BLOCKED_UNTIL = 0.0
def ddg_blocked():
    return time.time() < DDG_BLOCKED_UNTIL
def block_ddg(seconds=300):
    global DDG_BLOCKED_UNTIL
    DDG_BLOCKED_UNTIL = time.time() + seconds
    print(f"    [ddg blocked for {seconds}s]", flush=True)

def get_vqd(query, attempts=2):
    q = urllib.parse.quote(query)
    url = f"https://duckduckgo.com/?q={q}&iax=images&ia=images"
    for i in range(attempts):
        if ddg_blocked():
            return None
        try:
            body, _ = http_get(url)
            m = re.search(rb'vqd="([^"]+)"', body) or re.search(rb"vqd=([\d-]+)&", body)
            if m:
                return m.group(1).decode()
        except Exception as e:
            print(f"    vqd attempt {i+1} failed: {e}", flush=True)
        time.sleep(8 + 10*i + random.uniform(0,5))
    return None

def ddg_images(query):
    if ddg_blocked():
        return None
    vqd = get_vqd(query)
    if not vqd:
        return []
    q = urllib.parse.quote(query)
    for i in range(2):
        try:
            url = f"https://duckduckgo.com/i.js?l=us-en&o=json&q={q}&vqd={vqd}&p=1"
            body, _ = http_get(url)
            data = json.loads(body.decode("utf-8", errors="ignore"))
            return data.get("results", [])
        except Exception as e:
            msg = str(e)
            print(f"    ddg attempt {i+1} failed: {msg}", flush=True)
            if "403" in msg or "202" in msg or "429" in msg:
                block_ddg(300+120*i)
                return []
            time.sleep(10+15*i)
    return []

def bing_images(query):
    try:
        q = urllib.parse.quote(query)
        url = f"https://www.bing.com/images/search?q={q}&form=HDRSC2&first=1"
        body, _ = http_get(url)
        text = html.unescape(body.decode("utf-8", errors="ignore"))
        out = []
        for m in re.finditer(r'\{[^{}]*\}', text):
            blob = m.group(0)
            mu = re.search(r'"murl":"([^"]+)"', blob)
            pu = re.search(r'"purl":"([^"]+)"', blob)
            ti = re.search(r'"t":"((?:[^"\\]|\\.)*)"', blob)
            if mu and pu:
                title = ti.group(1) if ti else ""
                try:
                    title = title.encode("utf-8","ignore").decode("unicode_escape","ignore")
                except: pass
                out.append({"image": mu.group(1), "url": pu.group(1), "title": title})
        return out
    except Exception as e:
        print(f"    bing failed: {e}", flush=True)
        return []

# ---------- helpers ----------
def norm_name(name):
    return TITLES.sub("", name).lower().strip()

def name_tokens(name):
    stop = {"bin", "ul", "ur", "al", "abdul", "muhammad", "mohammad", "syed"}
    toks = [t for t in re.split(r"[^a-z]+", norm_name(name)) if t and t not in stop]
    return toks or [t for t in re.split(r"[^a-z]+", norm_name(name)) if t]

def slug_tokens(slug):
    return [t for t in re.split(r"[^a-z]+", slug.lower()) if t]

def img_key(img_url):
    m = re.match(r"(https://media\.licdn\.com/dms/image/[^/]+/[A-Za-z0-9_-]+)/", img_url)
    return m.group(1) if m else img_url.split("?")[0]

def img_res_rank(img_url):
    lower = img_url.lower()
    for i, pat in enumerate(["scale_800","shrink_800","scale_400_400","shrink_400_400"]):
        if pat in lower:
            return 10 - i
    return 0

def detect_source_type(src_url, img_url):
    s = (src_url + " " + img_url).lower()
    if "linkedin.com" in s or "licdn.com" in s:
        return "linkedin"
    if "lums.edu.pk" in s:
        return "lums"
    if "scholar.google" in s:
        return "scholar"
    if "researchgate" in s:
        return "researchgate"
    if "orcid.org" in s:
        return "orcid"
    if any(d in s for d in [".edu", "university", "ac.uk"]):
        return "university"
    return "other"

def confidence_label(score):
    if score >= 7.0:
        return "high"
    if score >= 4.0:
        return "medium"
    return "low"

def score_result(r, prof, query):
    title = (r.get("title") or "").lower()
    src = r.get("url") or ""
    img = r.get("image") or ""
    src_lower = src.lower()
    score = 0.0
    evidence = []

    tokens = name_tokens(prof["name"])
    t_hit = sum(1 for t in tokens if t in title)
    s_hit = sum(1 for t in tokens if t in src_lower)
    # name coverage
    if t_hit == len(tokens) and tokens:
        score += 3.0
        evidence.append("full name in title")
    elif t_hit >= 1:
        score += 1.2 * t_hit
        evidence.append(f"{t_hit}/{len(tokens)} name tokens in title")
    if s_hit:
        score += 1.5 * min(s_hit, 2)
        evidence.append("name in source URL")

    # slug match boost (especially linkedin slug)
    slug_m = re.search(r"linkedin\.com/(?:in|pub)/([A-Za-z0-9%-]+)", src)
    slug = slug_m.group(1) if slug_m else ""
    stoks = slug_tokens(urllib.parse.unquote(slug)) if slug else []
    if slug:
        if stoks and all(t in stoks for t in tokens[:2]):
            score += 3.0
            evidence.append("slug matches name")
        elif stoks and any(t in stoks for t in tokens[:2]):
            score += 1.0
            evidence.append("partial slug match")

    # lums / faculty cues
    if any(w in title for w in LUMS_WORDS) or "lums" in src_lower:
        score += 2.0
        evidence.append("LUMS mention")
    if any(w in title for w in FACULTY_WORDS):
        score += 1.5
        evidence.append("faculty title in context")
    # school hint
    if prof.get("school"):
        school_short = prof["school"].split(" of ")[-1].split()[0].lower()
        if len(school_short) > 3 and school_short in title:
            score += 1.0
            evidence.append(f"school hint '{school_short}'")

    # source trust
    source_type = detect_source_type(src, img)
    trust = 0
    for dom, bonus in TRUSTED_DOMAINS.items():
        if dom in src_lower or dom in img.lower():
            trust = max(trust, bonus)
    if source_type == "lums":
        score += 2.5
        evidence.append("source: lums.edu.pk (trusted)")
    elif source_type in ("linkedin","scholar","researchgate"):
        score += trust
        if trust:
            evidence.append(f"source: {source_type} (+{trust})")

    # image type penalty/bonus
    if "profile-displayphoto" in img:
        score += 0.5
        evidence.append("LinkedIn profile photo pattern")
    elif source_type == "lums" and any(x in img.lower() for x in ["faculty_image", "styles/faculty", "sites/default/files"]):
        score += 1.0
        evidence.append("LUMS faculty image path")
    # generic web images without clear identity are weaker
    if source_type == "other" and "profile" not in img.lower() and "faculty" not in title:
        score -= 1.0

    if "profile-displayphoto" not in img and source_type == "linkedin":
        score -= 6  # not a real profile pic

    # resolution bonus
    rr = img_res_rank(img)
    if rr:
        score += rr * 0.2
        evidence.append(f"high-res variant ({img.split('/')[-1][:20]})")

    # single-token name penalty
    if len(tokens) <= 1 and source_type == "linkedin":
        score -= 1.5
        evidence.append("single-token name — low certainty")

    score = max(0, min(10, round(score, 2)))
    return score, slug, source_type, evidence

def queries_for(prof):
    name = norm_name(prof["name"])
    quoted = f'"{name}"'
    dept = (prof.get("department") or "").strip()
    school = (prof.get("school") or "").split(" of ")[-1].split()[0] if prof.get("school") else ""
    qs = [
        f"{quoted} lums linkedin",
        f'{quoted} "Lahore University of Management Sciences"',
        f"{quoted} lums faculty",
        f"{quoted} site:lums.edu.pk",
        f"{quoted} researchgate",
        f"{quoted} scholar",
    ]
    # dedupe & keep deterministic order
    # single-name workaround
    if len(name.split()) == 1:
        ctx = prof.get("title") or dept or school or "LUMS"
        qs = [f'{quoted} lums {ctx} linkedin', f'{quoted} site:lums.edu.pk', f'{quoted} researchgate']
    # prune empty
    qs = [q.strip() for q in qs if q.strip()]
    # limit to 5 to respect rate limits
    return qs[:5]

def scrape_lums_profile(prof):
    """Try to fetch https://lums.edu.pk/lums_employee/{id} and extract a faculty image."""
    try:
        url = prof.get("profileUrl") or f"https://lums.edu.pk/lums_employee/{prof['lumsEmployeeId']}"
        body, headers = http_get(url, timeout=15)
        text = body.decode("utf-8", errors="ignore")
        # look for faculty_image or og:image
        m = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', text)
        if m and "faculty_image" in m.group(1):
            return [{"image": html.unescape(m.group(1)), "url": url, "title": f"{prof['name']} — LUMS profile og:image"}]
        # fallback: any <img> with faculty_image
        candidates = []
        for im in re.findall(r'<img[^>]+src="([^"]+)"[^>]*>', text):
            if "faculty_image" in im or "faculty_images" in im:
                full = urllib.parse.urljoin(url, html.unescape(im))
                candidates.append({"image": full, "url": url, "title": f"{prof['name']} — LUMS profile <img>"})
        return candidates[:2]
    except Exception as e:
        print(f"    lums scrape failed: {e}", flush=True)
        return []

def download(img_url, dest):
    try:
        body, headers = http_get(img_url, timeout=30)
        ctype = headers.get("Content-Type", "")
        if not ctype.startswith("image/") or len(body) < 2000:
            return False
        with open(dest, "wb") as f:
            f.write(body)
        return True
    except Exception as e:
        print(f"    download failed: {e}", flush=True)
        return False

def load_json_locked(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r") as f:
        try:
            fcntl.flock(f, fcntl.LOCK_SH)
            data = json.load(f)
            fcntl.flock(f, fcntl.LOCK_UN)
            return data
        except:
            return default

def save_json_locked(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, indent=1)
    # atomic rename with lock on target
    # we lock the target file if exists
    if os.path.exists(path):
        with open(path, "r+") as lockf:
            try:
                fcntl.flock(lockf, fcntl.LOCK_EX)
                os.replace(tmp, path)
                fcntl.flock(lockf, fcntl.LOCK_UN)
            except:
                os.replace(tmp, path)
    else:
        os.replace(tmp, path)

def parse_args():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--shard", type=int, default=0, help="shard index 0-based")
    p.add_argument("--num-shards", type=int, default=1, help="total shards")
    p.add_argument("--limit", type=int, default=0, help="max professors in this shard to process")
    p.add_argument("--all", action="store_true", help="include professors that already have photoUrl (default: only missing)")
    p.add_argument("--force", action="store_true", help="reprocess even if already in store")
    p.add_argument("--shards-file", type=str, default="", help="optional JSON file with precomputed shard assignments")
    return p.parse_args()

def main():
    args = parse_args()
    only_missing = not args.all
    professors = json.load(open(PROFESSORS))
    store = load_json_locked(OUT, {})
    os.makedirs(IMGDIR, exist_ok=True)

    # optional shards-file override
    targets = professors
    if only_missing:
        targets = [p for p in professors if not p.get("photoUrl")]
    else:
        targets = professors

    # sort stable
    targets = sorted(targets, key=lambda p: int(str(p["lumsEmployeeId"])))

    # shard slicing
    if args.num_shards > 1:
        shard_idx = args.shard % args.num_shards
        per = (len(targets) + args.num_shards - 1) // args.num_shards  # ceil
        # use same sharding as audit: ceil chunking
        start = shard_idx * per
        end = min(start + per, len(targets))
        # if we have a precomputed shards file, use it
        if args.shards_file and os.path.exists(args.shards_file):
            with open(args.shards_file) as f:
                shards_data = json.load(f)
            key = str(shard_idx)
            if key in shards_data:
                wanted_ids = set(str(x) for x in shards_data[key])
                targets = [p for p in targets if str(p["lumsEmployeeId"]) in wanted_ids]
            else:
                targets = targets[start:end]
        else:
            targets = targets[start:end]
        print(f"[shard {shard_idx}/{args.num_shards}] slice {start}:{end} -> {len(targets)} targets", flush=True)
    else:
        print(f"[single] {len(targets)} targets", flush=True)

    # filter already done unless --force
    if not args.force:
        targets = [p for p in targets if str(p["lumsEmployeeId"]) not in store]
    else:
        # still respect store but reprocess
        pass

    if args.limit:
        targets = targets[:args.limit]
    total = len(targets)
    print(f"{total} professors to process in this shard (force={args.force})", flush=True)
    if total == 0:
        # still report stats
        found = sum(1 for v in store.values() if v.get("status") == "found")
        print(f"DONE (nothing to do). store={len(store)} found={found}", flush=True)
        return

    for idx, prof in enumerate(targets):
        emp_id = str(prof["lumsEmployeeId"])
        name = prof["name"]
        print(f"[{idx+1}/{total}] {name} ({emp_id}) — shard {args.shard}", flush=True)

        candidates = {}
        raw_seen = 0
        ddg_ran_any = False

        # 0) direct LUMS profile scrape — highest signal if it returns something
        lums_hits = scrape_lums_profile(prof)
        sleep(0.8, 1.5)
        for r in lums_hits:
            # synthesize a candidate even if not linkedin
            img = r.get("image") or ""
            src = r.get("url") or ""
            sc, slug, stype, ev = score_result(r, prof, "lums profile scrape")
            # boost lums direct finds
            sc = min(10, sc + 1.0)
            key = img_key(img) if "media.licdn" in img else img.split("?")[0]
            cur = candidates.get(key)
            entry = {
                "url": img,
                "score": round(sc,2),
                "confidence": confidence_label(sc),
                "sourceTitle": r.get("title"),
                "sourceProfile": src,
                "sourceType": stype,
                "query": "lums profile scrape",
                "slug": slug,
                "evidence": ev,
            }
            if not cur or sc > cur["score"]:
                candidates[key] = entry
            raw_seen += 1

        for qi, query in enumerate(queries_for(prof)):
            print(f"  q{qi}: {query}", flush=True)
            results = bing_images(query)
            sleep(3.0, 5.0)
            raw_seen += len(results)
            # count licdn so far to decide if we need DDG fallback
            licdn_so_far = sum(1 for r in results if "media.licdn.com" in (r.get("image") or "") and "profile-displayphoto" in (r.get("image") or ""))
            # also consider if we have any high-confidence candidate yet
            has_strong = any(c["score"] >= 7.0 for c in candidates.values())
            # DDG fallback if bing gave no licdn and we don't yet have a strong candidate
            if licdn_so_far == 0 and not has_strong:
                dres = ddg_images(query)
                if dres is not None:
                    ddg_ran_any = True
                    raw_seen += len(dres)
                    results = results + dres
                    sleep(9.0, 14.0)
                else:
                    sleep(3.0, 5.0)
            else:
                sleep(3.0, 5.0)

            for r in results:
                img = r.get("image") or ""
                src = r.get("url") or ""
                # accept: linkedin profile photos OR any image from trusted edu domains with reasonable size
                is_linkedin = "media.licdn.com" in img and "profile-displayphoto" in img and ("linkedin.com/in/" in src or "linkedin.com/pub/" in src)
                is_trusted_generic = detect_source_type(src, img) in ("lums","university","scholar","researchgate","orcid") and img.lower().endswith((".jpg",".jpeg",".png")) or "faculty_image" in img
                # for generic, be permissive but require faculty hint
                if not (is_linkedin or is_trusted_generic):
                    # also allow any bing image that has reasonable lums/faculty context and an image url
                    if detect_source_type(src, img) == "other":
                        # skip low-signal generic images unless title has lums+name tokens overlap >=1
                        toks = name_tokens(prof["name"])
                        if not any(t in (r.get("title") or "").lower() for t in toks):
                            continue
                    else:
                        continue
                    # require image url present
                    if not img or len(img) < 10:
                        continue
                sc, slug, stype, ev = score_result(r, prof, query)
                # generic images not linkedin get slight penalty unless lums
                if not is_linkedin and stype not in ("lums",):
                    sc = max(0, sc - 0.5)
                key = img_key(img) if "media.licdn" in img else img.split("?")[0]
                cur = candidates.get(key)
                entry = {
                    "url": img,
                    "score": sc,
                    "confidence": confidence_label(sc),
                    "sourceTitle": r.get("title"),
                    "sourceProfile": src,
                    "sourceType": stype,
                    "query": query,
                    "slug": slug,
                    "evidence": ev,
                }
                if not cur or sc > cur["score"] or (sc == cur["score"] and img_res_rank(img) > img_res_rank(cur["url"])):
                    candidates[key] = entry
            # early break if we have a high-confidence lums or linkedin hit
            if qi == 0 and any(c["score"] >= 7.5 and c["sourceType"] in ("lums","linkedin") for c in candidates.values()):
                print(f"    strong candidate found, skipping remaining queries", flush=True)
                break
            if qi == 1 and any(c["score"] >= 8.0 for c in candidates.values()):
                break

        ranked = sorted(candidates.values(), key=lambda c: (-c["score"], c["sourceType"] != "lums"))
        top = ranked[:5]  # up to 5 candidates per prof now (was 3)

        saved = []
        for ci, cand in enumerate(top):
            # don't download if score is extremely low (<2.0) unless it's the only thing we have
            if cand["score"] < 2.0 and len(top) > 1:
                continue
            ext = ".jpg"
            # try to guess ext
            if ".png" in cand["url"].lower():
                ext = ".png"
            dest = os.path.join(IMGDIR, f"{emp_id}_{ci}{ext}")
            if download(cand["url"], dest):
                cand["localPath"] = f"/pfp-candidates/{emp_id}_{ci}{ext}"
                saved.append(cand)
                sleep(0.5, 1.2)
            else:
                # keep candidate even if download failed — reviewer can still open remote URL
                cand["localPath"] = None
                cand["downloadFailed"] = True
                saved.append(cand)

        # if we filtered out low scores, ensure at least 1 remains if any existed
        if not saved and top:
            saved = top[:1]
            for cand in saved:
                cand["localPath"] = None

        # decide status
        if saved and any(c["score"] >= 4.0 for c in saved):
            status = "found"
        elif saved:
            status = "found_low_confidence"
        else:
            status = "retry" if raw_seen == 0 else ("retry_bing_only" if not ddg_ran_any else "not_found")

        record = {
            "lumsEmployeeId": emp_id,
            "name": name,
            "title": prof.get("title"),
            "department": prof.get("department"),
            "school": prof.get("school"),
            "profileUrl": prof.get("profileUrl"),
            "candidates": saved,
            "status": status,
            "updatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
            "shard": args.shard,
            "queriesRun": queries_for(prof),
        }
        # merge with file-lock
        for attempt in range(5):
            try:
                store_locked = load_json_locked(OUT, {})
                store_locked[emp_id] = record
                save_json_locked(OUT, store_locked)
                store = store_locked
                break
            except Exception as e:
                print(f"    save retry {attempt}: {e}", flush=True)
                time.sleep(1 + attempt*2)

        n = len(saved)
        best = saved[0]["score"] if saved else "-"
        best_c = saved[0].get("confidence","-") if saved else "-"
        best_t = saved[0].get("sourceType","-") if saved else "-"
        print(f"  -> status={status} candidates={n} best={best} ({best_c}/{best_t}) shard={args.shard}", flush=True)
        sleep(1.0, 2.5)

    found = sum(1 for v in store.values() if v.get("status") in ("found","found_low_confidence"))
    print(f"DONE shard {args.shard}. store={len(store)} found={found}", flush=True)

if __name__ == "__main__":
    main()
