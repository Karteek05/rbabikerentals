"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import type { Role } from "@/lib/types/domain";

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
      router.push("/login");
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
        const role = json?.data?.user?.role as Role | undefined;

        if (cancelled) return;

        if (!res.ok || !json.ok || !role) {
          router.push("/login");
          return;
        }

        if (role !== requiredRole) {
          router.push(role === "admin" ? "/admin" : role === "partner_investor" ? "/partner" : "/");
          return;
        }

        setAuthorized(true);
      } catch {
        if (!cancelled) {
          router.push("/login");
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
        <div className="text-sm font-medium text-[#afafaf] uppercase tracking-wider">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
