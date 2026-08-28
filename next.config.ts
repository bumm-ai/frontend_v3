import type { NextConfig } from "next";

const BACKEND_REWRITE_TARGET =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "https://api.bumm.io";

const nextConfig: NextConfig = {
  // Упрощенная конфигурация для стабильной работы
  experimental: {
    // Отключаем turbo для стабильности
  },
  // Отключаем ESLint во время build для Vercel
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Edge rewrite: any /api/backend/* request is transparently forwarded to
  // the real backend at Vercel's edge layer. This replaces the broken
  // [...path] proxy function with zero JS — no path normalization quirks,
  // no env-var injection bugs, no Next.js Route Handler precedence issues.
  // Local dev: same rewrite works because Next.js applies these in `next dev`.
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${BACKEND_REWRITE_TARGET}/:path*`,
      },
    ];
  },
  // CORS is NOT set globally. Cross-origin access is handled per-route in
  // src/app/api/proxy/route.ts, which checks Origin against an allowlist
  // (ALLOWED_ORIGINS) and only echoes it back when permitted. The app is
  // served same-origin to the browser and the /api/backend/* rewrites are
  // same-origin too, so no global CORS header is needed. A global
  // Access-Control-Allow-Origin:'*' previously overrode the proxy allowlist
  // and weakened it — removed (H5).
  async headers() {
    return [];
  },
};

export default nextConfig;
