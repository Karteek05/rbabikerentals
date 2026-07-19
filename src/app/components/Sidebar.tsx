"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import Icon, { type IconName } from "./Icon";

interface NavItem {
  href: string;
  icon: IconName;
  label: string;
  badge?: string | number;
}

interface SidebarProps {
  role: "customer" | "partner" | "admin";
  navItems: NavItem[];
  userName?: string;
}

export default function Sidebar({ role, navItems, userName }: SidebarProps) {
  const pathname = usePathname();
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
          const isExactPartner = item.href === "/partner";
          const isActive = isExactPartner
            ? pathname === "/partner"
            : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
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
