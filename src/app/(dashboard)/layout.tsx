"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!isPending) {
      if (!session?.user) {
        router.push("/login");
      } else {
        setAuthorized(true);
      }
    }
  }, [session, isPending, router]);

  if (!authorized) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f7f7]">
        <div className="text-sm font-medium text-[#afafaf] uppercase tracking-wider">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
