import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['leaflet', 'react-leaflet'], // Важно для Leaflet
  images: {
    domains: ['tile.openstreetmap.org'], // Если будете использовать тайлы
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Для спутниковых данных (можно уточнить позже)
      },
    ],
  },
};

export default nextConfig;