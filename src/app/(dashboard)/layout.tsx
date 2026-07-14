"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { loginPathForDashboard } from "@/lib/auth/post-login-redirect";
import type { PartnerApplicationStatus, Role } from "@/lib/types/domain";

function requiredRoleForPath(pathname: string): Role | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname === "/partner" || pathname.startsWith("/partner/")) return "partner_investor";
  if (pathname === "/customer" || pathname.startsWith("/customer/")) return "customer";
  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (isPending) return;

    if (!session?.user) {
      setAuthorized(false);
      const loginPath = loginPathForDashboard(pathname);
      const nextParam =
        pathname && pathname !== loginPath ? `?next=${encodeURIComponent(pathname)}` : "";
      router.push(`${loginPath}${nextParam}`);
      return;
    }

    const requiredRole = requiredRoleForPath(pathname);
    if (!requiredRole) {
      setAuthorized(true);
      return;
    }

    setAuthorized(false);
    let cancelled = false;

    async function verifyRole() {
      try {
        const res = await fetch("/api/account/me", { credentials: "include" });
        const json = await res.json();
        const user = json?.data?.user as
          | {
              role?: Role;
              partner_application_status?: PartnerApplicationStatus | null;
            }
          | undefined;

        if (cancelled) return;

        if (!res.ok || !json.ok || !user?.role) {
          router.push(`${loginPathForDashboard(pathname)}?next=${encodeURIComponent(pathname)}`);
          return;
        }

        if (requiredRole === "partner_investor") {
          if (user.role !== "partner_investor") {
            if (user.partner_application_status === "pending") {
              router.push("/partner-apply?status=pending");
              return;
            }
            if (user.partner_application_status === "rejected") {
              router.push("/partner-apply?status=rejected");
              return;
            }
            router.push("/partner-apply");
            return;
          }
          if (user.partner_application_status === "pending") {
            router.push("/partner-apply?status=pending");
            return;
          }
          if (user.partner_application_status === "rejected") {
            router.push("/partner-apply?status=rejected");
            return;
          }
        } else if (user.role !== requiredRole) {
          router.push(
            user.role === "admin"
              ? "/admin"
              : user.role === "partner_investor"
                ? "/partner"
                : "/"
          );
          return;
        }

        setAuthorized(true);
      } catch {
        if (!cancelled) {
          router.push(`${loginPathForDashboard(pathname)}?next=${encodeURIComponent(pathname)}`);
        }
      }
    }

    verifyRole();

    return () => {
      cancelled = true;
    };
  }, [session, isPending, router, pathname]);

  if (!authorized) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f7f7]">
        <div className="text-sm font-medium uppercase tracking-wider text-[#afafaf]">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
