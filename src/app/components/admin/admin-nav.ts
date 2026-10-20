import type { SidebarNavItem } from "@/app/components/Sidebar";

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", icon: "settings", label: "Dashboard" },
  { href: "/admin#partner-applications", icon: "briefcase", label: "Partners" },
  { href: "/admin#fleet", icon: "bike", label: "Fleet Ops" },
  { href: "/admin/documents", icon: "document", label: "Documents" },
  { href: "/admin/payments", icon: "money", label: "Payments & Refunds" },
  { href: "/admin/incidents", icon: "warning", label: "Incident Triage" },
  { href: "/admin/policies", icon: "settings", label: "Policies & Promotions" },
  { href: "/admin/locations", icon: "location", label: "Pickup Locations" },
  { href: "/admin/settlements", icon: "money", label: "Partner Settlements" },
  { href: "/admin#audit", icon: "search", label: "Audit Logs" }
] satisfies SidebarNavItem[];
