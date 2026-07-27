import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Las imágenes del proyecto ya están optimizadas y se sirven como assets
    // estáticos. Esto evita depender del binding Cloudflare Images en local.
    unoptimized: true,
  },
};

export default nextConfig;
