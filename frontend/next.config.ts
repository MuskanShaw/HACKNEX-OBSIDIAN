import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://obsidian-backend-1.onrender.com";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${BACKEND_URL}/health`,
      },
      {
        source: "/docs",
        destination: `${BACKEND_URL}/api/docs`,
      },
      {
        source: "/swagger",
        destination: `${BACKEND_URL}/api/docs`,
      },
      {
        source: "/p3",
        destination: "/p3.html",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/p1",
        permanent: false,
      },
      {
        source: "/dashboard",
        destination: "/p2",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
