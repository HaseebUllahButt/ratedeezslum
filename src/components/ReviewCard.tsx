"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReviewWithOwnership } from "@/lib/db";
import { timeAgo } from "@/lib/time";
import ReviewForm from "@/components/ReviewForm";
import StarRating from "@/components/StarRating";

export default function ReviewCard({ review }: { review: ReviewWithOwnership }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm("Delete this review? This cannot be undone.")) return;

    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/professors/${review.professor_id}/reviews/${review.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not delete your review.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not delete your review. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <li>
        <ReviewForm
          professorId={review.professor_id}
          review={review}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <span className="font-bold text-lums-navy uppercase text-sm">Anonymous</span>
          <p className="text-xs opacity-50">{timeAgo(review.created_at)}</p>
        </div>
        <div className="flex items-center gap-3">
          <StarRating value={review.rating} />
          {review.is_owner && (
            <div className="flex gap-2 text-xs font-bold uppercase">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-lums-navy underline hover:opacity-70"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-red-700 underline hover:opacity-70 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs opacity-60 mb-2">
        {review.course && <span>Course: {review.course}</span>}
        <span>Difficulty: {review.difficulty}/5</span>
        <span>{review.would_take_again ? "Would take again" : "Would not take again"}</span>
      </div>
      <p className="text-sm">{review.comment}</p>
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </li>
  );
}
