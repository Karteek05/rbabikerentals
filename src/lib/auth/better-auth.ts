import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import { sendResetPasswordEmail, sendOtpEmail } from "@/lib/notifications/service";
import { getServerAppBaseUrl, isProductionRuntime } from "@/lib/utils/app-url";

function resolveTrustedOrigins() {
  const origins = new Set<string>();
  const baseUrl = getServerAppBaseUrl();
  if (baseUrl) {
    try {
      origins.add(new URL(baseUrl).origin);
    } catch {
      // ignore invalid base URL
    }
  }

  for (const value of process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? []) {
    const trimmed = value.trim();
    if (trimmed) origins.add(trimmed);
  }

  if (isProductionRuntime()) {
    origins.add("https://www.rbabikerentals.com");
    origins.add("https://rbabikerentals.com");
  }

  return [...origins];
}

function resolveCrossSubDomainCookies() {
  if (!isProductionRuntime()) return {};

  const baseUrl = getServerAppBaseUrl();
  if (!baseUrl) return {};

  try {
    const host = new URL(baseUrl).hostname;
    if (host === "rbabikerentals.com" || host.endsWith(".rbabikerentals.com")) {
      return {
        crossSubDomainCookies: {
          enabled: true,
          domain: "rbabikerentals.com"
        }
      } as const;
    }
  } catch {
    // ignore invalid base URL
  }

  return {};
}

export function resolveAuthDatabaseUrl(
  env: Record<string, string | undefined> = process.env
) {
  const isProduction = isProductionRuntime(env);
  const dbUrl = env.SUPABASE_DB_URL ?? env.DATABASE_URL;
  if (isProduction && !dbUrl) {
    throw new Error("SUPABASE_DB_URL or DATABASE_URL is required in production.");
  }
  if (env.AUTH_USE_MEMORY === "true") {
    return undefined;
  }
  return dbUrl;
}

const dbUrl = resolveAuthDatabaseUrl();
const isProduction = isProductionRuntime();
const authSecret =
  process.env.BETTER_AUTH_SECRET ??
  (isProduction ? undefined : "rbabikerentals-dev-secret-change-in-prod");
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

if (!authSecret) {
  throw new Error("BETTER_AUTH_SECRET is required in production.");
}

export const auth = betterAuth({
  advanced: {
    cookiePrefix: "rba",
    ...resolveCrossSubDomainCookies()
  },
  basePath: process.env.BETTER_AUTH_BASE_PATH ?? "/api/auth",
  baseURL: getServerAppBaseUrl(),
  trustedOrigins: resolveTrustedOrigins(),
  secret: authSecret,
  session: {
    cookieCache: {
      enabled: false
    }
  },
  database: dbUrl
    ? new Pool({
        connectionString: dbUrl,
        ssl: dbUrl.includes("supabase") ? { rejectUnauthorized: false } : undefined
      })
    : undefined,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      await sendResetPasswordEmail(user.email, url);
    }
  },
  plugins: [
    nextCookies(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }, request) {
        await sendOtpEmail(email, otp);
      }
    })
  ],
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret
          }
        }
      : {},
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false
      }
    }
  }
});
