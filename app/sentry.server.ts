import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry(): void {
  if (initialized || !process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
  });

  initialized = true;
}

export function captureException(error: unknown): void {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }
}
