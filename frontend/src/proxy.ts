import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PASSENGER_ROUTES = ["/trains", "/trips", "/bookings", "/booking-history"];
const ADMIN_ROUTES = ["/admin"];
const PROTECTED = [...PASSENGER_ROUTES, ...ADMIN_ROUTES];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  const isAdmin = (token.isAdmin as boolean) ?? false;

  // Passenger trying to access admin routes: redirect to /trains
  if (ADMIN_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/")) && !isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/trains";
    return NextResponse.redirect(url);
  }

  // Admin trying to access passenger routes: redirect to /admin
  if (PASSENGER_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/")) && isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
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
