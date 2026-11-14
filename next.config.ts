import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  outputFileTracingIncludes: { "/api/admin/migrar": ["./db/migrations/**/*"] },
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default withSentryConfig(nextConfig, {
  org: "sisclickaws",
  project: "casa-de-racao",
  silent: true,
  // envia os source maps só se SENTRY_AUTH_TOKEN existir na Vercel
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // passa os eventos pelo próprio domínio (bloqueadores de anúncio não derrubam)
  tunnelRoute: "/monitoramento",
  telemetry: false,
});
