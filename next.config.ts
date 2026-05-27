import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb',
    },
  },

  reactCompiler: false,
  allowedDevOrigins: ["192.168.2.129"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
