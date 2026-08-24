import Link from "next/link";

export const metadata = {
  title: "About - RateDeezLums",
};

export default function AboutPage() {
  return (
    <div className="flex flex-col flex-1 items-center bg-white">
      <main className="flex flex-1 w-full max-w-2xl flex-col py-16 px-6 gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-lums-navy uppercase tracking-tight">
            About
          </h1>
          <div className="w-16 h-1 bg-lums-gold mx-auto mt-3" />
        </div>

        <div className="flex flex-col gap-4 text-sm sm:text-base leading-relaxed text-slate-700">
          <p>
            RateDeezLums is a community-run platform for LUMS students to
            anonymously rate and review faculty. The goal is simple: help
            students make informed decisions about which courses and
            instructors to pick, based on honest feedback from people who
            have actually taken their classes.
          </p>
          <p>
            The faculty directory is pulled from LUMS&apos;s own public
            faculty listing. Ratings, difficulty scores, and comments are
            submitted entirely by students and reflect individual opinions,
            not the views of RateDeezLums, LUMS, or any affiliated party.
          </p>
          <p>
            RateDeezLums is an independent, unofficial project and is{" "}
            <strong>not affiliated with or endorsed by LUMS</strong> in any
            way.
          </p>
        </div>

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
