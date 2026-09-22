import type { Metadata } from "next";
import Link from "next/link";
import {
  listAllProfessorsBrief,
  listDepartments,
  listSchools,
  listProfessorsBySchool,
  withRetry,
} from "@/lib/db";
import { breadcrumbJsonLd, graph } from "@/lib/seo";
import { SITE_NAME, jsonLdScript } from "@/lib/site";
import { departmentSlug, schoolAbbreviation, schoolSlug } from "@/lib/taxonomy";

export const revalidate = 3600;

const description =
  "Complete A-Z directory of every LUMS professor, plus faculty listings by school " +
  "(SBASSE, SDSB, MGSHSS, SAHSOL, SOE) and by department.";

export const metadata: Metadata = {
  title: "All LUMS Faculty — Complete Directory",
  description,
  alternates: { canonical: "/faculty" },
  openGraph: { url: "/faculty", title: "All LUMS Faculty", description },
  twitter: { title: "All LUMS Faculty", description },
};

/** Groups the directory by first letter so 400+ links stay scannable. */
function groupByInitial(professors: { id: number; name: string }[]) {
  const groups = new Map<string, { id: number; name: string }[]>();
  for (const professor of professors) {
    // Names are stored with honorifics ("Dr. Aaminah"), so index on the
    // first letter of the actual name rather than the title.
    const stripped = professor.name.replace(/^(Dr|Prof|Mr|Ms|Mrs)\.?\s+/i, "").trim();
    const initial = (stripped[0] ?? professor.name[0] ?? "#").toUpperCase();
    const key = /[A-Z]/.test(initial) ? initial : "#";
    const bucket = groups.get(key);
    if (bucket) bucket.push(professor);
    else groups.set(key, [professor]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export default async function FacultyIndexPage() {
  const [professors, schools, departments] = await withRetry(() =>
    Promise.all([listAllProfessorsBrief(), listSchools(), listDepartments()])
  );

  const schoolCounts = await withRetry(() =>
    Promise.all(
      schools.map(async (school) => ({
        school,
        count: (await listProfessorsBySchool(school)).length,
      }))
    )
  );

  const grouped = groupByInitial(professors);

  const pageJsonLd = graph(
    breadcrumbJsonLd([
      { name: "LUMS Faculty", path: "/" },
      { name: "All Faculty", path: "/faculty" },
    ])
  );

  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(pageJsonLd) }}
      />
      <main id="main-content" className="w-full max-w-5xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-lums-navy sm:text-3xl">
          All LUMS Faculty
        </h1>
        <div className="mt-3 h-1 w-16 bg-lums-gold" />
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-600">
          Every one of the {professors.length} faculty members listed on {SITE_NAME}, browsable
          by school, by department, or alphabetically.
        </p>

        <section aria-labelledby="schools-heading" className="mt-10">
          <h2
            id="schools-heading"
            className="text-lg font-extrabold uppercase tracking-wide text-lums-navy"
          >
            By school
          </h2>
          <div className="mt-1 h-0.5 w-10 bg-lums-gold" />
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {schoolCounts.map(({ school, count }) => {
              const abbr = schoolAbbreviation(school);
              return (
                <li key={school}>
                  <Link
                    href={`/school/${schoolSlug(school)}`}
                    className="flex h-full items-baseline justify-between gap-3 border border-slate-200 p-4 transition-colors hover:border-lums-navy"
                  >
                    <span className="min-w-0">
                      {abbr && (
                        <span className="block text-sm font-bold uppercase text-lums-navy">
                          {abbr}
                        </span>
                      )}
                      <span className="block text-xs text-slate-600">{school}</span>
                    </span>
                    <span className="flex-shrink-0 text-xs font-bold text-slate-500">
                      {count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="departments-heading" className="mt-10">
          <h2
            id="departments-heading"
            className="text-lg font-extrabold uppercase tracking-wide text-lums-navy"
          >
            By department
          </h2>
          <div className="mt-1 h-0.5 w-10 bg-lums-gold" />
          <ul className="mt-4 flex flex-wrap gap-2">
            {departments.map((department) => (
              <li key={department}>
                <Link
                  href={`/department/${departmentSlug(department)}`}
                  className="inline-block border border-slate-200 px-3 py-1.5 text-xs font-medium text-lums-navy transition-colors hover:border-lums-navy hover:bg-lums-gray"
                >
                  {department}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="az-heading" className="mt-12">
          <h2
            id="az-heading"
            className="text-lg font-extrabold uppercase tracking-wide text-lums-navy"
          >
            A–Z directory
          </h2>
          <div className="mt-1 h-0.5 w-10 bg-lums-gold" />

          <div className="mt-6 flex flex-col gap-7">
            {grouped.map(([initial, people]) => (
              <div key={initial}>
                <h3 className="border-b border-slate-200 pb-1 text-sm font-extrabold text-lums-navy">
                  {initial}
                </h3>
                <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                  {people.map((professor) => (
                    <li key={professor.id}>
                      <Link
                        href={`/professor/${professor.id}`}
                        className="block truncate py-0.5 text-sm text-slate-700 hover:text-lums-navy hover:underline"
                      >
                        {professor.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
