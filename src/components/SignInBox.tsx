"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInBox({
  professorName,
  isFirstReview = false,
}: {
  professorName?: string;
  /** No reviews yet - being first is the strongest thing we can offer. */
  isFirstReview?: boolean;
}) {
  const [signingIn, setSigningIn] = useState(false);

  async function handleSignIn() {
    setSigningIn(true);
    try {
      await signIn("microsoft-entra-id", undefined, { prompt: "select_account" });
    } catch {
      setSigningIn(false);
    }
  }

  const heading = professorName
    ? isFirstReview
      ? `Be the first to review ${professorName}`
      : `Rate ${professorName}`
    : "Leave a review";

  return (
    <div className="flex flex-col items-center gap-3 bg-lums-gray border-t-4 border-lums-gold p-8 text-center">
      <p className="text-base font-bold uppercase tracking-wide text-lums-navy">{heading}</p>

      {/* Fear of being identified is the main reason students don't post - lead with it. */}
      <p className="max-w-sm text-sm text-slate-700">
        Your review is <strong>completely anonymous</strong>. Your name and email are never
        shown with it — signing in only confirms you study at LUMS.
      </p>

      <button
        type="button"
        onClick={handleSignIn}
        disabled={signingIn}
        aria-busy={signingIn}
        className="inline-flex items-center gap-2 rounded-none bg-lums-gold text-lums-navy px-5 py-2.5 font-bold uppercase text-sm hover:bg-lums-gold-dark transition-colors disabled:cursor-wait disabled:opacity-80"
      >
        {signingIn && (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-lums-navy/30 border-t-lums-navy motion-reduce:animate-none"
          />
        )}
        {signingIn ? "Signing in..." : "Sign in to review"}
      </button>

      <p className="text-xs text-slate-500">Requires a LUMS account (@lums.edu.pk)</p>
    </div>
  );
}
