import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  outputFileTracingIncludes: { "/api/admin/migrar": ["./db/migrations/**/*"] },
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};
export default nextConfig;
