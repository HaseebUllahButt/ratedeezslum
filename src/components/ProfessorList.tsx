"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ProfessorWithStats } from "@/lib/db";
import type { SortKey } from "@/lib/db";
import Avatar from "@/components/Avatar";
import StarRating from "@/components/StarRating";

const PAGE_SIZE = 24;

export default function ProfessorList({
  initialProfessors,
  totalProfessors,
  initialHasMore,
  schools,
  initialSort = "highest",
}: {
  initialProfessors: ProfessorWithStats[];
  totalProfessors: number; // unfiltered total (for "of 425")
  initialHasMore: boolean;
  schools: string[];
  initialSort?: SortKey;
}) {
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState("");
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [results, setResults] = useState<ProfessorWithStats[]>(initialProfessors);
  const [totalFiltered, setTotalFiltered] = useState(totalProfessors);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const offsetRef = useRef(initialProfessors.length);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // keep refs for current filters to avoid stale closures in observer
  const filtersRef = useRef({ query, school, sort, totalFiltered, hasMore });
  useEffect(() => {
    filtersRef.current = { query, school, sort, totalFiltered, hasMore };
  }, [query, school, sort, totalFiltered, hasMore]);

  const fetchPage = useCallback(
    async (opts: { q: string; school: string; sort: SortKey; offset: number; append: boolean }) => {
      // cancel previous search request (not append loads)
      if (!opts.append) {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setIsSearching(true);
        try {
          const params = new URLSearchParams();
          if (opts.q) params.set("q", opts.q);
          if (opts.school) params.set("school", opts.school);
          params.set("sort", opts.sort);
          params.set("limit", String(PAGE_SIZE));
          params.set("offset", String(opts.offset));
          const res = await fetch(`/api/professors?${params.toString()}`, { signal: ctrl.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as {
            professors: ProfessorWithStats[];
            total: number;
            hasMore: boolean;
          };
          setResults(data.professors);
          setTotalFiltered(data.total);
          setHasMore(data.hasMore);
          offsetRef.current = data.professors.length;
        } catch (e: unknown) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          console.error("search failed", e);
        } finally {
          setIsSearching(false);
        }
        return;
      }

      // append (infinite scroll)
      if (isLoadingMore) return;
      setIsLoadingMore(true);
      try {
        const params = new URLSearchParams();
        if (opts.q) params.set("q", opts.q);
        if (opts.school) params.set("school", opts.school);
        params.set("sort", opts.sort);
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(opts.offset));
        const res = await fetch(`/api/professors?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          professors: ProfessorWithStats[];
          total: number;
          hasMore: boolean;
        };
        setResults((prev) => [...prev, ...data.professors]);
        setTotalFiltered(data.total);
        setHasMore(data.hasMore);
        offsetRef.current = opts.offset + data.professors.length;
      } catch (e) {
        console.error("load more failed", e);
      } finally {
        setIsLoadingMore(false);
      }
    },
    [isLoadingMore]
  );

  // avoid refetch on initial mount - SSR already supplied first page
  const isFirstRender = useRef(true);
  const prevQuery = useRef(query);

  // debounced when query changes, immediate when school/sort changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevQuery.current = query;
      return;
    }
    const queryChanged = prevQuery.current !== query;
    prevQuery.current = query;
    if (queryChanged) {
      const id = setTimeout(() => {
        void fetchPage({ q: query, school, sort, offset: 0, append: false });
      }, 350);
      return () => clearTimeout(id);
    }
    void fetchPage({ q: query, school, sort, offset: 0, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, school, sort]);

  // infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        const { query: q, school: sc, sort: s, hasMore: hm } = filtersRef.current;
        if (!hm || isSearching || isLoadingMore) return;
        void fetchPage({ q, school: sc, sort: s, offset: offsetRef.current, append: true });
      },
      { rootMargin: "600px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchPage, isSearching, isLoadingMore]);

  return (
    <div className="w-full">
      <div className="flex flex-row gap-1.5 sm:gap-4 items-end bg-slate-50 p-2 sm:p-6 border border-slate-200 shadow-sm sticky top-0 z-40 -mx-4 px-2 sm:-mx-6 sm:px-12">
        <label className="flex flex-col gap-2 flex-1 min-w-0">
          <span className="text-[10px] sm:text-xs font-bold text-lums-navy uppercase tracking-wide">
            Search Professors
          </span>
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Name, department or school"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border border-slate-300 bg-white pl-8 pr-2 py-2 sm:pl-10 sm:pr-4 sm:py-3 text-xs sm:text-sm text-slate-900 rounded-none outline-none focus:border-lums-navy focus:ring-1 focus:ring-lums-navy"
            />
          </div>
        </label>
        <label className="flex flex-col gap-2 w-28 sm:w-56 flex-shrink-0">
          <span className="text-[10px] sm:text-xs font-bold text-lums-navy uppercase tracking-wide">
            School
          </span>
          <select
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            className="w-full border border-slate-300 bg-white px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-900 rounded-none cursor-pointer outline-none focus:border-lums-navy focus:ring-1 focus:ring-lums-navy"
          >
            <option value="">All Schools</option>
            {schools.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 w-28 sm:w-56 flex-shrink-0">
          <span className="text-[10px] sm:text-xs font-bold text-lums-navy uppercase tracking-wide">
            Sort By
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-full border border-slate-300 bg-white px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-900 rounded-none cursor-pointer outline-none focus:border-lums-navy focus:ring-1 focus:ring-lums-navy"
          >
            <option value="highest">Highest Rated</option>
            <option value="lowest">Lowest Rated</option>
            <option value="most-reviewed">Most Reviewed</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </label>
      </div>

      <p className="text-xs font-medium text-slate-600 my-3">
        {isSearching
          ? "Searching..."
          : `Showing ${results.length} of ${totalFiltered} faculty members${totalFiltered !== totalProfessors ? ` (filtered from ${totalProfessors})` : ""}`}
      </p>

      <ul className="flex flex-col gap-3">
        {results.map((p) => (
          <li
            key={p.id}
            className="group flex flex-col gap-4 border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-lums-navy hover:shadow-md sm:flex-row sm:items-center sm:gap-6 sm:p-6"
          >
            <Link
              href={`/professor/${p.id}`}
              className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 cursor-pointer min-w-0"
            >
              <div className="relative flex-shrink-0 self-start sm:self-center">
                <Avatar
                  name={p.name}
                  photoUrl={p.photo_url}
                  size={80}
                  className="h-20 w-20 rounded-none object-cover shadow-sm transition-transform group-hover:scale-105 sm:h-25 sm:w-25 border border-slate-200"
                />
              </div>
              <div className="flex min-w-0 grow flex-col gap-1">
                <div>
                  <h3 className="text-lg font-bold text-lums-navy transition-colors group-hover:text-lums-navy-dark sm:text-xl uppercase tracking-tight">
                    {p.name}
                  </h3>
                  <p className="text-sm font-medium text-slate-600 sm:text-base border-b border-slate-100 pb-2 mb-2 inline-block">
                    {[p.title, p.department].filter(Boolean).join(" · ") || p.school}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {p.review_count > 0 ? (
                    <>
                      <div className="flex items-center text-lums-gold">
                        <StarRating value={p.avg_rating ?? 0} />
                      </div>
                      <span className="text-sm font-bold text-slate-900">
                        {p.avg_rating?.toFixed(1)}/5.0
                      </span>
                      <span className="text-xs text-slate-500">
                        ({p.review_count} review{p.review_count === 1 ? "" : "s"})
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">No reviews yet</span>
                  )}
                </div>
              </div>
            </Link>
            <a
              href={p.profile_url ?? `/professor/${p.id}`}
              target={p.profile_url ? "_blank" : undefined}
              rel={p.profile_url ? "noopener noreferrer" : undefined}
              className="inline-flex items-center justify-center gap-1 border border-lums-navy text-lums-navy text-xs sm:text-sm font-bold uppercase tracking-wide px-4 py-2 transition-colors hover:bg-lums-navy hover:text-white sm:w-auto sm:px-6 sm:py-2.5 flex-shrink-0 sm:self-center"
            >
              Profile
              <svg
                className="h-3 w-3 sm:h-4 sm:w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </li>
        ))}
        {results.length === 0 && !isSearching && (
          <li className="border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-600">
              No professors match that search. Try a different name or school.
            </p>
          </li>
        )}
      </ul>

      <div ref={sentinelRef} className="h-6 w-full" aria-hidden />
      {isLoadingMore && <p className="text-center text-xs text-slate-500 py-4">Loading more...</p>}
      {!hasMore && results.length > 0 && <p className="text-center text-xs text-slate-400 py-4">You&apos;ve reached the end.</p>}
    </div>
  );
}
