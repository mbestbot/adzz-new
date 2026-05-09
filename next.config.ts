import type { NextConfig } from "next";

/**
 * API proxy: `app/api/backend/[...path]/route.ts` (same-origin /api/backend → VPS).
 * Client: NEXT_PUBLIC_API_URL=/api/backend
 */
const nextConfig: NextConfig = {};

export default nextConfig;
