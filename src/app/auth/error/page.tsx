import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const accessDenied = error === "AccessDenied";

  return (
    <main className="flex flex-1 items-center justify-center bg-white px-6 py-16">
      <section className="w-full max-w-lg border-t-4 border-lums-gold bg-lums-gray p-8 text-center">
        <h1 className="text-2xl font-extrabold uppercase text-lums-navy">
          {accessDenied ? "LUMS account required" : "Sign-in could not be completed"}
        </h1>
        <p className="mt-3 text-sm text-lums-navy/80">
          {accessDenied
            ? "Only Microsoft accounts ending in @lums.edu.pk can submit reviews. You can still browse all faculty and reviews without signing in."
            : "Microsoft sign-in was not completed. Please try again."}
        </p>
        <div className="mt-6 flex justify-center gap-4 text-sm font-bold uppercase">
          <Link href="/" className="bg-lums-gold px-5 py-2.5 text-lums-navy hover:bg-lums-gold-dark">
            Back to faculty
          </Link>
          <Link href="/" className="px-5 py-2.5 text-lums-navy underline">
            Try again
          </Link>
        </div>
      </section>
    </main>
  );
}
