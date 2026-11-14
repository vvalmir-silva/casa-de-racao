import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === "production",
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // ruído comum de extensões e redes móveis
  ignoreErrors: ["ResizeObserver loop", "Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource"],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
