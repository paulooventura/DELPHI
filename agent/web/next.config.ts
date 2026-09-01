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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' file: http://localhost:* http://127.0.0.1:* https://delphi.pauloventura.org",
          },
        ],
      },
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
