import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emits .next/standalone — a self-contained server bundle the
  // production Dockerfile copies. Without this the image build fails.
  output: "standalone",
};

export default nextConfig;
