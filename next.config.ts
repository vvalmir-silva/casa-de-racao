import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  outputFileTracingIncludes: { "/api/admin/migrar": ["./db/migrations/**/*"] },
};
export default nextConfig;
