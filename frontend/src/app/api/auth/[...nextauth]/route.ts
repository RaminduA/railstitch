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
      const apiUrl = process.env.INTERNAL_API_URL ?? "http://localhost:8080";
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
      } catch { /* non fatal */ }
      return true;
    },

    async jwt({ token, account }) {
      // On first sign-in, fetch is_admin and cache in JWT
      if (account?.providerAccountId) {
        token.googleId = account.providerAccountId;
        const apiUrl = process.env.INTERNAL_API_URL ?? "http://localhost:8080";
        try {
          const res = await fetch(`${apiUrl}/api/auth/upsert-user`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: account.providerAccountId,
              email: token.email,
              name: token.name ?? "",
              avatar_url: token.picture ?? "",
            }),
          });
          if (res.ok) {
            const u = await res.json();
            token.isAdmin = u.is_admin as boolean;
          }
        } catch { /* skip */ }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as { googleId?: string; isAdmin?: boolean }).googleId =
          token.googleId as string;
        (session.user as { isAdmin?: boolean }).isAdmin =
          (token.isAdmin as boolean) ?? false;
      }
      return session;
    },
  },
  pages: { signIn: "/" },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
