import type { NextConfig } from "next";

const isBasePathEnabled = process.env.OCEANS_BASEPATH === "/tenant-search";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isBasePathEnabled ? { basePath: "/tenant-search", assetPrefix: "/tenant-search" } : {}),
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
};

export default nextConfig;
