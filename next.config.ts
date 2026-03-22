import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Упрощенная конфигурация для стабильной работы
  experimental: {
    // Отключаем turbo для стабильности
  },
  // Отключаем ESLint во время build для Vercel
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Прокси для API запросов
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: '/api/backend/:path*',
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
