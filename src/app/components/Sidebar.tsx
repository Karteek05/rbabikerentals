"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import Icon, { type IconName } from "./Icon";

export interface SidebarNavItem {
  href: string;
  icon: IconName;
  label: string;
  badge?: string | number;
}


export default function Sidebar({
  role,
  navItems,
  userName
}: {
  role: "customer" | "partner" | "admin";
  navItems: SidebarNavItem[];
  userName?: string;
}) {


  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState("");
  useEffect(() => {
    const syncHash = () => setActiveHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);
  function isNavItemActive(href: string) {
    const hashIndex = href.indexOf("#");
    const basePath = hashIndex < 0 ? href : href.slice(0, hashIndex);
    const hash = hashIndex < 0 ? "" : href.slice(hashIndex);
    if (hash) return pathname === basePath && activeHash === hash;
    if (basePath === "/" || basePath === "/admin" || basePath === "/partner") {
      return pathname === basePath;
    }
    return pathname === basePath || pathname.startsWith(`${basePath}/`);
  }
  const showSignOut = role === "admin" || role === "partner";

  async function signOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        }
      }
    });
  }

  const roleLabels = {
    customer: "Customer",
    partner: "Partner",
    admin: "Admin"
  };

  const homeHref = role === "admin" ? "/admin" : role === "partner" ? "/partner" : "/";

  return (
    <aside className="ops-sidebar">
      <div className="ops-sidebar__brand">
        <Link href={homeHref} className="ops-sidebar__logo">
          <span className="ops-sidebar__mark">RBA</span>
          <span className="ops-sidebar__role">{roleLabels[role]}</span>
        </Link>
      </div>

      <nav className="ops-sidebar__nav" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const isActive = isNavItemActive(item.href);
          return (
            <Link key={item.href} href={item.href} className={`ops-sidebar__link${isActive ? " is-active" : ""}`}>
              <Icon name={item.icon} className="h-4 w-4" />
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge !== "" ? (
                <span className="ops-sidebar__badge">{item.badge}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="ops-sidebar__footer">
        {userName ? <p className="ops-sidebar__user">{userName}</p> : null}
        <p className="ops-sidebar__meta">Bengaluru operations</p>
        {role === "customer" ? (
          <Link href="/" className="ops-sidebar__home">
            Back to site
          </Link>
        ) : null}
        {showSignOut ? (
          <button type="button" onClick={signOut} className="ops-sidebar__logout">
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Log out
          </button>
        ) : null}
      </div>
    </aside>
  );
}
