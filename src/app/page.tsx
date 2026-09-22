import type { Metadata } from "next";
import { listProfessors, countProfessors, countReviews, listSchools } from "@/lib/db";
import ProfessorList from "@/components/ProfessorList";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const revalidate = 60; // cache SSR for 60s to protect Neon

export async function generateMetadata(): Promise<Metadata> {
  const [totalProfessors, totalReviews] = await Promise.all([
    countProfessors(),
    countReviews(),
  ]);
  // Before the first reviews land, "read 0 reviews" is a bad snippet - invite instead.
  const description = totalReviews
    ? `Search ${totalProfessors} LUMS professors and read ${totalReviews} anonymous student ` +
      `reviews. Compare star ratings by school and department — SBASSE, SDSB, MGSHSS, SAHSOL — ` +
      `before you pick your courses.`
    : `Search all ${totalProfessors} LUMS professors across SBASSE, SDSB, MGSHSS and SAHSOL. ` +
      `Rate your instructors anonymously with your LUMS account and help other students pick ` +
      `their courses.`;

  return {
    title: {
      absolute: `${SITE_NAME} — ${SITE_TAGLINE}`,
    },
    description,
    alternates: { canonical: "/" },
    openGraph: { url: "/", title: `${SITE_NAME} — ${SITE_TAGLINE}`, description },
    twitter: { title: `${SITE_NAME} — ${SITE_TAGLINE}`, description },
  };
}

export default async function Home() {
  const [professors, totalProfessors, totalReviews, schools] = await Promise.all([
    listProfessors({ sort: "highest", limit: 24, offset: 0 }),
    countProfessors(),
    countReviews(),
    listSchools(),
  ]);
  const initialHasMore = professors.length < totalProfessors;

  return (
    <div className="flex flex-col flex-1 bg-white">
      <main id="main-content" className="bg-white flex-grow">
        <section className="bg-white pt-12 sm:pt-16 pb-8 sm:pb-10">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-lums-navy uppercase tracking-tight">
              LUMS Professor Ratings &amp; Reviews
            </h1>
            <div className="w-16 h-1 bg-lums-gold mx-auto mt-3 mb-5" />
            {/* Answer-shaped intro: states what the site is, for whom, at what scale. */}
            <p className="mx-auto max-w-2xl text-sm sm:text-base leading-relaxed text-slate-600">
              {SITE_NAME} collects anonymous student ratings for{" "}
              {totalProfessors.toLocaleString()} faculty members at the Lahore University of
              Management Sciences.{" "}
              {totalReviews > 0 ? (
                <>
                  Browse {totalReviews.toLocaleString()} student review
                  {totalReviews === 1 ? "" : "s"}, compare professors within a school or
                  department, and add your own rating with your LUMS account.
                </>
              ) : (
                <>
                  No reviews have been posted yet — sign in with your LUMS account to be the
                  first to rate an instructor.
                </>
              )}
            </p>

            <blockquote className="mt-10">
              <p className="text-sm sm:text-lg md:text-xl lg:text-2xl text-lums-navy leading-relaxed font-medium mb-4">
                &ldquo;Jeray ithay peray oh lhore wi peray&rdquo;
              </p>
              <div className="w-16 h-0.5 bg-lums-gold mx-auto mb-4" />
              <footer className="text-base text-lums-navy font-medium">
                <cite className="not-italic">- Allama Iqbal</cite>
              </footer>
            </blockquote>
          </div>
        </section>

        <section id="search-section" className="mx-auto max-w-6xl px-4 pt-4 pb-12 sm:px-6">
          <div className="bg-white">
            <div className="mb-8">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-lums-navy uppercase tracking-wide flex-shrink min-w-0">
                  Search Faculty
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 bg-lums-gold text-lums-navy text-xs sm:text-sm font-bold uppercase tracking-wide whitespace-nowrap flex-shrink-0">
                  {totalReviews.toLocaleString()} {totalReviews === 1 ? "Review" : "Reviews"}
                </span>
              </div>
              <div className="w-12 h-1 bg-lums-gold mt-2" />
            </div>

            <ProfessorList
              initialProfessors={professors}
              totalProfessors={totalProfessors}
              initialHasMore={initialHasMore}
              schools={schools}
              initialSort="highest"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
