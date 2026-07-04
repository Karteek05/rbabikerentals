type AppUrlEnv = Record<string, string | undefined>;

export function isProductionRuntime(env: AppUrlEnv = process.env) {
  return env.APP_ENV === "production" || env.NODE_ENV === "production";
}

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isLocalBaseUrl(value: string | undefined) {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return false;

  try {
    const host = new URL(normalized).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function getVercelBaseUrl(env: AppUrlEnv) {
  return normalizeBaseUrl(env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL);
}

export function getServerAppBaseUrl(env: AppUrlEnv = process.env) {
  const betterAuthUrl = normalizeBaseUrl(env.BETTER_AUTH_URL);
  if (betterAuthUrl) return betterAuthUrl;

  const vercelUrl = getVercelBaseUrl(env);
  const appBaseUrl = normalizeBaseUrl(env.APP_BASE_URL);

  if (appBaseUrl && !(vercelUrl && isLocalBaseUrl(appBaseUrl))) {
    return appBaseUrl;
  }

  if (vercelUrl) return vercelUrl;

  return isProductionRuntime(env) ? undefined : "http://localhost:3000";
}

export function getPublicAuthClientBaseUrl(env: AppUrlEnv = process.env) {
  return normalizeBaseUrl(env.NEXT_PUBLIC_BETTER_AUTH_URL || env.NEXT_PUBLIC_APP_BASE_URL);
}
