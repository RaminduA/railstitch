import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path((?!auth/).*)",
        destination: `${process.env.INTERNAL_API_URL ?? "http://api:8080"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
