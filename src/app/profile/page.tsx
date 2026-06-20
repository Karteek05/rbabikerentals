"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bike,
  CalendarDays,
  ExternalLink,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Trash2,
  UserRound
} from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { isGoogleAuthEnabled, startGoogleSignIn } from "@/lib/auth/google-sign-in";
import type { Booking, User } from "@/lib/types/domain";
import {
  readAccountPayload,
  readBookingsPayload,
  type AccountResponse
} from "@/app/profile/profile-data";

const rideStatuses = new Set(["confirmed", "ongoing", "extended", "completed"]);
const pendingStatuses = new Set(["pending_kyc", "admin_review", "payment_pending"]);

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(new Date(value));
}

function formatStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function accountInitial(user: User | null) {
  const name = user?.name || user?.email || "Customer";
  return name.trim().charAt(0).toUpperCase() || "C";
}

export default function ProfilePage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (sessionPending) return;

      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/account/me", { cache: "no-store" });
        const payload = readAccountPayload(await response.json());
        if (!response.ok) {
          throw new Error("Unable to load profile.");
        }
        if (!cancelled) {
          setAccount(payload);
        }
      } catch (profileError) {
        if (!cancelled) {
          setError(profileError instanceof Error ? profileError.message : "Unable to load profile.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, sessionPending]);

  useEffect(() => {
    if (!account?.authenticated || !account.user) {
      setBookings([]);
      return;
    }

    let cancelled = false;

    async function loadBookings() {
      setBookingsLoading(true);
      try {
        const response = await fetch("/api/customer/bookings", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) setBookings([]);
          return;
        }
        if (!cancelled) {
          setBookings(readBookingsPayload(await response.json()));
        }
      } finally {
        if (!cancelled) {
          setBookingsLoading(false);
        }
      }
    }

    loadBookings();
    return () => {
      cancelled = true;
    };
  }, [account?.authenticated, account?.user]);

  const user = account?.user ?? null;
  const confirmedRides = useMemo(
    () => bookings.filter((booking) => rideStatuses.has(booking.status)),
    [bookings]
  );
  const pendingCount = useMemo(
    () => bookings.filter((booking) => pendingStatuses.has(booking.status)).length,
    [bookings]
  );
  const cancelledCount = useMemo(
    () => bookings.filter((booking) => booking.status === "cancelled").length,
    [bookings]
  );
  const totalSpend = useMemo(
    () =>
      confirmedRides.reduce(
        (sum, booking) => sum + Number(booking.quote?.total_payable ?? 0),
        0
      ),
    [confirmedRides]
  );

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        }
      }
    });
  }

  async function handleGoogleSignIn() {
    setError("");
    const result = await startGoogleSignIn("/profile");
    if (!result.ok) {
      setError(result.error);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE" || deleting) return;
    setDeleting(true);
    setError("");

    try {
      const response = await fetch("/api/account/me", { method: "DELETE" });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed: ${response.status} ${errText}`);
      }
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = "/";
          }
        }
      });
      window.location.href = "/";
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this account right now.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="section-shell min-h-[calc(100vh-72px)] py-10 sm:py-14">
        <div className="card p-6">
          <div className="h-6 w-36 animate-pulse rounded-full bg-[color:var(--color-paper-3)]" />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="h-28 animate-pulse rounded-[var(--radius-md)] bg-[color:var(--color-paper-2)]" />
            <div className="h-28 animate-pulse rounded-[var(--radius-md)] bg-[color:var(--color-paper-2)]" />
            <div className="h-28 animate-pulse rounded-[var(--radius-md)] bg-[color:var(--color-paper-2)]" />
          </div>
        </div>
      </main>
    );
  }

  if (!account?.authenticated || !user) {
    return (
      <main className="section-shell min-h-[calc(100vh-72px)] py-10 sm:py-14">
        <section className="card grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
          <div className="min-w-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-ink)] text-[color:var(--color-accent)]">
              <UserRound className="h-5 w-5" />
            </div>
            <h1 className="mt-6 text-4xl font-bold text-[color:var(--color-ink)] sm:text-5xl">
              Your rental profile
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--color-copy)]">
              Sign in to view confirmed rides, active requests, profile details, and account controls.
            </p>
            {account?.accountDeleted ? (
              <div className="mt-5 rounded-[var(--radius-md)] border border-[color:var(--color-danger)]/35 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                This account was deleted. Contact RBA support if you need access restored.
              </div>
            ) : null}
            {error ? (
              <div className="mt-5 rounded-[var(--radius-md)] border border-[color:var(--color-danger)]/35 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-4">
            <button type="button" onClick={handleGoogleSignIn} className="btn-primary w-full">
              Continue with Google
            </button>
            <Link href="/login" className="btn-secondary w-full">
              Email sign in
            </Link>
            <Link href="/browse" className="nav-focus text-center text-sm font-bold text-[color:var(--color-copy)] hover:text-[color:var(--color-ink)]">
              Browse bikes first
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="section-shell py-8 sm:py-12">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card min-w-0 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-ink)] text-2xl font-black text-[color:var(--color-accent)]">
                {accountInitial(user)}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-3xl font-bold text-[color:var(--color-ink)] sm:text-4xl">
                  {user.name || "RBA Customer"}
                </h1>
                <p className="mt-1 text-sm text-[color:var(--color-copy)]">
                  Account profile and ride history
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/browse" className="btn-primary">
                <Bike className="h-4 w-4" />
                New booking
              </Link>
              <button type="button" onClick={handleSignOut} className="btn-secondary">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted)]">Confirmed rides</p>
              <p className="mt-2 text-3xl font-black text-[color:var(--color-ink)]">{confirmedRides.length}</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted)]">Pending requests</p>
              <p className="mt-2 text-3xl font-black text-[color:var(--color-ink)]">{pendingCount}</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted)]">Cancelled</p>
              <p className="mt-2 text-3xl font-black text-[color:var(--color-ink)]">{cancelledCount}</p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted)]">Ride value</p>
              <p className="mt-2 text-3xl font-black text-[color:var(--color-ink)]">{currency.format(totalSpend)}</p>
            </div>
          </div>
        </div>

        <aside className="card min-w-0 p-5 sm:p-6">
          <h2 className="text-xl font-bold text-[color:var(--color-ink)]">Account details</h2>
          <div className="mt-5 space-y-3">
            <ProfileFact icon={<Mail className="h-4 w-4" />} label="Email" value={user.email || session?.user?.email || "Not added"} />
            <ProfileFact icon={<Phone className="h-4 w-4" />} label="Phone" value={user.phone || "Not added"} />
            <ProfileFact icon={<MapPin className="h-4 w-4" />} label="City" value="Bengaluru" />
            <ProfileFact icon={<ShieldCheck className="h-4 w-4" />} label="Sign-in" value="Email or Google" />
          </div>
        </aside>
      </section>

      {error ? (
        <div className="mt-5 rounded-[var(--radius-md)] border border-[color:var(--color-danger)]/35 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="card min-w-0 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[color:var(--color-ink)]">Confirmed rides</h2>
              <p className="mt-1 text-sm text-[color:var(--color-copy)]">
                Active, confirmed, extended, and completed rentals tied to this account.
              </p>
            </div>
            <Link href="/my-bookings" className="btn-secondary">
              Full booking list
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {bookingsLoading ? (
              <div className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-5 text-sm font-semibold text-[color:var(--color-copy)]">
                Loading rides...
              </div>
            ) : confirmedRides.length ? (
              confirmedRides.map((booking) => <RideCard key={booking.id} booking={booking} />)
            ) : (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-white)] text-[color:var(--color-ink)]">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <p className="mt-3 font-bold text-[color:var(--color-ink)]">No confirmed rides yet</p>
                <p className="mt-1 text-sm text-[color:var(--color-copy)]">
                  Once a booking is approved or completed, it will appear here.
                </p>
              </div>
            )}
          </div>
        </div>

        <aside className="min-w-0 space-y-5">
          <div className="card p-5 sm:p-6">
            <h2 className="text-xl font-bold text-[color:var(--color-ink)]">Recent activity</h2>
            <div className="mt-4 space-y-3">
              {bookings.slice(0, 4).map((booking) => (
                <div key={booking.id} className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-black text-[color:var(--color-ink)]">
                      {booking.vehicle_id}
                    </p>
                    <span className={`badge badge-${booking.status}`}>{formatStatus(booking.status)}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[color:var(--color-copy)]">
                    {formatDateTime(booking.pickup_at)}
                  </p>
                </div>
              ))}
              {!bookings.length ? (
                <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-4 text-sm text-[color:var(--color-copy)]">
                  No booking activity yet.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-red-200 bg-red-50 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-red-700">
                <Trash2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-red-950">Delete account</h2>
                <p className="mt-2 text-sm leading-6 text-red-800">
                  This anonymizes profile details and keeps booking records for operational history.
                </p>
              </div>
            </div>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-red-900">
                Type DELETE to confirm
              </span>
              <input
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                className="field-control border-red-200 bg-white"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== "DELETE" || deleting}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-red-300 bg-red-700 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-red-800 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Deleting..." : "Delete account"}
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

function ProfileFact({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-white)] text-[color:var(--color-ink)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted)]">{label}</p>
        <p className="truncate text-sm font-black text-[color:var(--color-ink)]">{value}</p>
      </div>
    </div>
  );
}

function RideCard({ booking }: { booking: Booking }) {
  return (
    <article className="grid gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="max-w-full break-words text-lg font-bold text-[color:var(--color-ink)]">
            {booking.vehicle_id}
          </h3>
          <span className={`badge badge-${booking.status}`}>{formatStatus(booking.status)}</span>
        </div>
        <p className="mt-2 break-words text-xs font-semibold text-[color:var(--color-muted)]">
          {booking.id}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted)]">Pickup</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--color-ink)]">{formatDateTime(booking.pickup_at)}</p>
            <p className="mt-1 text-xs text-[color:var(--color-copy)]">{booking.pickup_zone || "Bengaluru"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted)]">Drop</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--color-ink)]">{formatDateTime(booking.drop_at)}</p>
            <p className="mt-1 text-xs text-[color:var(--color-copy)]">{booking.km_limit_value} km included</p>
          </div>
        </div>
      </div>
      <div className="flex flex-row items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-[color:var(--color-white)] p-3 sm:min-w-[150px] sm:flex-col sm:items-end sm:justify-center">
        <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted)]">Amount</p>
        <p className="text-xl font-black text-[color:var(--color-ink)]">
          {currency.format(Number(booking.quote?.total_payable ?? 0))}
        </p>
      </div>
    </article>
  );
}
