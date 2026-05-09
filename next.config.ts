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
    return [
      {
        source: "/adzz-api-proxy/:path*",
        destination: `${upstream}/:path*`,
      },
    ];
  },
};

export default nextConfig;
