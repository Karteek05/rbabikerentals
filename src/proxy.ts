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

export async function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/partner/:path*"]
};
