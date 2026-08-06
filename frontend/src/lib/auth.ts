// Shared auth helpers for server and client components
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.providerAccountId) token.googleId = account.providerAccountId;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.googleId) {
        (session.user as { googleId?: string; isAdmin?: boolean }).googleId = token.googleId as string;
        // is_admin is set during signIn callback — read from token if cached
        if (token.isAdmin !== undefined) {
          (session.user as { isAdmin?: boolean }).isAdmin = token.isAdmin as boolean;
        }
      }
      return session;
    },
  },
  pages: { signIn: "/" },
  secret: process.env.NEXTAUTH_SECRET,
};

export type AppUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  googleId?: string;
  isAdmin?: boolean;
};

export async function getSession() {
  return getServerSession(authOptions);
}
