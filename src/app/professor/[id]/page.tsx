import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getProfessor, listReviewsForProfessor } from "@/lib/db";
import ReviewForm from "@/components/ReviewForm";
import SignInBox from "@/components/SignInBox";
import ReviewList from "@/components/ReviewList";
import Avatar from "@/components/Avatar";
import StarRating from "@/components/StarRating";
import ShareButton from "@/components/ShareButton";
import { reviewOwnerKey } from "@/lib/reviewOwnership";

function formatAvg(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

export default async function ProfessorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const professorId = Number(id);
  if (!Number.isInteger(professorId)) notFound();

  const professor = await getProfessor(professorId);
  if (!professor) notFound();

  const session = await auth();
  const ownerKey = session?.user?.email ? reviewOwnerKey(session.user.email) : undefined;
  const reviews = await listReviewsForProfessor(professorId, ownerKey);

  return (
    <div className="flex flex-col flex-1 items-center bg-white">
      <main className="flex flex-1 w-full max-w-2xl flex-col py-12 px-6 gap-8">
        <Link
          href="/"
          className="text-sm font-bold text-lums-navy hover:underline w-fit uppercase"
        >
          &larr; Back to Faculty Search
        </Link>

        <div className="flex flex-col gap-4 pb-6 border-b border-slate-200 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-5">
            <Avatar
              name={professor.name}
              photoUrl={professor.photo_url}
              s3PhotoUrl={professor.s3_photo_url}
              size={96}
              className="h-24 w-24 rounded-none object-cover shadow-sm border border-slate-200"
            />
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-extrabold text-lums-navy uppercase">
                {professor.name}
              </h1>
              <p className="opacity-70">
                {[professor.title, professor.department].filter(Boolean).join(" · ")}
              </p>
              <p className="text-sm opacity-50 mb-2">{professor.school}</p>
              {professor.review_count > 0 && (
                <div className="flex items-center gap-2">
                  <StarRating value={professor.avg_rating ?? 0} size="text-lg" />
                  <span className="font-bold">{formatAvg(professor.avg_rating)} / 5.0</span>
                  <span className="text-sm opacity-50">
                    ({professor.review_count} review{professor.review_count === 1 ? "" : "s"})
                  </span>
                </div>
              )}
              {professor.profile_url && (
                <a
                  href={professor.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-lums-navy hover:underline inline-block mt-1"
                >
                  LUMS faculty profile &rarr;
                </a>
              )}
            </div>
          </div>
          <ShareButton />
        </div>

        {session?.user ? (
          reviews.some((review) => review.is_owner) ? (
            <p className="border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              You&apos;ve already reviewed this professor. You can edit your review below.
            </p>
          ) : (
            <ReviewForm professorId={professor.id} />
          )
        ) : (
          <SignInBox />
        )}

        <ReviewList reviews={reviews} />
      </main>
    </div>
  );
}
