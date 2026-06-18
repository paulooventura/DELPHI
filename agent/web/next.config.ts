import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ask",
        destination: "http://localhost:3001/ask",
      },
    ];
  },
};

export default nextConfig;
