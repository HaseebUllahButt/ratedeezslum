import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getProfessor, listRelatedProfessors, listReviewsForProfessor } from "@/lib/db";
import ReviewForm from "@/components/ReviewForm";
import SignInBox from "@/components/SignInBox";
import ReviewList from "@/components/ReviewList";
import Avatar from "@/components/Avatar";
import StarRating from "@/components/StarRating";
import ShareButton from "@/components/ShareButton";
import { reviewOwnerKey } from "@/lib/reviewOwnership";
import { breadcrumbJsonLd, graph, professorJsonLd, professorSummary } from "@/lib/seo";
import { SITE_NAME, jsonLdScript, professorPath } from "@/lib/site";
import { departmentSlug, schoolAbbreviation, schoolSlug } from "@/lib/taxonomy";

type Props = { params: Promise<{ id: string }> };

function formatAvg(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const professorId = Number(id);
  if (!Number.isInteger(professorId)) return { title: "Professor not found" };

  const professor = await getProfessor(professorId);
  if (!professor) return { title: "Professor not found" };

  const path = professorPath(professor.id);
  const role = [professor.title, professor.department, professor.school]
    .filter(Boolean)
    .join(", ");
  const rated =
    professor.review_count > 0 && professor.avg_rating !== null
      ? `Rated ${professor.avg_rating.toFixed(1)}/5 by ${professor.review_count} student${professor.review_count === 1 ? "" : "s"}. `
      : "No student ratings yet. ";
  const description =
    `${rated}Read anonymous LUMS student reviews of ${professor.name}` +
    `${role ? ` (${role})` : ""} and add your own rating on ${SITE_NAME}.`;
  const image = professor.s3_photo_url ?? professor.photo_url ?? undefined;

  return {
    title: `${professor.name} — LUMS Professor Ratings & Reviews`,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "profile",
      title: `${professor.name} — LUMS Ratings & Reviews`,
      description,
      url: path,
      siteName: SITE_NAME,
      ...(image ? { images: [{ url: image, alt: professor.name }] } : {}),
    },
    twitter: {
      card: image ? "summary" : "summary_large_image",
      title: `${professor.name} — LUMS Ratings & Reviews`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ProfessorPage({ params }: Props) {
  const { id } = await params;
  const professorId = Number(id);
  if (!Number.isInteger(professorId)) notFound();

  const professor = await getProfessor(professorId);
  if (!professor) notFound();

  const session = await auth();
  const ownerKey = session?.user?.email ? reviewOwnerKey(session.user.email) : undefined;
  const [reviews, related] = await Promise.all([
    listReviewsForProfessor(professorId, ownerKey),
    listRelatedProfessors(professorId, professor.department, professor.school),
  ]);

  const pageJsonLd = graph(
    professorJsonLd(professor, reviews),
    breadcrumbJsonLd([
      { name: "LUMS Faculty", path: "/" },
      ...(professor.school
        ? [
            {
              name: schoolAbbreviation(professor.school) ?? professor.school,
              path: `/school/${schoolSlug(professor.school)}`,
            },
          ]
        : []),
      { name: professor.name, path: professorPath(professor.id) },
    ])
  );

  return (
    <div className="flex flex-col flex-1 items-center bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(pageJsonLd) }}
      />
      <main
        id="main-content"
        className="flex flex-1 w-full max-w-2xl flex-col py-12 px-6 gap-8"
      >
        <nav aria-label="Breadcrumb" className="text-xs font-bold uppercase text-slate-500">
          <Link href="/" className="hover:text-lums-navy hover:underline">
            Faculty
          </Link>
          {professor.school && (
            <>
              <span className="mx-2" aria-hidden="true">/</span>
              <Link
                href={`/school/${schoolSlug(professor.school)}`}
                className="hover:text-lums-navy hover:underline"
              >
                {schoolAbbreviation(professor.school) ?? professor.school}
              </Link>
            </>
          )}
          <span className="mx-2" aria-hidden="true">/</span>
          <span className="text-lums-navy">{professor.name}</span>
        </nav>

        <div className="flex flex-col gap-4 pb-6 border-b border-slate-200 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-5">
            <Avatar
              name={professor.name}
              photoUrl={professor.photo_url}
              s3PhotoUrl={professor.s3_photo_url}
              size={96}
              priority
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

        {/* Plain-language summary: the sentence search and answer engines quote. */}
        <p className="text-sm leading-relaxed text-slate-600">
          {professorSummary(professor)}
        </p>

        {session?.user ? (
          reviews.some((review) => review.is_owner) ? (
            <p className="border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              You&apos;ve already reviewed this professor. You can edit your review below.
            </p>
          ) : (
            <ReviewForm professorId={professor.id} />
          )
        ) : (
          <SignInBox
            professorName={professor.name}
            isFirstReview={professor.review_count === 0}
          />
        )}

        <ReviewList reviews={reviews} />

        {related.length > 0 && (
          <section aria-labelledby="related-heading" className="border-t border-slate-200 pt-6">
            <h2
              id="related-heading"
              className="text-sm font-extrabold uppercase tracking-wide text-lums-navy"
            >
              Other {professor.department ?? professor.school} faculty
            </h2>
            <ul className="mt-3 flex flex-col gap-1">
              {related.map((other) => (
                <li key={other.id}>
                  <Link
                    href={`/professor/${other.id}`}
                    className="flex items-baseline justify-between gap-3 py-1 text-sm text-slate-700 hover:text-lums-navy hover:underline"
                  >
                    <span className="truncate">{other.name}</span>
                    <span className="flex-shrink-0 text-xs text-slate-500">
                      {other.review_count > 0
                        ? `${other.avg_rating?.toFixed(1)} / 5`
                        : "No reviews"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {professor.department && (
              <p className="mt-3 text-sm">
                <Link
                  href={`/department/${departmentSlug(professor.department)}`}
                  className="font-bold text-lums-navy hover:underline"
                >
                  All {professor.department} professors &rarr;
                </Link>
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
