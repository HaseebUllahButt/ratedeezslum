"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { ProfessorWithStats } from "@/lib/db";
import Avatar from "@/components/Avatar";
import StarRating from "@/components/StarRating";

type SortKey = "highest" | "lowest" | "most-reviewed" | "name";

function sortProfessors(list: ProfessorWithStats[], sort: SortKey): ProfessorWithStats[] {
  const copy = [...list];
  switch (sort) {
    case "highest":
      return copy.sort((a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1));
    case "lowest":
      return copy.sort((a, b) => (a.avg_rating ?? 6) - (b.avg_rating ?? 6));
    case "most-reviewed":
      return copy.sort((a, b) => b.review_count - a.review_count);
    case "name":
    default:
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export default function ProfessorList({
  initialProfessors,
  totalProfessors,
}: {
  initialProfessors: ProfessorWithStats[];
  totalProfessors: number;
}) {
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState("");
  const [sort, setSort] = useState<SortKey>("highest");
  const [results, setResults] = useState(initialProfessors);
  const [isPending, startTransition] = useTransition();

  const schools = useMemo(() => {
    const set = new Set<string>();
    initialProfessors.forEach((p) => p.school && set.add(p.school));
    return [...set].sort();
  }, [initialProfessors]);

  function runSearch(nextQuery: string, nextSchool: string, nextSort: SortKey) {
    startTransition(async () => {
      const params = new URLSearchParams();
      if (nextQuery) params.set("q", nextQuery);
      const res = await fetch(`/api/professors?${params.toString()}`);
      const data = await res.json();
      const filtered = nextSchool
        ? data.professors.filter((p: ProfessorWithStats) => p.school === nextSchool)
        : data.professors;
      setResults(sortProfessors(filtered, nextSort));
    });
  }

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
              placeholder="Name"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                runSearch(e.target.value, school, sort);
              }}
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
            onChange={(e) => {
              setSchool(e.target.value);
              runSearch(query, e.target.value, sort);
            }}
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
            onChange={(e) => {
              const nextSort = e.target.value as SortKey;
              setSort(nextSort);
              setResults((prev) => sortProfessors(prev, nextSort));
            }}
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
        {isPending
          ? "Searching..."
          : `Showing ${results.length} of ${totalProfessors} faculty members`}
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
        {results.length === 0 && (
          <li className="border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-600">
              No professors match that search. Try a different name or school.
            </p>
          </li>
        )}
      </ul>
    </div>
  );
}
