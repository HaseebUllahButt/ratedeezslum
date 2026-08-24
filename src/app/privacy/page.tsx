export const metadata = {
  title: "Privacy Policy - RateDeezLums",
};

export default function PrivacyPage() {
  return (
    <div className="flex flex-col flex-1 items-center bg-white">
      <main className="flex flex-1 w-full max-w-2xl flex-col py-16 px-6 gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-lums-navy uppercase tracking-tight">
            Privacy Policy
          </h1>
          <div className="w-16 h-1 bg-lums-gold mx-auto mt-3" />
          <p className="text-sm text-slate-500 mt-4">Last updated: 24th August, 2026</p>
        </div>

        <div className="border border-slate-200 bg-slate-50 p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-lums-navy uppercase">
              Platform Disclaimer
            </h2>
            <div className="w-10 h-0.5 bg-lums-gold mt-1.5" />
          </div>
          <p className="text-sm text-slate-700">
            <strong>Important:</strong> RateDeezLums is a platform that connects
            students with reviews. We do not:
          </p>
          <ul className="list-disc list-inside text-sm text-slate-700 flex flex-col gap-1.5">
            <li>Create, edit, or verify the accuracy of reviews</li>
            <li>Take responsibility for the content of reviews posted by users</li>
            <li>Endorse or guarantee the truthfulness of any review</li>
            <li>Control what users post on our platform</li>
          </ul>
          <p className="text-sm text-slate-700">
            All reviews are the opinions of individual users.{" "}
            <strong>
              We are not responsible for any claims, statements, or content in
              reviews.
            </strong>
          </p>
        </div>

        <div className="flex flex-col gap-3 text-sm sm:text-base leading-relaxed text-slate-700">
          <h2 className="text-lg font-extrabold text-lums-navy uppercase mt-2">
            What we collect
          </h2>
          <p>
            To submit a review, we ask for a LUMS email address purely to check
            that it&apos;s formatted like a real LUMS address. That email is{" "}
            <strong>never stored, logged, or displayed</strong> — it exists only
            for the moment of that request and is discarded immediately after.
            Reviews are stored with no identifying information tying them back
            to any individual.
          </p>

          <h2 className="text-lg font-extrabold text-lums-navy uppercase mt-2">
            What we store
          </h2>
          <p>
            We store the professor being reviewed, the course (if provided),
            your rating, difficulty score, whether you&apos;d take the class
            again, and your written comment. None of this is linked to your
            identity.
          </p>

          <h2 className="text-lg font-extrabold text-lums-navy uppercase mt-2">
            Faculty directory data
          </h2>
          <p>
            Professor names, titles, departments, schools, and photos are
            sourced from LUMS&apos;s own public faculty directory. If you are
            a faculty member and would like your listing corrected or removed,
            please get in touch.
          </p>
        </div>
      </main>
    </div>
  );
}
