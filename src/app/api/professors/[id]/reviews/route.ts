import { auth } from "@/auth";
import { getProfessor, insertReview } from "@/lib/db";
import { reviewOwnerKey } from "@/lib/reviewOwnership";
import { isValidRating } from "@/lib/validation";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/professors/[id]/reviews">
) {
  const session = await auth();
  // The signIn callback in src/auth.ts already restricts sign-in to
  // @lums.edu.pk accounts, so a present session is enough — the email
  // itself is never stored or shown with the review.
  if (!session?.user) {
    return Response.json(
      { error: "You must sign in with your LUMS account to submit a review." },
      { status: 401 }
    );
  }

  const email = session.user.email;
  if (!email) {
    return Response.json({ error: "Your account email could not be verified." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const professorId = Number(id);
  if (!Number.isInteger(professorId)) {
    return Response.json({ error: "Invalid professor id" }, { status: 400 });
  }

  const professor = await getProfessor(professorId);
  if (!professor) {
    return Response.json({ error: "Professor not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    course,
    rating,
    difficulty,
    wouldTakeAgain,
    comment,
  } = (body ?? {}) as Record<string, unknown>;

  if (!isValidRating(rating)) {
    return Response.json({ error: "rating must be an integer 1-5" }, { status: 400 });
  }
  if (!isValidRating(difficulty)) {
    return Response.json({ error: "difficulty must be an integer 1-5" }, { status: 400 });
  }
  if (typeof wouldTakeAgain !== "boolean") {
    return Response.json({ error: "wouldTakeAgain must be a boolean" }, { status: 400 });
  }
  if (typeof comment !== "string" || comment.trim().length < 10) {
    return Response.json(
      { error: "comment must be at least 10 characters" },
      { status: 400 }
    );
  }
  if (comment.length > 2000) {
    return Response.json({ error: "comment must be under 2000 characters" }, { status: 400 });
  }

  const review = await insertReview({
    professorId,
    ownerKey: reviewOwnerKey(email),
    course: typeof course === "string" && course.trim() ? course.trim().slice(0, 100) : null,
    rating,
    difficulty,
    wouldTakeAgain,
    comment: comment.trim(),
  });

  return Response.json({ review }, { status: 201 });
}
