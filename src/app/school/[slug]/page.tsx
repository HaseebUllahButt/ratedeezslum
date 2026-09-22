import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listSchools, listProfessorsBySchool, withRetry } from "@/lib/db";
import ProfessorGrid from "@/components/ProfessorGrid";
import { breadcrumbJsonLd, graph } from "@/lib/seo";
import { SITE_NAME, jsonLdScript } from "@/lib/site";
import { matchSlug, schoolAbbreviation, schoolSlug } from "@/lib/taxonomy";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

async function resolveSchool(slug: string): Promise<string | undefined> {
  const schools = await withRetry(() => listSchools());
  return matchSlug(slug, schools, schoolSlug);
}

export async function generateStaticParams() {
  const schools = await listSchools();
  return schools.map((school) => ({ slug: schoolSlug(school) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const school = await resolveSchool(slug);
  if (!school) return { title: "School not found" };

  const abbr = schoolAbbreviation(school);
  const professors = await listProfessorsBySchool(school);
  const label = abbr ? `${abbr} (${school})` : school;
  const description =
    `Browse and rate all ${professors.length} faculty members at ${label}, LUMS. ` +
    `Anonymous student reviews and star ratings on ${SITE_NAME}.`;

  return {
    title: `${abbr ?? school} Faculty — LUMS Professor Ratings`,
    description,
    alternates: { canonical: `/school/${slug}` },
    openGraph: { url: `/school/${slug}`, title: `${abbr ?? school} Faculty`, description },
    twitter: { title: `${abbr ?? school} Faculty`, description },
  };
}

export default async function SchoolPage({ params }: Props) {
  const { slug } = await params;
  const school = await resolveSchool(slug);
  if (!school) notFound();

  const professors = await withRetry(() => listProfessorsBySchool(school));
  const abbr = schoolAbbreviation(school);
  const reviewed = professors.filter((p) => p.review_count > 0).length;

  const pageJsonLd = graph(
    breadcrumbJsonLd([
      { name: "LUMS Faculty", path: "/" },
      { name: "Schools", path: "/faculty" },
      { name: abbr ?? school, path: `/school/${slug}` },
    ])
  );

  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(pageJsonLd) }}
      />
      <main id="main-content" className="w-full max-w-5xl flex-1 px-6 py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs font-bold uppercase text-slate-500">
          <Link href="/" className="hover:text-lums-navy hover:underline">
            Faculty
          </Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <Link href="/faculty" className="hover:text-lums-navy hover:underline">
            Schools
          </Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span className="text-lums-navy">{abbr ?? school}</span>
        </nav>

        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-lums-navy sm:text-3xl">
          {school}
        </h1>
        <div className="mt-3 h-1 w-16 bg-lums-gold" />

        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-600">
          {abbr ? `${abbr} — ` : ""}
          {professors.length} faculty members at {school}, Lahore University of Management
          Sciences.{" "}
          {reviewed > 0
            ? `${reviewed} have student reviews so far.`
            : "No student reviews have been posted for this school yet — sign in with your LUMS account to be the first."}
        </p>

        <div className="mt-8">
          <ProfessorGrid professors={professors} />
        </div>

        <p className="mt-10 text-sm">
          <Link href="/faculty" className="font-bold text-lums-navy hover:underline">
            &larr; All LUMS schools and departments
          </Link>
        </p>
      </main>
    </div>
  );
}
