import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: appRoot,
  },
  async rewrites() {
    return [
      { source: "/studies", destination: "/portal.html" },
      { source: "/tonal", destination: "/portal.html" },
      { source: "/portal", destination: "/portal.html" },
    ];
  },
};

export default nextConfig;
