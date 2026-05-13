import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@spr26/ai-service", "@spr26/db"],
  // Lint runs separately in CI via `npm run lint` at the repo root — don't
  // double-gate the production build on it.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
