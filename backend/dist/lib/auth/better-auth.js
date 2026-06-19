"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
require("../../env");
const better_auth_1 = require("better-auth");
const pg_1 = require("pg");
const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
const isProduction = process.env.APP_ENV === "production";
const authSecret = process.env.BETTER_AUTH_SECRET ??
    (isProduction ? undefined : "rbabikerentals-dev-secret-change-in-prod");
if (!authSecret) {
    throw new Error("BETTER_AUTH_SECRET is required when APP_ENV=production.");
}
exports.auth = (0, better_auth_1.betterAuth)({
    basePath: process.env.BETTER_AUTH_BASE_PATH ?? "/api/auth",
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_BASE_URL,
    secret: authSecret,
    database: dbUrl
        ? new pg_1.Pool({
            connectionString: dbUrl,
            ssl: dbUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined
        })
        : undefined,
    emailAndPassword: {
        enabled: true
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: false
            }
        }
    }
});
