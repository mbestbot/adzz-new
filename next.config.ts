import type { NextConfig } from "next";

/**
 * Browser calls same-origin HTTPS `/adzz-api-proxy/...` (no mixed content).
 * Next proxies to `ADZZ_API_UPSTREAM` (HTTP OK — server-side only).
 * @see frontend/.env.example
 */
const upstream = (
  process.env.ADZZ_API_UPSTREAM ?? "http://65.2.181.155/adzz-api"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    /** Must run before App Router file matching or `/adzz-api-proxy/*` becomes 404 on Vercel. */
    return {
      beforeFiles: [
        {
          source: "/adzz-api-proxy/:path*",
          destination: `${upstream}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
