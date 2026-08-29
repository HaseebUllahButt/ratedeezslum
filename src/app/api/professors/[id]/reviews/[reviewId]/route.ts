import { auth } from "@/auth";
import { deleteReview, updateReview } from "@/lib/db";
import { reviewOwnerKey } from "@/lib/reviewOwnership";
import { isValidRating } from "@/lib/validation";

type ReviewInput = {
  rating?: unknown;
  comment?: unknown;
};

type ParsedReview =
  | { error: string }
  | {
      value: {
        rating: number;
        comment: string;
      };
    };

function parseIds(id: string, reviewId: string): { professorId: number; reviewId: number } | null {
  const professorIdNumber = Number(id);
  const reviewIdNumber = Number(reviewId);
  if (!Number.isInteger(professorIdNumber) || !Number.isInteger(reviewIdNumber)) return null;
  return { professorId: professorIdNumber, reviewId: reviewIdNumber };
}

async function getOwnerKey() {
  const session = await auth();
  const email = session?.user?.email;
  return email ? reviewOwnerKey(email) : null;
}

function parseReviewInput(body: ReviewInput): ParsedReview {
  const { rating, comment } = body;

  if (!isValidRating(rating)) return { error: "rating must be an integer 1-5" };
  if (typeof comment !== "string" || comment.trim().length < 10) {
    return { error: "comment must be at least 10 characters" };
  }
  if (comment.length > 2000) return { error: "comment must be under 2000 characters" };

  return {
    value: {
      rating,
      comment: comment.trim(),
    },
  };
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/professors/[id]/reviews/[reviewId]">
) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return Response.json({ error: "You must sign in with your LUMS account." }, { status: 401 });
  }

  const { id, reviewId } = await ctx.params;
  const ids = parseIds(id, reviewId);
  if (!ids) return Response.json({ error: "Invalid review id" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseReviewInput((body ?? {}) as ReviewInput);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  const review = await updateReview({
    ...ids,
    ownerKey,
    ...parsed.value,
  });
  if (!review) return Response.json({ error: "Review not found" }, { status: 404 });

  return Response.json({ review });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/professors/[id]/reviews/[reviewId]">
) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return Response.json({ error: "You must sign in with your LUMS account." }, { status: 401 });
  }

  const { id, reviewId } = await ctx.params;
  const ids = parseIds(id, reviewId);
  if (!ids) return Response.json({ error: "Invalid review id" }, { status: 400 });

  const deleted = await deleteReview({ ...ids, ownerKey });
  if (!deleted) return Response.json({ error: "Review not found" }, { status: 404 });

  return new Response(null, { status: 204 });
}
