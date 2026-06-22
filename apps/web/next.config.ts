import type { NextConfig } from "next";

// Transpile the workspace contract package so the SPA can import its TS types directly.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@wismo/shared"],
  output: "standalone",
};

export default nextConfig;
