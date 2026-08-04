import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Protected routes — redirect to landing page if not signed in
const PROTECTED = [
  "/trains",
  "/trips",
  "/bookings",
  "/booking-history",
  "/admin",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this path needs protection
  const needsAuth = PROTECTED.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );

  if (!needsAuth) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/trains/:path*",
    "/trips/:path*",
    "/bookings/:path*",
    "/booking-history",
    "/admin/:path*",
  ],
};
