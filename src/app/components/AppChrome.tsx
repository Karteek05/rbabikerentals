"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";

const OPS_PREFIXES = ["/admin", "/partner", "/customer"];
const AUTH_ONLY_PREFIXES = [
  "/admin-login",
  "/partner-login",
  "/staff-login",
  "/login",
  "/signup",
  "/reset-password"
];

function hideMarketingChrome(pathname: string) {
  if (OPS_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }
  if (AUTH_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }
  if (pathname.startsWith("/documents/")) return true;
  if (pathname.startsWith("/bookings/") && pathname.endsWith("/invoice")) return true;
  return false;
}

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const minimal = hideMarketingChrome(pathname);

  if (minimal) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
