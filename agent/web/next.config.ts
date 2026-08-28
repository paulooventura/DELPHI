import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import { DELPHI_BUILD } from "./lib/buildStamp";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: appRoot,
  },
  async redirects() {
    return [
      { source: "/fresh", destination: `/portal?b=${DELPHI_BUILD}`, permanent: false },
      { source: "/door", destination: `/portal?b=${DELPHI_BUILD}`, permanent: false },
    ];
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
