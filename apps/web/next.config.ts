import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@foodtruckzs/shared"],
};

export default nextConfig;
