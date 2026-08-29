"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Review } from "@/lib/db";
import { StarRatingInput } from "@/components/StarRating";

export default function ReviewForm({
  professorId,
  review,
  onCancel,
}: {
  professorId: number;
  review?: Review;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const editing = !!review;
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        editing
          ? `/api/professors/${professorId}/reviews/${review.id}`
          : `/api/professors/${professorId}/reviews`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rating,
            comment,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      if (!editing) {
        setRating(5);
        setComment("");
      }
      onCancel?.();
      router.refresh();
    } catch {
      setError("Could not save your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 bg-lums-gray border-t-4 border-lums-gold p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-lums-navy uppercase">
            {editing ? "Edit your anonymous review" : "Leave an anonymous review"}
          </h3>
          <p className="text-xs opacity-60 mt-1">
            You&apos;re signed in with your LUMS account to submit — it is
            never stored or shown with your review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-xs text-lums-navy opacity-60 hover:opacity-100 hover:underline whitespace-nowrap"
        >
          Sign out
        </button>
      </div>

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend>Rating (1-5)</legend>
        <StarRatingInput value={rating} onChange={setRating} />
        <span className="text-xs text-slate-600" aria-live="polite">
          {rating} out of 5 stars
        </span>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        Comment
        <textarea
          maxLength={2000}
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="rounded-none border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-lums-navy"
        />
      </label>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-none bg-lums-gold text-lums-navy px-5 py-2.5 font-bold uppercase text-sm hover:bg-lums-gold-dark transition-colors disabled:opacity-50 w-fit"
      >
        {submitting ? "Saving..." : editing ? "Save Changes" : "Submit Review"}
      </button>
      {editing && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="w-fit text-sm font-bold uppercase text-lums-navy underline disabled:opacity-50"
        >
          Cancel
        </button>
      )}
    </form>
  );
}
