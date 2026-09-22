/**
 * Single source of truth for anything that has to be identical across
 * metadata, JSON-LD, the sitemap, robots.txt and llms.txt.
 *
 * Set NEXT_PUBLIC_SITE_URL once a real domain is attached; until then the
 * Vercel production alias is the canonical host.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ratedeezslum.vercel.app"
).replace(/\/$/, "");

export const SITE_NAME = "RateDeezSlum";

export const SITE_TAGLINE = "LUMS Professor Ratings & Reviews";

export const SITE_DESCRIPTION =
  "Anonymous student ratings and reviews for LUMS faculty. Search 400+ professors " +
  "from SBASSE, SDSB, MGSHSS, SAHSOL and more, compare star ratings, and read honest " +
  "course feedback before you register.";

/** Absolute URL for a path. JSON-LD and OG tags both require absolute URLs. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function professorPath(id: number | string): string {
  return `/professor/${id}`;
}

/**
 * Escapes a JSON-LD payload for inline <script> embedding. Review comments are
 * user-submitted, so `</script>` in a comment would otherwise break out of the tag.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
