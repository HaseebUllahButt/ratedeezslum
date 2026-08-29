"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInBox() {
  const [signingIn, setSigningIn] = useState(false);

  async function handleSignIn() {
    setSigningIn(true);
    try {
      await signIn("microsoft-entra-id", undefined, { prompt: "select_account" });
    } catch {
      setSigningIn(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 bg-lums-gray border-t-4 border-lums-gold p-8 text-center">
      <p className="text-sm font-medium text-lums-navy">
        Please sign in with your LUMS account to leave a review
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
        {signingIn ? "Signing in..." : "Sign In"}
      </button>
    </div>
  );
}
