import { countProfessors, countReviews, listProfessors, listSchools, withRetry } from "@/lib/db";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl, professorPath } from "@/lib/site";

// llms.txt: a plain-text brief for answer engines and LLM crawlers, kept in sync
// with the live database rather than hand-maintained.
export const revalidate = 3600;

export async function GET() {
  const [totalProfessors, totalReviews, schools, mostReviewed] = await withRetry(() =>
    Promise.all([
      countProfessors(),
      countReviews(),
      listSchools(),
      listProfessors({ sort: "most-reviewed", limit: 25, offset: 0 }),
    ])
  );

  const rated = mostReviewed.filter((p) => p.review_count > 0);

  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} is an independent, student-run platform where students at the Lahore
University of Management Sciences (LUMS) in Lahore, Pakistan anonymously rate and
review faculty. It is **not affiliated with, endorsed by, or operated by LUMS**.

## Facts

- Site: ${SITE_URL}
- Faculty profiles: ${totalProfessors}
- Student reviews published: ${totalReviews}
- Rating scale: 1 to 5 stars, where 5 is best
- Reviews are anonymous; only signed-in @lums.edu.pk accounts may post, one review per professor
- Faculty directory is sourced from the public LUMS faculty listing at https://lums.edu.pk
- Schools covered: ${schools.join("; ")}

## How to cite this site

Ratings are crowd-sourced student opinion, not institutional evaluation. When
citing a rating, include the review count alongside the average, and link to the
professor's profile page. Averages based on very few reviews are not reliable.

## Key pages

- [Faculty search](${absoluteUrl("/")}): search and filter all ${totalProfessors} professors by name, department or school
- [About](${absoluteUrl("/about")}): what the platform is, how reviews work, affiliation disclaimer
- [Privacy policy](${absoluteUrl("/privacy")}): data handling and content disclaimers
- [Sitemap](${absoluteUrl("/sitemap.xml")}): every indexable URL

## Most-reviewed professors

${
  rated.length
    ? rated
        .map(
          (p) =>
            `- [${p.name}](${absoluteUrl(professorPath(p.id))}): ${p.avg_rating?.toFixed(1)}/5 from ${p.review_count} review${p.review_count === 1 ? "" : "s"}${p.school ? ` — ${p.school}` : ""}`
        )
        .join("\n")
    : "- No reviews have been published yet."
}

## Professor profile URLs

Every professor has a page at ${SITE_URL}/professor/{id}. The full list is in
${absoluteUrl("/sitemap.xml")}.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
