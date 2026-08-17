/** @module-kind io */
/**
 * Inicialização do Sentry (H2.2 — observabilidade).
 *
 * Ativo apenas quando `VITE_SENTRY_DSN` está definido. Sem DSN, todas as
 * funções são no-op — a app continua funcionando normalmente em dev/local.
 */
import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = (
    import.meta as ImportMeta & { env?: { VITE_SENTRY_DSN?: string; MODE?: string; DEV?: boolean } }
  ).env?.VITE_SENTRY_DSN;
  if (!dsn) return;
  const mode = import.meta.env?.MODE ?? "development";
  Sentry.init({
    dsn,
    environment: mode,
    release: import.meta.env?.VITE_APP_RELEASE as string | undefined,
    tracesSampleRate: mode === "production" ? 0.05 : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Não tentar capturar quando rodando em iframe de preview do Lovable.
    beforeSend(event) {
      if (typeof window !== "undefined" && window.top !== window.self) {
        return null;
      }
      return event;
    },
  });
  initialized = true;
}

export function isSentryEnabled() {
  return initialized;
}

export function setSentryUser(user: { id?: string; login?: string; email?: string } | null) {
  if (!initialized) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: user.id,
    username: user.login,
    email: user.email,
  });
}

export function setSentryTag(key: string, value: string | undefined) {
  if (!initialized || !value) return;
  Sentry.setTag(key, value);
}

export function setSentryTags(tags: Record<string, string | undefined>) {
  if (!initialized) return;
  for (const [k, v] of Object.entries(tags)) {
    if (v != null) Sentry.setTag(k, v);
  }
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): string | undefined {
  if (!initialized) return undefined;
  return Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
): string | undefined {
  if (!initialized) return undefined;
  return Sentry.captureMessage(message, level);
}

export { Sentry };
