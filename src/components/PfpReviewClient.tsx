"use client";

import { useMemo, useState } from "react";
import type { PfpRecord, Verdict } from "@/lib/pfpStore";

type Filter = "pending" | "approved" | "rejected" | "all";

function imgSrc(record: PfpRecord, url: string): string {
  const cand = record.candidates.find((c) => c.url === url);
  return cand?.localPath ?? url;
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
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const decided = Object.keys(verdicts).length;
  const approved = Object.values(verdicts).filter((v) => v.choice !== null).length;
  const rejected = decided - approved;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialRecords.filter((r) => {
      const v = verdicts[r.lumsEmployeeId];
      if (filter === "pending" && v) return false;
      if (filter === "approved" && (!v || v.choice === null)) return false;
      if (filter === "rejected" && (!v || v.choice !== null)) return false;
      if (
        q &&
        !r.name.toLowerCase().includes(q) &&
        !(r.school ?? "").toLowerCase().includes(q) &&
        !(r.title ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [initialRecords, verdicts, filter, query]);

  async function save(employeeId: string, choice: string | null) {
    setSaving(employeeId);
    const optimistic = { lumsEmployeeId: employeeId, choice, updatedAt: new Date().toISOString() };
    setVerdicts((prev) => ({ ...prev, [employeeId]: optimistic }));
    try {
      const res = await fetch("/api/pfp-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lumsEmployeeId: employeeId, choice }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.error("save failed", data);
        setVerdicts((prev) => {
          const next = { ...prev };
          delete next[employeeId];
          return next;
        });
      }
    } catch (err) {
      console.error(err);
      setVerdicts((prev) => {
        const next = { ...prev };
        delete next[employeeId];
        return next;
      });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex-1 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-lums-navy">LinkedIn PFP Review</h1>
        <p className="text-sm text-gray-600 mt-1">
          Scraped candidates for the {initialRecords.length} faculty missing photos. Pick the
          correct face per professor, or reject all. Click a photo to approve it.
        </p>

        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-700">
              <b>{decided}</b>/{initialRecords.length} reviewed
              <span className="text-green-700"> · {approved} ok</span>
              <span className="text-red-700"> · {rejected} rejected</span>
            </span>
            <div className="flex gap-1 ml-auto">
              {(["pending", "approved", "rejected", "all"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs uppercase tracking-wide font-semibold border transition-colors ${
                    filter === f
                      ? "bg-lums-navy text-white border-lums-navy"
                      : "bg-white text-lums-navy border-gray-300 hover:border-lums-navy"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name / school…"
              className="w-full sm:w-64 border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-lums-navy"
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="text-gray-500 mt-10 text-center">
            Nothing here. The scraper may still be running — refresh in a bit.
          </p>
        ) : (
          <ul className="mt-6 space-y-6">
            {visible.map((r) => {
              const v = verdicts[r.lumsEmployeeId];
              return (
                <li
                  key={r.lumsEmployeeId}
                  className={`border p-4 ${
                    v?.choice
                      ? "border-green-500 bg-green-50/50"
                      : v
                        ? "border-red-400 bg-red-50/40"
                        : "border-gray-200"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="font-bold text-lums-navy">{r.name}</h2>
                    <span className="text-xs text-gray-500">{r.title ?? "—"}</span>
                    <span className="text-xs text-gray-400">{r.school ?? ""}</span>
                    <a
                      href={r.profileUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-700 underline ml-auto"
                    >
                      LUMS page
                    </a>
                  </div>

                  {v && (
                    <p className="text-xs mt-1 font-semibold">
                      {v.choice ? (
                        <span className="text-green-700">Approved ✓</span>
                      ) : (
                        <span className="text-red-700">All rejected ✗</span>
                    )}
                    </p>
                  )}

                  {r.candidates.length === 0 ? (
                    <p className="text-sm text-gray-500 mt-3">
                      No candidate found by scraper.
                      <button
                        type="button"
                        disabled={saving === r.lumsEmployeeId}
                        onClick={() => save(r.lumsEmployeeId, null)}
                        className="ml-2 text-xs underline text-gray-600 hover:text-black"
                      >
                        mark as seen
                      </button>
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-4 mt-3">
                        {r.candidates.map((c) => {
                          const chosen = v?.choice === c.url || v?.choice === c.localPath;
                          return (
                            <div key={c.url} className="w-36">
                              <button
                                type="button"
                                disabled={saving === r.lumsEmployeeId}
                                onClick={() => save(r.lumsEmployeeId, c.url)}
                                className={`block w-full border-2 transition-colors ${
                                  chosen
                                    ? "border-green-600"
                                    : "border-transparent hover:border-lums-gold"
                                }`}
                                title="Click to approve"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imgSrc(r, c.url)}
                                  alt={`${r.name} candidate`}
                                  width={144}
                                  height={144}
                                  className="w-full h-36 object-cover bg-lums-gray"
                                  loading="lazy"
                                />
                              </button>
                              <div className="text-[11px] text-gray-500 mt-1 leading-tight">
                                score {c.score}
                                {" · "}
                                <a
                                  href={c.sourceProfile}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline text-blue-700"
                                >
                                  source
                                </a>
                                <div className="truncate" title={c.sourceTitle ?? ""}>
                                  {c.sourceTitle}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3">
                        <button
                          type="button"
                          disabled={saving === r.lumsEmployeeId}
                          onClick={() => save(r.lumsEmployeeId, null)}
                          className="text-xs font-semibold uppercase tracking-wide px-3 py-1.5 border border-red-300 text-red-700 hover:bg-red-100 transition-colors"
                        >
                          None of these are them
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
