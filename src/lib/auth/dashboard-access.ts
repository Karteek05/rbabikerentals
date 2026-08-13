import type { Role } from "@/lib/types/domain";

export const DASHBOARD_ACCESS_COOKIE = "rba_dashboard_access";

export type DashboardAccessRole = Extract<Role, "admin" | "partner_investor">;

export type DashboardAccessActor = {
  userId: string;
  role: DashboardAccessRole;
  exp: number;
};

const roleDefaults: Record<
  DashboardAccessRole,
  { env: string; hashEnv: string; userIdEnv: string; fallbackUserId: string }
> = {
  admin: {
    env: "ADMIN_DASHBOARD_PASSWORD",
    hashEnv: "ADMIN_DASHBOARD_PASSWORD_SHA256",
    userIdEnv: "ADMIN_DASHBOARD_USER_ID",
    fallbackUserId: "admin_001"
  },
  partner_investor: {
    env: "PARTNER_DASHBOARD_PASSWORD",
    hashEnv: "PARTNER_DASHBOARD_PASSWORD_SHA256",
    userIdEnv: "PARTNER_DASHBOARD_USER_ID",
    fallbackUserId: "partner_001"
  }
};

function getSecret() {
  const isProduction =
    process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
  return (
    process.env.DASHBOARD_ACCESS_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    (!isProduction ? "rba-dashboard-dev-secret-change-before-prod" : "")
  );
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToString(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function stringToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length === rightBytes.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
}

async function sign(payload: string) {
  const secret = getSecret();
  if (!secret) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

export function dashboardRoleFromParam(value: unknown): DashboardAccessRole | null {
  if (value === "admin") return "admin";
  if (value === "partner" || value === "partner_investor") return "partner_investor";
  return null;
}

export function getDashboardPassword(role: DashboardAccessRole) {
  const configured = process.env[roleDefaults[role].env];
  if (configured) return configured;
  if (process.env.APP_ENV === "production" || process.env.NODE_ENV === "production") return "";
  return role === "admin" ? "admin123" : "partner123";
}

export async function verifyDashboardPassword(role: DashboardAccessRole, password: string) {
  const configuredHash = process.env[roleDefaults[role].hashEnv];
  const candidateHash = await sha256Hex(password);
  const devFallback = role === "admin" ? "admin123" : "partner123";

  if (configuredHash) {
    if (constantTimeEqual(candidateHash, configuredHash.trim().toLowerCase())) {
      return true;
    }
    if (process.env.APP_ENV !== "production" && process.env.NODE_ENV !== "production") {
      return constantTimeEqual(candidateHash, await sha256Hex(devFallback));
    }
    return false;
  }

  const configuredPassword = getDashboardPassword(role);
  if (!configuredPassword) return false;
  const expectedHash = await sha256Hex(configuredPassword);
  if (constantTimeEqual(candidateHash, expectedHash)) return true;
  if (process.env.APP_ENV !== "production" && process.env.NODE_ENV !== "production") {
    return constantTimeEqual(candidateHash, await sha256Hex(devFallback));
  }
  return false;
}

export function getDashboardUserId(role: DashboardAccessRole) {
  return process.env[roleDefaults[role].userIdEnv] || roleDefaults[role].fallbackUserId;
}

export function getDashboardEmail(role: DashboardAccessRole) {
  const roleEmail =
    role === "admin" ? process.env.ADMIN_DASHBOARD_EMAIL : process.env.PARTNER_DASHBOARD_EMAIL;
  return roleEmail || process.env.ADMIN_EMAIL || "";
}

export async function createDashboardAccessToken(params: {
  role: DashboardAccessRole;
  userId: string;
  maxAgeSeconds?: number;
}) {
  const payload = stringToBase64Url(
    JSON.stringify({
      role: params.role,
      userId: params.userId,
      exp: Date.now() + (params.maxAgeSeconds ?? 8 * 60 * 60) * 1000
    })
  );
  const signature = await sign(payload);
  if (!signature) return "";
  return `${payload}.${signature}`;
}

export async function verifyDashboardAccessToken(
  token: string | undefined | null,
  requiredRole?: DashboardAccessRole
): Promise<DashboardAccessActor | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = await sign(payload);
  if (!expected || expected !== signature) return null;

  try {
    const parsed = JSON.parse(base64UrlToString(payload)) as DashboardAccessActor;
    if (parsed.exp < Date.now()) return null;
    if (parsed.role !== "admin" && parsed.role !== "partner_investor") return null;
    if (requiredRole && parsed.role !== requiredRole) return null;
    if (!parsed.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}
