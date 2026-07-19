import type { Role } from "@/lib/types/domain";

export function dashboardPathForRole(role: Role | string | undefined | null) {
  if (role === "admin") return "/admin";
  if (role === "partner_investor") return "/partner";
  if (role === "customer") return "/my-bookings";
  return "/profile";
}

export function loginPathForDashboard(pathname: string) {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "/admin-login";
  if (pathname === "/partner" || pathname.startsWith("/partner/")) return "/partner-login";
  return "/login";
}

export function resolveSafeReturnTo(returnTo: string | null | undefined) {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return null;
  }
  return returnTo;
}

export async function fetchAccountRole(): Promise<Role | null> {
  try {
    const response = await fetch("/api/account/me", {
      credentials: "include",
      cache: "no-store"
    });
    const json = await response.json();
    if (!response.ok || !json?.ok) {
      return null;
    }
    return (json.data?.user?.role as Role | undefined) ?? null;
  } catch {
    return null;
  }
}

export function resolvePostLoginPath(params: {
  role: Role | string | null | undefined;
  returnTo?: string | null;
  fallback?: string;
}) {
  const safeReturnTo = resolveSafeReturnTo(params.returnTo ?? null);
  if (safeReturnTo) {
    return safeReturnTo;
  }
  return dashboardPathForRole(params.role) || params.fallback || "/profile";
}
