import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

const LUMS_DOMAIN = "@lums.edu.pk";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [MicrosoftEntraID],
  callbacks: {
    signIn({ profile }) {
      const email = profile?.email ?? (profile as { preferred_username?: string } | undefined)?.preferred_username;
      return typeof email === "string" && email.toLowerCase().endsWith(LUMS_DOMAIN);
    },
    session({ session }) {
      return session;
    },
  },
  pages: {
    error: "/",
  },
});
