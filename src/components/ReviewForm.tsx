"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Review } from "@/lib/db";

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
  const [course, setCourse] = useState(review?.course ?? "");
  const [rating, setRating] = useState(review?.rating ?? 5);
  const [difficulty, setDifficulty] = useState(review?.difficulty ?? 3);
  const [wouldTakeAgain, setWouldTakeAgain] = useState(review?.would_take_again ?? true);
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
            course,
            rating,
            difficulty,
            wouldTakeAgain,
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
        setCourse("");
        setRating(5);
        setDifficulty(3);
        setWouldTakeAgain(true);
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

      <label className="flex flex-col gap-1 text-sm">
        Course (optional)
        <input
          type="text"
          placeholder="e.g. CS 100"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          className="rounded-none border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-lums-navy"
        />
      </label>

      <div className="flex gap-4">
        <label className="flex flex-col gap-1 text-sm flex-1">
          Rating (1-5)
          <input
            type="number"
            min={1}
            max={5}
            required
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="rounded-none border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-lums-navy"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1">
          Difficulty (1-5)
          <input
            type="number"
            min={1}
            max={5}
            required
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className="rounded-none border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-lums-navy"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={wouldTakeAgain}
          onChange={(e) => setWouldTakeAgain(e.target.checked)}
          className="accent-lums-navy"
        />
        Would take again
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Comment
        <textarea
          required
          minLength={10}
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
