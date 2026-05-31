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
  // packages/shared など workspace 内の .ts ファイルを .js 拡張子のインポート経由で解決する。
  // TypeScript の Bundler モードと整合させ、webpack でも同じ拡張子推論を行う。
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
