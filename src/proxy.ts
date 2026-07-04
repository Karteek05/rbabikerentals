import { NextResponse, type NextRequest } from "next/server";
import {
  DASHBOARD_ACCESS_COOKIE,
  verifyDashboardAccessToken,
  type DashboardAccessRole
} from "@/lib/auth/dashboard-access";

function requiredRoleForPath(pathname: string): DashboardAccessRole | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/partner" || pathname.startsWith("/partner/")) return "partner_investor";
  return null;
}

function hasSessionCookie(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return cookieHeader.includes("rba.session_token=") || cookieHeader.includes("rba_session=");
}

export async function proxy(request: NextRequest) {
  const requiredRole = requiredRoleForPath(request.nextUrl.pathname);
  if (!requiredRole) {
    return NextResponse.next();
  }

  if (hasSessionCookie(request)) {
    return NextResponse.next();
  }

  const dashboardCookie = request.cookies.get(DASHBOARD_ACCESS_COOKIE)?.value;
  const dashboardActor = await verifyDashboardAccessToken(dashboardCookie, requiredRole);
  if (dashboardActor) {
    return NextResponse.next();
  }

  const loginPath = requiredRole === "admin" ? "/admin-login" : "/partner-login";
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = loginPath;
  redirectUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/partner/:path*"]
};
