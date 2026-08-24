#!/usr/bin/env python3
"""Find LinkedIn profile photos for LUMS professors missing photos.

Uses DuckDuckGo image search: each result carries the source page URL
(the LinkedIn profile) and the image URL (media.licdn.com profile photo).
Candidates are scored, top ones downloaded locally, results saved incrementally.
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
FACULTY_WORDS = ("professor", "faculty", "lecturer", "teaching", "dean", "provost")


def http_get(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(), resp.headers


def sleep(a=2.0, b=4.5):
    time.sleep(random.uniform(a, b))


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
            print(f"    vqd attempt {i + 1} failed: {e}", flush=True)
        time.sleep(8 + 10 * i + random.uniform(0, 5))
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
            print(f"    ddg attempt {i + 1} failed: {msg}", flush=True)
            if "403" in msg or "202" in msg or "429" in msg:
                block_ddg(300 + 120 * i)
                return []
            time.sleep(10 + 15 * i)
    return []


def bing_images(query):
    try:
        q = urllib.parse.quote(query)
        url = f"https://www.bing.com/images/search?q={q}&form=HDRSC2&first=1"
        body, _ = http_get(url)
        text = html.unescape(body.decode("utf-8", errors="ignore"))
        out = []
        for blob in re.findall(r'\{[^{}]*?"murl":"([^"]+)"[^{}]*?\}', text):
            pass
        pairs = re.findall(r'"murl":"([^"]+)","turl":"[^"]*"(?:,"md5":"[^"]*")?(?:,"shkey":"[^"]*")?,"t":"((?:[^"\\]|\\.)*)"', text)
        # simpler: iterate over metadata dicts
        for m in re.finditer(r'\{[^{}]*\}', text):
            blob = m.group(0)
            mu = re.search(r'"murl":"([^"]+)"', blob)
            pu = re.search(r'"purl":"([^"]+)"', blob)
            ti = re.search(r'"t":"((?:[^"\\]|\\.)*)"', blob)
            if mu and pu:
                title = ti.group(1) if ti else ""
                title = title.encode("utf-8", "ignore").decode("unicode_escape", "ignore")
                out.append({"image": mu.group(1), "url": pu.group(1), "title": title})
        return out
    except Exception as e:
        print(f"    bing failed: {e}", flush=True)
        return []


def norm_name(name):
    return TITLES.sub("", name).lower().strip()


def name_tokens(name):
    stop = {"bin", "ul", "ur", "al", "abdul", "muhammad", "mohammad", "syed"}
    toks = [t for t in re.split(r"[^a-z]+", norm_name(name)) if t and t not in stop]
    return toks or [t for t in re.split(r"[^a-z]+", norm_name(name)) if t]


def slug_tokens(slug):
    return [t for t in re.split(r"[^a-z]+", slug.lower()) if t]


def img_key(img_url):
    # dedupe different sizes of the same underlying upload
    m = re.match(r"(https://media\.licdn\.com/dms/image/[^/]+/[A-Za-z0-9_-]+)/", img_url)
    return m.group(1) if m else img_url.split("?")[0]


def img_res_rank(img_url):
    lower = img_url.lower()
    for i, pat in enumerate(["scale_800", "shrink_800", "scale_400_400", "shrink_400_400"]):
        if pat in lower:
            return 10 - i
    return 0


def score_result(r, prof, query):
    title = (r.get("title") or "").lower()
    src = r.get("url") or ""
    img = r.get("image") or ""
    score = 0.0
    tokens = name_tokens(prof["name"])
    t_hit = sum(1 for t in tokens if t in title)
    s_hit = sum(1 for t in tokens if t in src.lower())
    if t_hit == len(tokens) and tokens:
        score += 3
    else:
        score += 1.2 * t_hit
    score += 1.5 * s_hit

    slug_m = re.search(r"linkedin\.com/(?:in|pub)/([A-Za-z0-9%-]+)", src)
    slug = slug_m.group(1) if slug_m else ""
    stoks = slug_tokens(urllib.parse.unquote(slug))
    if stoks and all(t in stoks for t in tokens[:2]):
        score += 3
    elif stoks and any(t in stoks for t in tokens[:2]):
        score += 1

    if any(w in title for w in LUMS_WORDS) or any(w in src.lower() for w in ("lums",)):
        score += 2
    if any(w in title for w in FACULTY_WORDS):
        score += 1.5
    if prof.get("school"):
        school_short = prof["school"].split(" of ")[-1].split()[0].lower()
        if len(school_short) > 3 and school_short in title:
            score += 1
    if "profile-displayphoto" not in img:
        score -= 6
    score += img_res_rank(img) * 0.2
    return round(score, 2), slug


def queries_for(prof):
    name = norm_name(prof["name"])
    quoted = f'"{name}"'
    qs = [f"{quoted} lums linkedin", f'{quoted} "Lahore University of Management Sciences"']
    single = len(name.split()) == 1
    if single:
        ctx = prof.get("title") or ""
        qs = [f'{quoted} lums {ctx}'.strip() + " linkedin"]
    return qs


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


def load_json(path, default):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return default


def save_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, indent=1)
    os.replace(tmp, path)


def main():
    only_missing = "--all" not in sys.argv
    limit = 0
    for a in sys.argv[1:]:
        if a.startswith("--limit="):
            limit = int(a.split("=")[1])
    professors = json.load(open(PROFESSORS))
    store = load_json(OUT, {})
    os.makedirs(IMGDIR, exist_ok=True)

    targets = [p for p in professors if not p.get("photoUrl")] if only_missing else professors
    targets = [p for p in targets if str(p["lumsEmployeeId"]) not in store]
    if limit:
        targets = targets[:limit]
    total = len(targets)
    print(f"{total} professors to process", flush=True)

    for idx, prof in enumerate(targets):
        emp_id = str(prof["lumsEmployeeId"])
        if emp_id in store and store[emp_id].get("status") in ("found", "not_found"):
            continue
        name = prof["name"]
        print(f"[{idx + 1}/{total}] {name}", flush=True)

        candidates = {}
        raw_seen = 0
        ddg_ran_any = False
        for qi, query in enumerate(queries_for(prof)):
            print(f"  q{qi}: {query}", flush=True)
            results = bing_images(query)
            sleep(3.0, 5.0)
            raw_seen += len(results)
            strong = any(
                "profile-displayphoto" in c["url"] and c["score"] >= 6
                for c in candidates.values()
            )
            licdn_so_far = sum(
                1 for r in results
                if "media.licdn.com" in (r.get("image") or "")
                and "profile-displayphoto" in (r.get("image") or "")
            )
            if licdn_so_far == 0:
                dres = ddg_images(query)
                if dres is not None:
                    ddg_ran_any = True
                    raw_seen += len(dres)
                    results = results + dres
                    sleep(9.0, 14.0)
            else:
                sleep(3.0, 5.0)
            del strong
            for r in results:
                img = r.get("image") or ""
                src = r.get("url") or ""
                if "media.licdn.com" not in img or "profile-displayphoto" not in img:
                    continue
                if "linkedin.com/in/" not in src and "linkedin.com/pub/" not in src:
                    continue
                sc, slug = score_result(r, prof, query)
                key = img_key(img)
                cur = candidates.get(key)
                if not cur or sc > cur["score"] or (
                    sc == cur["score"] and img_res_rank(img) > img_res_rank(cur["url"])
                ):
                    candidates[key] = {
                        "url": img,
                        "score": sc,
                        "sourceTitle": r.get("title"),
                        "sourceProfile": src,
                        "query": query,
                        "slug": slug,
                    }
            if qi == 0 and any(c["score"] >= 6 for c in candidates.values()):
                break  # strong candidate already, skip extra query

        ranked = sorted(candidates.values(), key=lambda c: -c["score"])
        top = ranked[:3]
        saved = []
        for ci, cand in enumerate(top):
            ext = ".jpg"
            dest = os.path.join(IMGDIR, f"{emp_id}_{ci}{ext}")
            if download(cand["url"], dest):
                cand["localPath"] = f"/pfp-candidates/{emp_id}_{ci}{ext}"
                saved.append(cand)
                sleep(0.5, 1.5)

        record = {
            "lumsEmployeeId": emp_id,
            "name": name,
            "title": prof.get("title"),
            "department": prof.get("department"),
            "school": prof.get("school"),
            "profileUrl": prof.get("profileUrl"),
            "candidates": saved,
            "status": (
                "found" if saved
                else "retry" if raw_seen == 0
                else "retry_bing_only" if not ddg_ran_any
                else "not_found"
            ),
            "updatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        store[emp_id] = record
        save_json(OUT, store)
        n = len(saved)
        best = saved[0]["score"] if saved else "-"
        print(f"  -> status={record['status']} candidates={n} best_score={best}", flush=True)
        sleep(1.0, 2.5)

    found = sum(1 for v in store.values() if v.get("status") == "found")
    print(f"DONE. store={len(store)} found={found}", flush=True)


if __name__ == "__main__":
    main()
