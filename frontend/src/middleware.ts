export { default } from "next-auth/middleware";

// Protect all routes except the landing page, auth endpoints, and verify pages
export const config = {
  matcher: [
    "/trains/:path*",
    "/trips/:path*",
    "/bookings/:path*",
    "/my-bookings",
    "/admin/:path*",
  ],
};
