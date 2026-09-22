import type { ProfessorWithStats, Review } from "@/lib/db";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl, professorPath } from "@/lib/site";

const LUMS_ORG = {
  "@type": "CollegeOrUniversity",
  name: "Lahore University of Management Sciences",
  alternateName: "LUMS",
  url: "https://lums.edu.pk",
} as const;

/** Publisher/brand node, referenced by @id from the other graphs. */
export function organizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/slum-logo.svg"),
    },
    // Stated explicitly so answer engines never present this as an official LUMS site.
    disambiguatingDescription:
      "An independent, student-run review platform. Not affiliated with, endorsed by, or operated by LUMS.",
  };
}

export function websiteJsonLd() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: "en",
    publisher: { "@id": `${SITE_URL}/#organization` },
    // No SearchAction: faculty search is client-side with no URL query param,
    // so a search URL template would point at a page that does not filter.
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl("/about")}#faq`,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

/**
 * ProfilePage + Person graph for a single professor. Review bodies are included
 * so answer engines can cite the actual student feedback rather than guessing
 * from the page title.
 */
export function professorJsonLd(professor: ProfessorWithStats, reviews: Review[]) {
  const url = absoluteUrl(professorPath(professor.id));
  const image = professor.s3_photo_url ?? professor.photo_url ?? undefined;
  const hasRating = professor.review_count > 0 && professor.avg_rating !== null;

  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": `${url}#person`,
    name: professor.name,
    url,
    ...(professor.title ? { jobTitle: professor.title } : {}),
    ...(image ? { image } : {}),
    worksFor: professor.school
      ? { ...LUMS_ORG, department: { "@type": "Organization", name: professor.school } }
      : LUMS_ORG,
    ...(professor.department ? { knowsAbout: professor.department } : {}),
    ...(professor.profile_url ? { sameAs: [professor.profile_url] } : {}),
  };

  if (hasRating) {
    person.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(professor.avg_rating!.toFixed(2)),
      reviewCount: professor.review_count,
      bestRating: 5,
      worstRating: 1,
    };
    person.review = reviews.slice(0, 20).map((review) => ({
      "@type": "Review",
      datePublished: new Date(review.created_at).toISOString(),
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { "@type": "Person", name: "Anonymous LUMS student" },
      ...(review.comment?.trim() ? { reviewBody: review.comment.trim() } : {}),
    }));
  }

  return {
    "@type": "ProfilePage",
    "@id": `${url}#profilepage`,
    url,
    name: `${professor.name} — LUMS ratings and reviews`,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    inLanguage: "en",
    mainEntity: person,
  };
}

/** Wraps nodes in a single @graph so one <script> carries the whole page. */
export function graph(...nodes: unknown[]) {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/** "a" vs "an" — titles like "Assistant Professor" and "Instructor" both occur. */
function article(word: string): string {
  return /^[aeiou]/i.test(word.trim()) ? "an" : "a";
}

/**
 * One-sentence, extractable summary. Answer engines quote a leading sentence
 * far more reliably than they synthesise one from scattered UI numbers.
 */
export function professorSummary(professor: ProfessorWithStats): string {
  const role = [professor.title, professor.department].filter(Boolean).join(", ");
  const where = professor.school ? ` at ${professor.school}, LUMS` : " at LUMS";
  const who = `${professor.name} is ${role ? `${article(role)} ${role}` : "a faculty member"}${where}.`;

  if (professor.review_count > 0 && professor.avg_rating !== null) {
    return (
      `${who} Students rate ${professor.name} ${professor.avg_rating.toFixed(1)} out of 5 ` +
      `based on ${professor.review_count} anonymous review${professor.review_count === 1 ? "" : "s"} on ${SITE_NAME}.`
    );
  }
  return `${who} No student reviews have been submitted for ${professor.name} on ${SITE_NAME} yet.`;
}
