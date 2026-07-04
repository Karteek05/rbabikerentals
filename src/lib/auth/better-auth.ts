import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { Pool } from "pg";
import { sendResetPasswordEmail, sendOtpEmail } from "@/lib/notifications/service";
import { getServerAppBaseUrl, isProductionRuntime } from "@/lib/utils/app-url";

export function resolveAuthDatabaseUrl(
  env: Record<string, string | undefined> = process.env
) {
  const isProduction = isProductionRuntime(env);
  const dbUrl = env.SUPABASE_DB_URL ?? env.DATABASE_URL;
  if (isProduction && !dbUrl) {
    throw new Error("SUPABASE_DB_URL or DATABASE_URL is required in production.");
  }
  if (!isProduction) {
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
    cookiePrefix: "rba"
  },
  basePath: process.env.BETTER_AUTH_BASE_PATH ?? "/api/auth",
  baseURL: getServerAppBaseUrl(),
  secret: authSecret,
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
