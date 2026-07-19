"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { dashboardPathForRole } from "@/lib/auth/post-login-redirect";
import type { Role } from "@/lib/types/domain";

const CUSTOMER_LINKS = [
  { href: "/browse", label: "Browse Bikes" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/my-bookings", label: "My Bookings" }
];

type AccountState = {
  authenticated: boolean;
  user: { name?: string; email?: string | null; role?: Role } | null;
};

function isLinkActive(pathname: string, href: string) {
  if (href === "/#how-it-works") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<AccountState | null>(null);
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (!session?.user) {
      setAccount(null);
      return;
    }

    let cancelled = false;
    async function loadAccount() {
      try {
        const response = await fetch("/api/account/me", {
          credentials: "include",
          cache: "no-store"
        });
        const json = await response.json();
        if (cancelled || !response.ok || !json?.ok) {
          setAccount(null);
          return;
        }
        setAccount(json.data as AccountState);
      } catch {
        if (!cancelled) setAccount(null);
      }
    }

    void loadAccount();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const isStaffSurface =
      pathname.startsWith("/admin") ||
      pathname.startsWith("/partner") ||
      pathname.startsWith("/dashboard-access");

    if (!isStaffSurface) {
      fetch("/api/dashboard-access", { method: "DELETE" }).catch(() => undefined);
    }
  }, [pathname]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (!open) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  async function signOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        }
      }
    });
  }

  const role = account?.user?.role;
  const dashboardHref = dashboardPathForRole(role);
  const displayName = session?.user?.name || session?.user?.email || "Customer";
  const initial = displayName.trim().charAt(0).toUpperCase() || "C";
  const authMode =
    pathname === "/signup" ? "register" : pathname === "/login" ? "signin" : null;

  const navLinks = useMemo(() => {
    if (role === "admin") {
      return [{ href: "/admin", label: "Admin Dashboard" }];
    }
    if (role === "partner_investor") {
      return [
        { href: "/partner", label: "Partner Dashboard" },
        { href: "/partner/bookings", label: "Bookings" },
        { href: "/partner/vehicles", label: "Vehicles" }
      ];
    }
    return CUSTOMER_LINKS;
  }, [role]);

  const profileHref = role === "admin" ? "/admin" : role === "partner_investor" ? "/partner" : "/profile";
  const showBookCta = !role || role === "customer";

  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--color-line)] bg-[color:var(--color-paper)]/95 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-container items-center justify-between gap-6 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={role === "admin" ? "/admin" : role === "partner_investor" ? "/partner" : "/"} className="nav-focus select-none text-xl font-black tracking-normal text-[color:var(--color-ink)]">
            RBA<span className="text-[color:var(--color-accent-strong)]">.</span>
          </Link>
          <p className="hidden text-[11px] font-semibold uppercase text-[color:var(--color-muted)] lg:block">
            Bengaluru Bike Rentals
          </p>
        </div>

        <nav className="hidden items-center gap-2 rounded-full border border-[color:var(--color-line)] bg-white/70 p-1 md:flex">
          {navLinks.map((link) => {
            const active = isLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-focus rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[color:var(--color-ink)] text-white"
                    : "text-[color:var(--color-copy)] hover:bg-[color:var(--color-paper-2)] hover:text-[color:var(--color-ink)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {session?.user ? (
            <div className="hidden items-center gap-2 rounded-full border border-[color:var(--color-line)] bg-white px-3 py-1.5 md:flex">
              <Link
                href={profileHref}
                className="nav-focus flex min-w-0 items-center gap-2 rounded-full pr-1"
                aria-label="Open dashboard"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-ink)] text-xs font-black text-white">
                  {initial}
                </span>
                <span className="max-w-[150px] truncate text-xs font-bold text-[color:var(--color-ink)]">
                  {displayName}
                </span>
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="nav-focus flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--color-muted)] hover:bg-[color:var(--color-paper-2)] hover:text-[color:var(--color-ink)]"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-1 rounded-full border border-[color:var(--color-line)] bg-white/80 p-1 shadow-sm md:flex">
              <Link
                href="/login"
                className={`nav-focus rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                  authMode === "signin"
                    ? "bg-[color:var(--color-ink)] text-white shadow-sm"
                    : "text-[color:var(--color-copy)] hover:bg-[color:var(--color-paper-2)]"
                }`}
              >
                Login
              </Link>
              <Link
                href="/signup"
                className={`nav-focus rounded-full px-4 py-2 text-sm font-black transition-colors ${
                  authMode === "register"
                    ? "bg-[color:var(--color-ink)] text-white shadow-sm"
                    : "text-[color:var(--color-copy)] hover:bg-[color:var(--color-paper-2)]"
                }`}
              >
                Register
              </Link>
            </div>
          )}

          {showBookCta ? (
            <Link href="/browse" className="btn-primary hidden whitespace-nowrap sm:inline-flex">
              Book a Bike
            </Link>
          ) : null}

          <button
            type="button"
            className="nav-focus inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-paper-2)] md:hidden"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-[color:var(--color-line)] bg-[color:var(--color-paper)] px-4 py-4 md:hidden">
          <nav className="mx-auto flex max-w-container flex-col gap-1">
            {navLinks.map((link) => {
              const active = isLinkActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-focus rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-[color:var(--color-ink)] text-white"
                      : "text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-2)]"
                  }`}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}

            {session?.user ? (
              <>
                <Link
                  href={profileHref}
                  className="nav-focus rounded-lg px-4 py-3 text-sm font-semibold text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-2)]"
                  onClick={() => setOpen(false)}
                >
                  {role === "admin" ? "Admin dashboard" : role === "partner_investor" ? "Partner dashboard" : "Profile"}
                </Link>
                <button
                  type="button"
                  className="nav-focus mt-2 flex items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[color:var(--color-ink)]"
                  onClick={signOut}
                >
                  <span className="truncate">Signed in as {displayName}</span>
                  <LogOut className="h-4 w-4 shrink-0" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="nav-focus rounded-lg px-4 py-3 text-sm font-semibold" onClick={() => setOpen(false)}>
                  Login
                </Link>
                <Link href="/signup" className="nav-focus rounded-lg px-4 py-3 text-sm font-black" onClick={() => setOpen(false)}>
                  Register
                </Link>
              </>
            )}

            {showBookCta ? (
              <Link href="/browse" className="btn-primary mt-2 text-center sm:hidden" onClick={() => setOpen(false)}>
                Book a Bike
              </Link>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
