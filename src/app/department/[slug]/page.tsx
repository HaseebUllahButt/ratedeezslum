import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listDepartments, listProfessorsByDepartment, withRetry } from "@/lib/db";
import ProfessorGrid from "@/components/ProfessorGrid";
import { breadcrumbJsonLd, graph } from "@/lib/seo";
import { SITE_NAME, jsonLdScript } from "@/lib/site";
import { departmentSlug, matchSlug } from "@/lib/taxonomy";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

async function resolveDepartment(slug: string): Promise<string | undefined> {
  const departments = await withRetry(() => listDepartments());
  return matchSlug(slug, departments, departmentSlug);
}

export async function generateStaticParams() {
  const departments = await listDepartments();
  return departments.map((department) => ({ slug: departmentSlug(department) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const department = await resolveDepartment(slug);
  if (!department) return { title: "Department not found" };

  const professors = await listProfessorsByDepartment(department);
  const description =
    `All ${professors.length} ${department} professors at LUMS, with anonymous student ` +
    `ratings and reviews. Compare instructors before you register on ${SITE_NAME}.`;

  return {
    title: `LUMS ${department} Professors — Ratings & Reviews`,
    description,
    alternates: { canonical: `/department/${slug}` },
    openGraph: { url: `/department/${slug}`, title: `LUMS ${department} Professors`, description },
    twitter: { title: `LUMS ${department} Professors`, description },
  };
}

export default async function DepartmentPage({ params }: Props) {
  const { slug } = await params;
  const department = await resolveDepartment(slug);
  if (!department) notFound();

  const professors = await withRetry(() => listProfessorsByDepartment(department));
  const school = professors.find((p) => p.school)?.school ?? null;

  const pageJsonLd = graph(
    breadcrumbJsonLd([
      { name: "LUMS Faculty", path: "/" },
      { name: "Departments", path: "/faculty" },
      { name: department, path: `/department/${slug}` },
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
            Departments
          </Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span className="text-lums-navy">{department}</span>
        </nav>

        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-lums-navy sm:text-3xl">
          {department} at LUMS
        </h1>
        <div className="mt-3 h-1 w-16 bg-lums-gold" />

        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-600">
          {professors.length} faculty members teaching {department} at the Lahore University
          of Management Sciences
          {school ? `, part of ${school}` : ""}. Ratings come from anonymous LUMS student
          reviews.
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
