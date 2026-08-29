"use client";

import { useMemo, useState, useEffect } from "react";
import type { PfpRecord, Verdict, CandidateDecision } from "@/lib/pfpStore";

type Filter = "pending" | "yes" | "no" | "skip" | "requeue" | "low_confidence" | "all";
type SortBy = "name" | "score" | "status" | "school";

function imgSrc(c: { url: string; localPath?: string | null }): string {
  return c.localPath ?? c.url;
}

function confidenceColor(c?: string) {
  if (c === "high") return "bg-green-100 text-green-800 border-green-300";
  if (c === "medium") return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-red-100 text-red-800 border-red-300";
}
function sourceBadge(s?: string) {
  const map: Record<string, string> = {
    linkedin: "bg-blue-100 text-blue-800 border-blue-300",
    lums: "bg-emerald-100 text-emerald-800 border-emerald-300",
    scholar: "bg-purple-100 text-purple-800 border-purple-300",
    researchgate: "bg-teal-100 text-teal-800 border-teal-300",
    university: "bg-orange-100 text-orange-800 border-orange-300",
  };
  return map[s ?? ""] ?? "bg-gray-100 text-gray-700 border-gray-300";
}

export default function PfpReviewClient({
  initialRecords,
  initialVerdicts,
}: {
  initialRecords: PfpRecord[];
  initialVerdicts: Record<string, Verdict>;
}) {
  const [verdicts, setVerdicts] = useState(initialVerdicts);
  const [filter, setFilter] = useState<Filter>("pending");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [query, setQuery] = useState("");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [shardFilter, setShardFilter] = useState<string>("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [requeueDraft, setRequeueDraft] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const schools = useMemo(() => {
    const s = new Set<string>();
    initialRecords.forEach((r) => r.school && s.add(r.school));
    return ["all", ...Array.from(s).sort()];
  }, [initialRecords]);

  const shards = useMemo(() => {
    const s = new Set<number>();
    initialRecords.forEach((r) => r.shard !== undefined && s.add(r.shard));
    return ["all", ...Array.from(s).sort((a, b) => a - b).map(String)] as string[];
  }, [initialRecords]);

  const stats = useMemo(() => {
    const total = initialRecords.length;
    let pending = 0, yes = 0, no = 0, skip = 0, requeue = 0, low = 0;
    for (const r of initialRecords) {
      const v = verdicts[r.lumsEmployeeId];
      if (!v) pending++;
      else if (v.overallDecision === "requeue" || v.requeue?.requested) requeue++;
      else if (v.overallDecision === "yes" || (v.choice && !v.overallDecision)) yes++;
      else if (v.overallDecision === "no" || (v.choice === null && !!v && (v.overallDecision as string) !== "skip")) {
        // distinguish skip vs no: legacy null could be no or skip, check decisions
        const hasSkip = v.decisions && Object.values(v.decisions).some((d) => d.decision === "skip");
        if ((v.overallDecision as string) === "skip" || hasSkip) skip++;
        else no++;
      } else if ((v.overallDecision as string) === "skip") skip++;
      else pending++;

      // low confidence count (record has at least one low conf candidate)
      if (r.candidates.some((c) => c.confidence === "low" || c.score < 4)) low++;
    }
    return { total, pending, yes, no, skip, requeue, low };
  }, [initialRecords, verdicts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = initialRecords.filter((r) => {
      const v = verdicts[r.lumsEmployeeId];
      // school/shard filters
      if (schoolFilter !== "all" && r.school !== schoolFilter) return false;
      if (shardFilter !== "all" && String(r.shard ?? "") !== shardFilter) return false;

      // status filter
      if (filter === "pending" && v) return false;
      if (filter === "yes" && !(v?.overallDecision === "yes" || (v?.choice && !v?.overallDecision))) return false;
      if (filter === "no" && !(v?.overallDecision === "no" || (v && v.choice === null && v.overallDecision !== "skip" && !v.requeue?.requested))) return false;
      if (filter === "skip" && !(v?.overallDecision === "skip")) return false;
      if (filter === "requeue" && !(v?.requeue?.requested || v?.overallDecision === "requeue")) return false;
      if (filter === "low_confidence" && !r.candidates.some((c) => c.confidence === "low" || c.score < 4)) return false;

      if (
        q &&
        !r.name.toLowerCase().includes(q) &&
        !String(r.lumsEmployeeId).includes(q) &&
        !(r.school ?? "").toLowerCase().includes(q) &&
        !(r.title ?? "").toLowerCase().includes(q) &&
        !(r.department ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
    if (sortBy === "score") {
      out = out.sort((a, b) => {
        const sa = a.candidates[0]?.score ?? -1;
        const sb = b.candidates[0]?.score ?? -1;
        return sb - sa;
      });
    } else if (sortBy === "school") {
      out = out.sort((a, b) => (a.school ?? "").localeCompare(b.school ?? ""));
    } else if (sortBy === "status") {
      const order: Record<string, number> = { found: 0, found_low_confidence: 1, not_found: 4, retry: 3, retry_bing_only: 2 };
      out = out.sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));
    }
    return out;
  }, [initialRecords, verdicts, filter, query, schoolFilter, shardFilter, sortBy]);

  async function postVerdict(
    employeeId: string,
    patch: Partial<{
      choice: string | null;
      decisions: Record<string, CandidateDecision>;
      comment: string;
      overallDecision: Verdict["overallDecision"];
      requeueInstructions: string;
    }>
  ) {
    setSaving(employeeId);
    // optimistic: merge
    setVerdicts((prev) => {
      const cur = prev[employeeId] ?? { lumsEmployeeId: employeeId, choice: null, updatedAt: new Date().toISOString() };
      const next: Verdict = {
        ...cur,
        ...patch,
        decisions: patch.decisions ?? cur.decisions,
        comment: patch.comment !== undefined ? patch.comment : cur.comment,
        overallDecision: patch.overallDecision ?? cur.overallDecision,
        updatedAt: new Date().toISOString(),
      } as Verdict;
      if (patch.requeueInstructions) {
        next.requeue = { requested: true, instructions: patch.requeueInstructions, updatedAt: new Date().toISOString() };
        next.overallDecision = "requeue";
      }
      if (patch.choice !== undefined) next.choice = patch.choice;
      return { ...prev, [employeeId]: next };
    });

    try {
      const res = await fetch("/api/pfp-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lumsEmployeeId: employeeId, ...patch }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.error("save failed", data);
        setToast(`Save failed: ${data?.error ?? res.statusText}`);
        // rollback: remove optimistic? simpler refetch not needed; keep but toast
      } else {
        setToast("Saved ✓");
      }
    } catch (err) {
      console.error(err);
      setToast("Network error saving");
    } finally {
      setSaving(null);
    }
  }

  function handleCandidateDecision(
    r: PfpRecord,
    candUrl: string,
    decision: "yes" | "no" | "skip",
    confidence?: number
  ) {
    const v = verdicts[r.lumsEmployeeId];
    const existingDecisions = v?.decisions ?? {};
    const nextDecisions: Record<string, CandidateDecision> = {
      ...existingDecisions,
      [candUrl]: {
        decision,
        confidence: confidence ?? existingDecisions[candUrl]?.confidence,
        comment: existingDecisions[candUrl]?.comment,
      },
    };
    // if yes, also set overallDecision yes and legacy choice to this url for compat
    const patch: Parameters<typeof postVerdict>[1] = { decisions: nextDecisions };
    if (decision === "yes") {
      patch.choice = candUrl;
      patch.overallDecision = "yes";
    } else if (decision === "no") {
      // if all candidates are no/skip, mark overall no; otherwise keep pending
      const allNo = r.candidates.every((c) => {
        const d = nextDecisions[c.url]?.decision;
        return d === "no" || d === "skip";
      });
      if (allNo) patch.overallDecision = "no";
      // if this was the chosen one, clear choice
      if (v?.choice === candUrl) patch.choice = null;
    }
    postVerdict(r.lumsEmployeeId, patch);
  }

  function handleConfidence(r: PfpRecord, candUrl: string, conf: number) {
    const v = verdicts[r.lumsEmployeeId];
    const existing = v?.decisions?.[candUrl];
    if (!existing) {
      // need a decision first
      setToast("Pick Yes/No/Skip first");
      return;
    }
    const next = { ...v!.decisions!, [candUrl]: { ...existing, confidence: conf } };
    postVerdict(r.lumsEmployeeId, { decisions: next });
  }

  function handleComment(r: PfpRecord, candUrl: string, text: string) {
    const v = verdicts[r.lumsEmployeeId];
    const existing = v?.decisions?.[candUrl] ?? { decision: "skip" as const };
    const next = { ...(v?.decisions ?? {}), [candUrl]: { ...existing, comment: text.slice(0, 1000) } };
    postVerdict(r.lumsEmployeeId, { decisions: next });
  }

  return (
    <div className="flex-1 bg-[#fafafa] min-h-screen">
      <div className="mx-auto max-w-[1400px] px-3 sm:px-6 py-6">
        {/* Header */}
        <div className="bg-white border border-gray-200 p-5 sm:p-6 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-[#0b163a] tracking-tight">PFP Review — 13 agents · 134 leads</h1>
              <p className="text-sm text-gray-600 mt-1 max-w-3xl">
                Each of the 13 shards hunts ~10 professors across <b>LinkedIn</b>, <b>lums.edu.pk</b>, <b>Scholar / ResearchGate</b> and generic web.
                Every candidate comes with a confidence score (0–10), source type, and evidence. You review per-candidate <b>Yes / No / Skip</b>, rate your own confidence, leave comments, and <b>send back to agents</b> with instructions.
              </p>
              <div className="flex flex-wrap gap-2 mt-3 text-xs">
                <span className="px-2 py-1 bg-gray-100 border border-gray-200">Total <b>{stats.total}</b></span>
                <span className="px-2 py-1 bg-yellow-50 border border-yellow-200">Pending <b>{stats.pending}</b></span>
                <span className="px-2 py-1 bg-green-50 border border-green-200 text-green-800">Yes <b>{stats.yes}</b></span>
                <span className="px-2 py-1 bg-red-50 border border-red-200 text-red-800">No <b>{stats.no}</b></span>
                <span className="px-2 py-1 bg-gray-50 border border-gray-200">Skip <b>{stats.skip}</b></span>
                <span className="px-2 py-1 bg-orange-50 border border-orange-200 text-orange-800">Requeue <b>{stats.requeue}</b></span>
                <span className="px-2 py-1 bg-red-50 border border-red-200">Low conf <b>{stats.low}</b></span>
              </div>
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <a href="/api/pfp-review" target="_blank" className="px-3 py-2 bg-[#0b163a] text-white font-semibold text-center hover:bg-black">JSON dump</a>
              <button onClick={() => { navigator.clipboard.writeText(window.location.href); setToast("Link copied"); }} className="px-3 py-2 border border-gray-300 bg-white hover:bg-gray-50 font-semibold">Copy link</button>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="sticky top-0 z-20 bg-[#fafafa]/95 backdrop-blur border border-gray-200 p-3 sm:p-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {(["pending", "low_confidence", "yes", "no", "skip", "requeue", "all"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-[11px] uppercase tracking-widest font-bold border transition-colors ${filter === f ? "bg-[#0b163a] text-white border-[#0b163a]" : "bg-white text-[#0b163a] border-gray-300 hover:border-[#0b163a]"}`}
                >
                  {f.replace("_", " ")}
                </button>
              ))}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="border border-gray-300 px-2 py-1.5 text-xs bg-white">
                <option value="name">Sort: Name</option>
                <option value="score">Sort: Best score</option>
                <option value="status">Sort: Status</option>
                <option value="school">Sort: School</option>
              </select>
              <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className="border border-gray-300 px-2 py-1.5 text-xs bg-white max-w-[200px]">
                {schools.map((s) => (
                  <option key={s} value={s}>{s === "all" ? "All schools" : s}</option>
                ))}
              </select>
              {shards.length > 2 && (
                <select value={shardFilter} onChange={(e) => setShardFilter(e.target.value)} className="border border-gray-300 px-2 py-1.5 text-xs bg-white">
                  {shards.map((s) => (
                    <option key={s} value={s}>{s === "all" ? "All shards" : `Shard ${s}`}</option>
                  ))}
                </select>
              )}
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name / ID / school…"
                className="w-full sm:w-64 border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-[#0b163a] bg-white"
              />
            </div>
          </div>
          <div className="text-[11px] text-gray-500 mt-2 flex flex-wrap gap-3">
            <span>Showing <b>{visible.length}</b> / {initialRecords.length}</span>
            <span>Tip: <b>Yes</b> = this is them · <b>No</b> = not them · <b>Skip</b> = unsure, need more evidence · Use confidence ★ and comments to guide agents on requeue.</span>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="text-gray-500 mt-10 text-center">No results. Try “All” or clear search.</p>
        ) : (
          <ul className="space-y-5">
            {visible.map((r) => {
              const v = verdicts[r.lumsEmployeeId];
              const isYes = v?.overallDecision === "yes" || (!!v?.choice && v?.overallDecision !== "requeue");
              const isNo = v?.overallDecision === "no" || (v?.choice === null && !!v && v?.overallDecision !== "skip" && !v?.requeue?.requested);
              const isSkip = v?.overallDecision === "skip";
              const isRequeue = !!v?.requeue?.requested || v?.overallDecision === "requeue";
              const border = isYes ? "border-green-500 bg-green-50/30" : isRequeue ? "border-orange-400 bg-orange-50/40" : isNo ? "border-red-400 bg-red-50/30" : isSkip ? "border-gray-400 bg-gray-50" : "border-gray-200 bg-white";
              const bestScore = r.candidates[0]?.score ?? null;
              return (
                <li key={r.lumsEmployeeId} className={`border ${border} p-4 sm:p-5`}>
                  {/* prof header */}
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-[240px]">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <h2 className="font-black text-[#0b163a] text-[15px]">{r.name}</h2>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 border border-gray-200 font-mono">{r.lumsEmployeeId}</span>
                        {r.shard !== undefined && <span className="text-[11px] px-1.5 py-0.5 bg-[#0b163a] text-white">shard {r.shard}</span>}
                        <span className="text-xs text-gray-500">{r.title ?? "—"}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {[r.department, r.school].filter(Boolean).join(" · ") || <span className="italic">No dept/school</span>}
                      </div>
                      {r.queriesRun && r.queriesRun.length > 0 && (
                        <div className="text-[11px] text-gray-400 mt-1 truncate" title={r.queriesRun.join(" | ")}>q: {r.queriesRun.slice(0,2).join(" · ")}{r.queriesRun.length>2?" …":""}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className={`text-[11px] px-2 py-1 border font-semibold ${r.status==="found"?"bg-green-50 border-green-200 text-green-800": r.status==="found_low_confidence"?"bg-yellow-50 border-yellow-200 text-yellow-800": r.candidates.length===0?"bg-gray-100 border-gray-200":"bg-red-50 border-red-200 text-red-700"}`}>{r.status}</span>
                        {bestScore !== null && <span className="text-xs px-2 py-1 border bg-white font-mono">best {bestScore.toFixed(1)}</span>}
                        {v?.overallDecision && <span className={`text-xs px-2 py-1 border font-bold ${isYes?"bg-green-600 text-white border-green-600": isRequeue?"bg-orange-500 text-white border-orange-500": isNo?"bg-red-600 text-white border-red-600":"bg-gray-600 text-white"}`}>{isYes?"✓ YES": isRequeue?"↻ REQUEUE": isNo?"✗ NO": isSkip?"— SKIP": v.overallDecision}</span>}
                      </div>
                      <a href={r.profileUrl ?? "#"} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">LUMS page →</a>
                      {r.updatedAt && <span className="text-[11px] text-gray-400">{r.updatedAt}</span>}
                    </div>
                  </div>

                  {/* verdict summary */}
                  {v && (
                    <div className="mt-2 text-xs">
                      {v.requeue?.requested && <div className="px-2 py-1.5 bg-orange-100 border border-orange-200 text-orange-900">↻ Requeued: “{v.requeue.instructions}” — {new Date(v.requeue.updatedAt).toLocaleString()}</div>}
                      {v.comment && <div className="mt-1 px-2 py-1 bg-white border border-gray-200 text-gray-700">💬 {v.comment}</div>}
                      {!v.requeue?.requested && v.choice && <div className="text-green-700 font-semibold">Approved: {v.choice.slice(0,80)}…</div>}
                    </div>
                  )}

                  {/* candidates */}
                  {r.candidates.length === 0 ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-gray-500">No candidate yet — agent hasn’t found anything (or still running).</p>
                      <button type="button" disabled={!!saving} onClick={() => postVerdict(r.lumsEmployeeId, { overallDecision: "skip", comment: "no candidate found — skip for now" })} className="text-xs px-3 py-1.5 border border-gray-300 bg-white hover:bg-gray-50">Mark skip</button>
                      <button type="button" onClick={() => setExpandedComments((p) => ({ ...p, [r.lumsEmployeeId]: !p[r.lumsEmployeeId]}))} className="text-xs underline text-gray-600">Requeue →</button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-4">
                        {r.candidates.map((c) => {
                          const dec = v?.decisions?.[c.url];
                          const isChosenYes = dec?.decision === "yes";
                          const isChosenNo = dec?.decision === "no";
                          const isChosenSkip = dec?.decision === "skip";
                          const urlKey = c.url;
                          return (
                            <div key={c.url} className={`border bg-white flex flex-col ${isChosenYes ? "border-green-500 ring-1 ring-green-400" : isChosenNo ? "border-red-300 opacity-80" : isChosenSkip ? "border-gray-400" : "border-gray-200"}`}>
                              <button
                                type="button"
                                disabled={!!saving}
                                onClick={() => handleCandidateDecision(r, urlKey, "yes")}
                                className="block w-full relative"
                                title="Mark Yes — this is them"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={imgSrc(c)} alt={`${r.name} candidate`} width={240} height={240} className="w-full h-48 object-cover bg-[#0b163a]/5" loading="lazy" onError={(e)=>{ (e.target as HTMLImageElement).style.display="none"; }} />
                                {isChosenYes && <span className="absolute top-2 left-2 bg-green-600 text-white text-xs font-black px-2 py-1">YES ✓</span>}
                                {isChosenNo && <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-black px-2 py-1">NO ✗</span>}
                                {isChosenSkip && <span className="absolute top-2 left-2 bg-gray-600 text-white text-xs font-black px-2 py-1">SKIP —</span>}
                              </button>

                              <div className="p-2 flex-1 flex flex-col gap-2">
                                <div className="flex flex-wrap gap-1">
                                  <span className={`text-[11px] px-1.5 py-0.5 border font-mono ${confidenceColor(c.confidence)}`}>{c.confidence ?? "low"} {c.score.toFixed(1)}</span>
                                  <span className={`text-[11px] px-1.5 py-0.5 border uppercase tracking-wide font-semibold ${sourceBadge(c.sourceType)}`}>{c.sourceType ?? "other"}</span>
                                  {c.downloadFailed && <span className="text-[11px] px-1.5 py-0.5 bg-red-50 border border-red-200 text-red-700">download failed</span>}
                                </div>

                                <div className="text-[11px] leading-tight">
                                  <a href={c.sourceProfile} target="_blank" rel="noreferrer" className="underline text-blue-700 break-all">{c.sourceProfile.replace(/^https?:\/\//,"").slice(0,70)}</a>
                                  <div className="text-gray-600 truncate" title={c.sourceTitle ?? ""}>{c.sourceTitle ?? "—"}</div>
                                  {c.query && <div className="text-gray-400 truncate" title={c.query}>q: {c.query}</div>}
                                  {c.evidence && c.evidence.length>0 && <div className="text-gray-500 mt-1">evidence: {c.evidence.slice(0,3).join(" · ")}{c.evidence.length>3?" …":""}</div>}
                                </div>

                                {/* Yes/No/Skip */}
                                <div className="grid grid-cols-3 gap-1 mt-1">
                                  <button type="button" disabled={saving===r.lumsEmployeeId} onClick={() => handleCandidateDecision(r, urlKey, "yes")} className={`text-xs font-bold py-1.5 border ${isChosenYes ? "bg-green-600 text-white border-green-600" : "bg-white border-green-300 text-green-700 hover:bg-green-50"}`}>Yes</button>
                                  <button type="button" disabled={saving===r.lumsEmployeeId} onClick={() => handleCandidateDecision(r, urlKey, "no")} className={`text-xs font-bold py-1.5 border ${isChosenNo ? "bg-red-600 text-white border-red-600" : "bg-white border-red-300 text-red-700 hover:bg-red-50"}`}>No</button>
                                  <button type="button" disabled={saving===r.lumsEmployeeId} onClick={() => handleCandidateDecision(r, urlKey, "skip")} className={`text-xs font-bold py-1.5 border ${isChosenSkip ? "bg-gray-700 text-white border-gray-700" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}>Skip</button>
                                </div>

                                {/* your confidence 1-5 */}
                                {dec && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[11px] text-gray-500">Your confidence:</span>
                                    <div className="flex gap-0.5">
                                      {[1,2,3,4,5].map((n) => (
                                        <button key={n} type="button" onClick={() => handleConfidence(r, urlKey, n)} className={`w-6 h-6 text-xs border ${dec.confidence===n?"bg-[#0b163a] text-white border-[#0b163a]":"bg-white border-gray-300 hover:border-[#0b163a]"}`}>{n}</button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* per-candidate comment */}
                                <input
                                  type="text"
                                  placeholder="Comment on this candidate…"
                                  defaultValue={dec?.comment ?? ""}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val !== (dec?.comment ?? "")) handleComment(r, urlKey, val);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  }}
                                  className="w-full border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:border-[#0b163a] placeholder:text-gray-400"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* prof-level actions */}
                      <div className="mt-4 border-t border-gray-200 pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" disabled={!!saving} onClick={() => postVerdict(r.lumsEmployeeId, { overallDecision: "no", choice: null })} className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 border border-red-300 text-red-700 hover:bg-red-50">None of these are them (Reject all)</button>
                          <button type="button" disabled={!!saving} onClick={() => postVerdict(r.lumsEmployeeId, { overallDecision: "skip" })} className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 border border-gray-300 hover:bg-gray-50">Skip — unsure</button>
                          <button type="button" onClick={() => setExpandedComments((p)=>({...p, [r.lumsEmployeeId]: !p[r.lumsEmployeeId]}))} className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 bg-white border border-[#0b163a] text-[#0b163a] hover:bg-gray-50">{expandedComments[r.lumsEmployeeId] ? "Hide" : "Comment / Requeue"} ↻</button>
                          {saving===r.lumsEmployeeId && <span className="text-xs text-gray-500">Saving…</span>}
                        </div>

                        {expandedComments[r.lumsEmployeeId] && (
                          <div className="mt-3 bg-white border border-gray-200 p-3">
                            <label className="text-xs font-semibold text-gray-700">Overall comment (visible to agents on requeue)</label>
                            <textarea
                              defaultValue={v?.comment ?? ""}
                              placeholder="e.g. Wrong person — this is a different Ayesha Ahmad from IBA. Try searching with 'SDSB LUMS' or check CS dept page..."
                              rows={2}
                              id={`comment-${r.lumsEmployeeId}`}
                              className="w-full mt-1 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#0b163a]"
                            />
                            <div className="mt-2">
                              <label className="text-xs font-semibold text-gray-700">Requeue instructions (sends back to that shard’s agent)</label>
                              <textarea
                                value={requeueDraft[r.lumsEmployeeId] ?? v?.requeue?.instructions ?? ""}
                                onChange={(e)=> setRequeueDraft((p)=>({...p, [r.lumsEmployeeId]: e.target.value}))}
                                placeholder="e.g. Search ResearchGate + LUMS site, try 'Ateeq Abdul Rauf SDSB marketing' — LinkedIn result is wrong person"
                                rows={2}
                                className="w-full mt-1 border border-orange-200 bg-orange-50/50 px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                              />
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button
                                type="button"
                                disabled={!!saving}
                                onClick={() => {
                                  const el = document.getElementById(`comment-${r.lumsEmployeeId}`) as HTMLTextAreaElement | null;
                                  const comment = el?.value ?? "";
                                  const instr = requeueDraft[r.lumsEmployeeId] ?? "";
                                  if (instr.trim()) {
                                    postVerdict(r.lumsEmployeeId, { comment, requeueInstructions: instr.trim() });
                                  } else {
                                    postVerdict(r.lumsEmployeeId, { comment, overallDecision: "skip" });
                                    setToast("Comment saved (no requeue — add instructions to send back)");
                                  }
                                }}
                                className="text-xs font-bold px-4 py-2 bg-[#0b163a] text-white hover:bg-black"
                              >
                                Save comment
                              </button>
                              <button
                                type="button"
                                disabled={!!saving || !(requeueDraft[r.lumsEmployeeId] ?? v?.requeue?.instructions ?? "").trim()}
                                onClick={() => {
                                  const el = document.getElementById(`comment-${r.lumsEmployeeId}`) as HTMLTextAreaElement | null;
                                  const comment = el?.value ?? v?.comment ?? "";
                                  const instr = (requeueDraft[r.lumsEmployeeId] ?? v?.requeue?.instructions ?? "").trim();
                                  if (!instr) { setToast("Add requeue instructions first"); return; }
                                  postVerdict(r.lumsEmployeeId, { comment, requeueInstructions: instr });
                                }}
                                className="text-xs font-bold px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                ↻ Send back to agents
                              </button>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1">Requeue writes to <code>data/pfp_requeue.json</code> and marks this prof as “requeue” — next agent run picks it up via <code>--force --shards-file</code> or manual rerun of that shard.</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* how to re-run agents */}
        <div className="mt-10 border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-black text-[#0b163a]">Agent ops</h3>
          <p className="text-xs text-gray-600 mt-1">After you mark requeues/comments, re-run only those shards that have requeued leads:</p>
          <pre className="mt-2 bg-[#0b163a] text-green-200 text-xs p-3 overflow-auto">{`# run all 13 shards (each ~10 leads, polite sleeps to avoid IP bans)
./scripts/run_agents.sh

# rerun a single shard
./scripts/run_agents.sh 4

# dry run: 2 leads per shard
./scripts/run_agents.sh --limit=2

# after you requeue some, force-reprocess requeued only
python scripts/requeue_run.py
cat data/pfp_requeue.json   # your feedback queue
python scripts/aggregate.py # summary + score dist`}</pre>
          <div className="text-xs text-gray-500 mt-2">Current shard map: <code>data/pfp_shards.json</code> · Results: <code>data/pfp_candidates.json</code> · Verdicts: <code>data/pfp_verdicts.json</code> · Requeue: <code>data/pfp_requeue.json</code></div>
        </div>
      </div>

      {toast && <div className="fixed bottom-4 right-4 bg-[#0b163a] text-white text-sm px-4 py-2 shadow-lg">{toast}</div>}
    </div>
  );
}
