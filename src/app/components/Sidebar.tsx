"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  const roleLabels = {
    customer: "Customer",
    partner: "Partner / Investor",
    admin: "Admin"
  };

  const roleIcon: Record<SidebarProps["role"], IconName> = {
    customer: "scooter",
    partner: "chart",
    admin: "settings"
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Link href="/" className="inline-flex items-center gap-2 min-w-0">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-ink)] text-[color:var(--color-accent)]">
            <Icon name={roleIcon[role]} className="w-4 h-4" />
          </span>
          <span className="min-w-0">
            <span className="logo-mark block">RBA Ops</span>
            <span className="logo-sub block">{roleLabels[role]}</span>
          </span>
        </Link>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        {navItems.map((item) => {
          const isExactPartner = item.href === "/partner";
          const isActive = isExactPartner
            ? pathname === "/partner"
            : pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-icon">
                <Icon name={item.icon} className="w-4 h-4" />
              </span>
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge !== "" && (
                <span className="nav-badge">{item.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {userName && (
          <div className="sidebar-user">
            <div className="sidebar-user-name">{userName}</div>
            <div className="sidebar-user-meta">Bengaluru dashboard</div>
          </div>
        )}
        <div className="sidebar-role-badge">
          <Icon name={roleIcon[role]} className="w-4 h-4" />
          {roleLabels[role]}
        </div>
        <Link
          href="/"
          className="sidebar-home-link"
        >
          Back to Home
        </Link>
      </div>
    </aside>
  );
}
