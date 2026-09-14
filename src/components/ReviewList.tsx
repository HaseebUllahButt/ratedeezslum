"use client";

import { useMemo, useState } from "react";
import type { ReviewWithOwnership } from "@/lib/db";
import ReviewCard from "@/components/ReviewCard";

type ReviewSort = "recent" | "highest-rated";

function sortReviews(reviews: ReviewWithOwnership[], sort: ReviewSort) {
  return [...reviews].sort((a, b) => {
    if (sort === "highest-rated" && a.rating !== b.rating) {
      return b.rating - a.rating;
    }

    const dateDifference = Date.parse(b.created_at) - Date.parse(a.created_at);
    return dateDifference || b.id - a.id;
  });
}

export default function ReviewList({ reviews }: { reviews: ReviewWithOwnership[] }) {
  const [sort, setSort] = useState<ReviewSort>("recent");
  const sortedReviews = useMemo(() => sortReviews(reviews, sort), [reviews, sort]);

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-extrabold text-lums-navy uppercase mb-1">Reviews</h2>
          <div className="w-14 h-1 bg-lums-gold" />
        </div>
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-lums-navy">
          <span className="sr-only sm:not-sr-only">Sort by</span>
          <select
            aria-label="Sort reviews"
            value={sort}
            onChange={(event) => setSort(event.target.value as ReviewSort)}
            className="border border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-900 outline-none focus:border-lums-navy focus:ring-1 focus:ring-lums-navy"
          >
            <option value="recent">Most recent</option>
            <option value="highest-rated">Highest rated</option>
          </select>
        </label>
      </div>

      <ul className="flex flex-col gap-3">
        {sortedReviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
        {sortedReviews.length === 0 && (
          <li className="text-center opacity-60 py-6">
            No reviews yet. Be the first to leave one.
          </li>
        )}
      </ul>
    </div>
  );
}
