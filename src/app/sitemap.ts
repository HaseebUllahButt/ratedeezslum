import type { MetadataRoute } from "next";
import { listProfessorsForSitemap, withRetry } from "@/lib/db";
import { absoluteUrl, professorPath } from "@/lib/site";

// Rebuilt hourly so new professors and fresh reviews reach crawlers without a deploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const professors = await withRetry(() => listProfessorsForSitemap());
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
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

  return [...staticRoutes, ...professorRoutes];
}
