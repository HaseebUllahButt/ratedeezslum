import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getProfessor, listReviewsForProfessor } from "@/lib/db";
import ReviewForm from "@/components/ReviewForm";
import SignInBox from "@/components/SignInBox";
import Avatar from "@/components/Avatar";
import StarRating from "@/components/StarRating";
import { timeAgo } from "@/lib/time";

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

  const [reviews, session] = await Promise.all([
    listReviewsForProfessor(professorId),
    auth(),
  ]);

  return (
    <div className="flex flex-col flex-1 items-center bg-white">
      <main className="flex flex-1 w-full max-w-2xl flex-col py-12 px-6 gap-8">
        <Link
          href="/"
          className="text-sm font-bold text-lums-navy hover:underline w-fit uppercase"
        >
          &larr; Back to Faculty Search
        </Link>

        <div className="flex items-start gap-5 pb-6 border-b border-slate-200">
          <Avatar
            name={professor.name}
            photoUrl={professor.photo_url}
            s3PhotoUrl={professor.s3_photo_url}
            size={96}
            className="h-24 w-24 rounded-none object-cover shadow-sm border border-slate-200"
          />
          <div>
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

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="border border-slate-200 bg-slate-50 p-4">
            <p className="text-2xl font-extrabold text-lums-navy">
              {formatAvg(professor.avg_rating)}
            </p>
            <p className="text-xs opacity-60 uppercase font-semibold">Avg Rating</p>
          </div>
          <div className="border border-slate-200 bg-slate-50 p-4">
            <p className="text-2xl font-extrabold text-lums-navy">
              {formatAvg(professor.avg_difficulty)}
            </p>
            <p className="text-xs opacity-60 uppercase font-semibold">Avg Difficulty</p>
          </div>
          <div className="border border-slate-200 bg-slate-50 p-4">
            <p className="text-2xl font-extrabold text-lums-navy">
              {professor.would_take_again_pct === null
                ? "—"
                : `${Math.round(professor.would_take_again_pct)}%`}
            </p>
            <p className="text-xs opacity-60 uppercase font-semibold">Would Take Again</p>
          </div>
        </div>

        {session?.user ? (
          <ReviewForm professorId={professor.id} />
        ) : (
          <SignInBox />
        )}

        <div>
          <h2 className="text-xl font-extrabold text-lums-navy uppercase mb-1">Reviews</h2>
          <div className="w-14 h-1 bg-lums-gold mb-4" />
          <ul className="flex flex-col gap-3">
            {reviews.map((r) => (
              <li key={r.id} className="border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="font-bold text-lums-navy uppercase text-sm">
                      Anonymous
                    </span>
                    <p className="text-xs opacity-50">{timeAgo(r.created_at)}</p>
                  </div>
                  <StarRating value={r.rating} />
                </div>
                <div className="flex flex-wrap gap-x-3 text-xs opacity-60 mb-2">
                  {r.course && <span>Course: {r.course}</span>}
                  <span>Difficulty: {r.difficulty}/5</span>
                  <span>{r.would_take_again ? "Would take again" : "Would not take again"}</span>
                </div>
                <p className="text-sm">{r.comment}</p>
              </li>
            ))}
            {reviews.length === 0 && (
              <li className="text-center opacity-60 py-6">
                No reviews yet. Be the first to leave one.
              </li>
            )}
          </ul>
        </div>
      </main>
    </div>
  );
}
