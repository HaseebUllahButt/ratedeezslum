"use client";

import { signIn } from "next-auth/react";

export default function SignInBox() {
  return (
    <div className="flex flex-col items-center gap-4 bg-lums-gray border-t-4 border-lums-gold p-8 text-center">
      <p className="text-sm font-medium text-lums-navy">
        Please sign in with your LUMS account to leave a review
      </p>
      <button
        onClick={() => signIn("microsoft-entra-id")}
        className="rounded-none bg-lums-gold text-lums-navy px-5 py-2.5 font-bold uppercase text-sm hover:bg-lums-gold-dark transition-colors"
      >
        Sign In
      </button>
    </div>
  );
}
