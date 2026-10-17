import type { SidebarNavItem } from "@/app/components/Sidebar";

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", icon: "settings", label: "Dashboard" },
  { href: "/admin#partner-applications", icon: "briefcase", label: "Partners" },
  { href: "/admin#fleet", icon: "bike", label: "Fleet Ops" },
  { href: "/admin/documents", icon: "document", label: "Documents" },
  { href: "/admin#bookings", icon: "list", label: "Bookings" },
  { href: "/admin#audit", icon: "search", label: "Audit Logs" }
] satisfies SidebarNavItem[];
