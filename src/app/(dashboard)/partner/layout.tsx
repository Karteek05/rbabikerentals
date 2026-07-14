"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { PARTNER_NAV, formatPartnerUserLabel } from "../../components/partner/partner-nav";

type PartnerUser = {
  id: string;
  name: string;
};

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PartnerUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/me", { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json?.ok || !json?.data?.user) return;
        setUser({ id: json.data.user.id, name: json.data.user.name });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="dashboard-layout partner-shell">
      <Sidebar
        role="partner"
        navItems={PARTNER_NAV}
        userName={user ? formatPartnerUserLabel(user.name, user.id) : undefined}
      />
      <div className="dashboard-content partner-content">
        {children}
        <footer className="partner-footer">
          © RBA Bike Rentals · All rights reserved · Version 0.1.0
        </footer>
      </div>
    </div>
  );
}
