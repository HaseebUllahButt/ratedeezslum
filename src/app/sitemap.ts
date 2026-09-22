import type { MetadataRoute } from "next";
import { listDepartments, listProfessorsForSitemap, listSchools, withRetry } from "@/lib/db";
import { departmentSlug, schoolSlug } from "@/lib/taxonomy";
import { absoluteUrl, professorPath } from "@/lib/site";

// Rebuilt hourly so new professors and fresh reviews reach crawlers without a deploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [professors, schools, departments] = await withRetry(() =>
    Promise.all([listProfessorsForSitemap(), listSchools(), listDepartments()])
  );
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/faculty"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/about"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const professorRoutes: MetadataRoute.Sitemap = professors.map((professor) => ({
    url: absoluteUrl(professorPath(professor.id)),
    lastModified: professor.last_review_at ? new Date(professor.last_review_at) : now,
    // Reviewed profiles change when students post; unreviewed ones rarely do.
    changeFrequency: professor.last_review_at ? "weekly" : "monthly",
    priority: professor.last_review_at ? 0.8 : 0.6,
  }));

  const hubRoutes: MetadataRoute.Sitemap = [
    ...schools.map((school) => ({
      url: absoluteUrl(`/school/${schoolSlug(school)}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...departments.map((department) => ({
      url: absoluteUrl(`/department/${departmentSlug(department)}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  return [...staticRoutes, ...hubRoutes, ...professorRoutes];
}
