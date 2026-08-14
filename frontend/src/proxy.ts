import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PASSENGER_ONLY = ["/booking-history"];
const ADMIN_ONLY = ["/admin"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPassengerOnly = PASSENGER_ONLY.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  const isAdminOnly = ADMIN_ONLY.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (!isPassengerOnly && !isAdminOnly) return NextResponse.next();

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  const isAdmin = (token.isAdmin as boolean) ?? false;

  if (isAdminOnly && !isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/trains";
    return NextResponse.redirect(url);
  }

  if (isPassengerOnly && isAdmin) {
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
    "/verify/:path*",
  ],
};
