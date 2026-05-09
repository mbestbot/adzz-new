import type { NextConfig } from "next";

/**
 * API proxy is implemented in `app/adzz-api-proxy/[[...path]]/route.ts`
 * (Vercel does not reliably honor external URL rewrites).
 *
 * Client uses NEXT_PUBLIC_API_URL=/adzz-api-proxy → server forwards to ADZZ_API_UPSTREAM.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
