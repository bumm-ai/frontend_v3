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
  // Разрешаем доступ с любых хостов
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, x-user-id',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
