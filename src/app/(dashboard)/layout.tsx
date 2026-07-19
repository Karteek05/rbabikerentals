"use client";

import { useEffect, useRef, useState } from "react";
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

type VerifiedAccess = {
  userId: string;
  role: Role;
  partnerApplicationStatus: PartnerApplicationStatus | null;
};

function canAccessPath(access: VerifiedAccess, pathname: string) {
  const requiredRole = requiredRoleForPath(pathname);
  if (!requiredRole) return true;

  if (requiredRole === "partner_investor") {
    if (access.role !== "partner_investor") return false;
    return access.partnerApplicationStatus !== "pending" && access.partnerApplicationStatus !== "rejected";
  }

  return access.role === requiredRole;
}

function redirectForAccess(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  access: VerifiedAccess
) {
  const requiredRole = requiredRoleForPath(pathname);
  if (!requiredRole) return;

  if (requiredRole === "partner_investor") {
    if (access.role !== "partner_investor") {
      if (access.partnerApplicationStatus === "pending") {
        router.replace("/partner-apply?status=pending");
        return;
      }
      if (access.partnerApplicationStatus === "rejected") {
        router.replace("/partner-apply?status=rejected");
        return;
      }
      router.replace("/partner-apply");
      return;
    }
    if (access.partnerApplicationStatus === "pending") {
      router.replace("/partner-apply?status=pending");
      return;
    }
    if (access.partnerApplicationStatus === "rejected") {
      router.replace("/partner-apply?status=rejected");
      return;
    }
    return;
  }

  if (access.role !== requiredRole) {
    router.replace(
      access.role === "admin" ? "/admin" : access.role === "partner_investor" ? "/partner" : "/profile"
    );
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const [gate, setGate] = useState<"loading" | "ready" | "denied">("loading");
  const verifiedAccessRef = useRef<VerifiedAccess | null>(null);
  const sessionUserId = session?.user?.id ?? null;

  useEffect(() => {
    if (isPending) return;

    if (!sessionUserId) {
      verifiedAccessRef.current = null;
      setGate("denied");
      const loginPath = loginPathForDashboard(pathname);
      const nextParam =
        pathname && pathname !== loginPath ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`${loginPath}${nextParam}`);
      return;
    }

    const requiredRole = requiredRoleForPath(pathname);
    if (!requiredRole) {
      setGate("ready");
      return;
    }

    const cached = verifiedAccessRef.current;
    const hasValidCache =
      cached?.userId === sessionUserId && canAccessPath(cached, pathname);
    if (hasValidCache) {
      setGate("ready");
    } else {
      setGate("loading");
    }

    let cancelled = false;

    async function verifyRole() {
      try {
        const res = await fetch("/api/account/me", { credentials: "include", cache: "no-store" });
        const json = await res.json();
        const user = json?.data?.user as
          | {
              role?: Role;
              partner_application_status?: PartnerApplicationStatus | null;
            }
          | undefined;

        if (cancelled) return;

        if (!res.ok || !json.ok || !json.data?.authenticated || !user?.role) {
          if (!hasValidCache) {
            verifiedAccessRef.current = null;
            setGate("denied");
            router.replace(`${loginPathForDashboard(pathname)}?next=${encodeURIComponent(pathname)}`);
          }
          return;
        }

        const access: VerifiedAccess = {
          userId: sessionUserId!,
          role: user.role,
          partnerApplicationStatus: user.partner_application_status ?? null
        };
        verifiedAccessRef.current = access;

        if (!canAccessPath(access, pathname)) {
          redirectForAccess(router, pathname, access);
          return;
        }

        setGate("ready");
      } catch {
        if (!cancelled && !hasValidCache) {
          verifiedAccessRef.current = null;
          setGate("denied");
          router.replace(`${loginPathForDashboard(pathname)}?next=${encodeURIComponent(pathname)}`);
        }
      }
    }

    void verifyRole();

    return () => {
      cancelled = true;
    };
  }, [sessionUserId, isPending, router, pathname]);

  if (isPending || gate === "loading") {
    return (
      <div className="ops-loading-screen">
        <div className="ops-loading-card">
          <div className="ops-loading-bar" />
          <div className="ops-loading-bar ops-loading-bar--short" />
          <p className="ops-loading-label">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (gate !== "ready") {
    return null;
  }

  return <>{children}</>;
}
