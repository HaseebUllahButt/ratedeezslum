import type { Metadata } from "next";
import Link from "next/link";
import { countProfessors, countReviews } from "@/lib/db";
import { breadcrumbJsonLd, faqJsonLd, graph } from "@/lib/seo";
import { SITE_NAME, jsonLdScript } from "@/lib/site";

export const revalidate = 3600;

const description =
  `What ${SITE_NAME} is, who runs it, how anonymous LUMS faculty reviews work, ` +
  `who can post one, and why the site is not affiliated with LUMS.`;

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
  openGraph: { url: "/about", title: `About ${SITE_NAME}`, description },
  twitter: { title: `About ${SITE_NAME}`, description },
};

/**
 * Questions students actually ask, answered in full sentences. These are the
 * source for both the visible FAQ and the FAQPage structured data, so the two
 * can never drift apart.
 */
function buildFaqs(totalProfessors: number, totalReviews: number) {
  return [
    {
      question: `What is ${SITE_NAME}?`,
      answer:
        `${SITE_NAME} is a free, independent platform where students at the Lahore University ` +
        `of Management Sciences (LUMS) anonymously rate and review faculty. It lists ` +
        `${totalProfessors} professors` +
        (totalReviews > 0
          ? ` and ${totalReviews} student review${totalReviews === 1 ? "" : "s"}, so students can `
          : ` and is open for reviews, so students can `) +
        `compare instructors before choosing courses.`,
    },
    {
      question: "Is RateDeezSlum affiliated with LUMS?",
      answer:
        `No. ${SITE_NAME} is an independent, student-run project. It is not affiliated with, ` +
        `endorsed by, or operated by LUMS. The faculty directory is compiled from the public ` +
        `LUMS faculty listing, but all ratings and comments come from students.`,
    },
    {
      question: "Who can post a review?",
      answer:
        "Only signed-in students with a LUMS Microsoft account ending in @lums.edu.pk can post " +
        "a review. Anyone can read ratings and reviews without signing in.",
    },
    {
      question: "Are reviews anonymous?",
      answer:
        "Yes. Your name and email are never shown with your review. Sign-in is used only to " +
        "confirm you are a LUMS student and to limit each account to one review per professor, " +
        "which keeps ratings from being skewed by repeat submissions.",
    },
    {
      question: "How are professor ratings calculated?",
      answer:
        "Each review carries a rating from 1 to 5 stars, where 5 is best. A professor's score " +
        "is the plain average of all their reviews, shown to one decimal place alongside the " +
        "number of reviews it is based on. Averages drawn from only one or two reviews are not " +
        "a reliable signal.",
    },
    {
      question: "Can I edit or delete my review?",
      answer:
        "Yes. Sign in with the same LUMS account and open the professor's page — your own review " +
        "appears with options to edit or delete it.",
    },
    {
      question: "How do I get a review or a professor removed?",
      answer:
        `${SITE_NAME} does not write or verify reviews; they are the opinions of individual ` +
        `students. If a review is defamatory or a profile should not be listed, the request is ` +
        `handled through the contact route described in the Privacy Policy.`,
    },
  ];
}

export default async function AboutPage() {
  const [totalProfessors, totalReviews] = await Promise.all([
    countProfessors(),
    countReviews(),
  ]);
  const faqs = buildFaqs(totalProfessors, totalReviews);

  const pageJsonLd = graph(
    faqJsonLd(faqs),
    breadcrumbJsonLd([
      { name: "LUMS Faculty", path: "/" },
      { name: "About", path: "/about" },
    ])
  );

  return (
    <div className="flex flex-col flex-1 items-center bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(pageJsonLd) }}
      />
      <main
        id="main-content"
        className="flex flex-1 w-full max-w-2xl flex-col py-16 px-6 gap-6"
      >
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-lums-navy uppercase tracking-tight">
            About {SITE_NAME}
          </h1>
          <div className="w-16 h-1 bg-lums-gold mx-auto mt-3" />
        </div>

        <div className="flex flex-col gap-4 text-sm sm:text-base leading-relaxed text-slate-700">
          <p>
            {SITE_NAME} is a community-run platform for LUMS students to
            anonymously rate and review faculty. The goal is simple: help
            students make informed decisions about which courses and
            instructors to pick, based on honest feedback from people who
            have actually taken their classes.
          </p>
          <p>
            The faculty directory is pulled from LUMS&apos;s own public
            faculty listing and currently covers{" "}
            {totalProfessors.toLocaleString()} professors
            {totalReviews > 0
              ? ` with ${totalReviews.toLocaleString()} student review${totalReviews === 1 ? "" : "s"}`
              : ""}
            . Ratings and comments are submitted entirely by students and
            reflect individual opinions, not the views of {SITE_NAME}, LUMS, or
            any affiliated party.
          </p>
          <p>
            {SITE_NAME} is an independent, unofficial project and is{" "}
            <strong>not affiliated with or endorsed by LUMS</strong> in any
            way.
          </p>
        </div>

        <section aria-labelledby="faq-heading" className="mt-6 flex flex-col gap-5">
          <div>
            <h2
              id="faq-heading"
              className="text-2xl font-extrabold text-lums-navy uppercase tracking-tight"
            >
              Frequently asked questions
            </h2>
            <div className="w-12 h-1 bg-lums-gold mt-2" />
          </div>

          <dl className="flex flex-col gap-5">
            {faqs.map((faq) => (
              <div key={faq.question} className="border-l-2 border-slate-200 pl-4">
                <dt className="text-base font-bold text-lums-navy">{faq.question}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-slate-700">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="text-sm text-center">
          Have questions about how reviews work?{" "}
          <Link href="/privacy" className="text-lums-navy font-medium hover:underline">
            Read our Privacy Policy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
