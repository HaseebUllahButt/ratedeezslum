import { listProfessors, countProfessors, countReviews, listSchools } from "@/lib/db";
import ProfessorList from "@/components/ProfessorList";

export const revalidate = 60; // cache SSR for 60s to protect Neon

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
      <main className="bg-white flex-grow">
        <section className="bg-white pt-16 sm:pt-20 pb-8 sm:pb-10">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <blockquote className="text-center">
              <p className="text-sm sm:text-lg md:text-xl lg:text-2xl text-lums-navy leading-relaxed font-medium mb-4">
                &ldquo;Jeray ithay peray oh lhore wi peray&rdquo;
              </p>
              <div className="w-16 h-0.5 bg-lums-gold mx-auto mb-4" />
              <p className="text-base text-lums-navy font-medium">- Allama Iqbal</p>
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
