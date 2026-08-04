import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;
      // Upsert user in our own DB so we have is_admin and user_id for bookings
      const apiUrl = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
      try {
        await fetch(`${apiUrl}/api/auth/upsert-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: account.providerAccountId,
            email: user.email,
            name: user.name ?? "",
            avatar_url: user.image ?? "",
          }),
        });
      } catch { /* non-fatal — user can still sign in */ }
      return true;
    },
    async jwt({ token, account }) {
      // Store Google sub in the JWT so we can use it as user_id
      if (account?.providerAccountId) {
        token.googleId = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose googleId + isAdmin to client session
      if (session.user) {
        (session.user as { googleId?: string }).googleId = token.googleId as string;
      }

      // Fetch is_admin from our DB
      const apiUrl = process.env.INTERNAL_API_URL ?? "http://localhost:8080";
      if (token.googleId) {
        try {
          const res = await fetch(`${apiUrl}/api/auth/upsert-user`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: token.googleId,
              email: session.user?.email ?? "",
              name: session.user?.name ?? "",
              avatar_url: session.user?.image ?? "",
            }),
          });
          if (res.ok) {
            const u = await res.json();
            (session.user as { isAdmin?: boolean }).isAdmin = u.is_admin;
          }
        } catch { /* skip */ }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",  // redirect to landing page for sign-in
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
