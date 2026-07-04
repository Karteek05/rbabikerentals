"use client";

import { useCallback, useEffect, useState } from "react";
import Icon, { type IconName } from "../components/Icon";
import { PUBLIC_FLEET_BY_ID } from "@/lib/fleet/catalog";
import { formatBookingReference, getVehicleDisplayName } from "@/lib/fleet/display";
import { formatBookingStatus } from "@/lib/bookings/status-labels";
import { openRazorpayCheckout } from "@/lib/payments/razorpay-checkout-client";
import { authClient } from "@/lib/auth/auth-client";

type Booking = {
  id: string;
  status: string;
  vehicle_id: string;
  pickup_at: string;
  drop_at: string;
  pickup_zone?: string | null;
  quote: {
    total_payable: number;
    base_amount?: number;
    duration_amount?: number;
  };
  cancel_reason?: string;
};

type NotificationItem = {
  id: string;
  template_key: string;
  payload: Record<string, unknown>;
  created_at: string;
};

const API_HEADERS = {
  "Content-Type": "application/json"
};

const fetchOptions = {
  credentials: "include" as const,
  headers: API_HEADERS
};


const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID || "rbabikerentals@upi";

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-black text-white",
  ongoing: "bg-zinc-700 text-white",
  completed: "bg-uber-chip-gray text-black",
  cancelled: "bg-red-100 text-red-800",
  draft: "bg-uber-chip-gray text-uber-body-gray",
  pending_kyc: "bg-amber-100 text-amber-800",
  payment_pending: "bg-amber-100 text-amber-800",
  extended: "bg-zinc-600 text-white",
  extension_requested: "bg-zinc-500 text-white"
};

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-uber-chip-gray text-black";
  return <span className={`badge ${cls} text-xs`}>{formatBookingStatus(status)}</span>;
}

function getUpiLink(booking: Booking) {
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: "RBA Bike Rentals",
    am: booking.quote.total_payable.toFixed(2),
    cu: "INR",
    tn: `RBA booking ${booking.id}`
  });
  return `upi://pay?${params.toString()}`;
}

function getQrImageUrl(booking: Booking) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(getUpiLink(booking))}`;
}

export default function MyBookingsPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const customerName = session?.user?.name || session?.user?.email || "Customer";
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [qrBookingId, setQrBookingId] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const fetchBookings = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/customer/bookings", fetchOptions);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Failed to load bookings");
      } else {
        setBookings(json.data.bookings);
      }
    } catch {
      setError("Network error. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=5", fetchOptions);
      const json = await res.json();
      if (res.ok && json.ok) {
        setNotifications(json.data.items);
      }
    } catch {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    if (sessionPending) return;
    if (!session?.user) {
      setBookings([]);
      setNotifications([]);
      setError("Please sign in to view your bookings.");
      setLoading(false);
      return;
    }
    fetchBookings();
    fetchNotifications();
  }, [fetchBookings, fetchNotifications, session?.user?.id, sessionPending]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pay")) {
      setTab("payment_pending");
    }
  }, []);

  async function handlePay(booking: Booking) {
    setActionLoading(`pay-${booking.id}`);
    setError(null);
    try {
      const res = await fetch("/api/payments/order", {
        method: "POST",
        ...fetchOptions,
        body: JSON.stringify({ booking_id: booking.id })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setQrBookingId(booking.id);
        setError(json?.error?.message ?? "Could not start Razorpay checkout. Use the UPI QR below.");
        return;
      }
      const order = json.data.order;
      if (order?.provider === "upi_fallback" || !order?.key_id || !order?.order_id) {
        setQrBookingId(booking.id);
        setError("Razorpay checkout is not configured. Use the UPI QR below.");
        return;
      }

      const vehicleName = getVehicleDisplayName(booking.vehicle_id);
      await openRazorpayCheckout({
        keyId: order.key_id,
        amount: order.amount,
        currency: order.currency,
        orderId: order.order_id,
        description: `${vehicleName} booking`,
        prefill: {
          name: customerName,
          email: session?.user?.email ?? undefined
        },
        onSuccess: () => {
          showSuccess("Payment submitted. Your booking will update after Razorpay confirms payment.");
          setQrBookingId(null);
        },
        onDismiss: () => {
          setError("Payment window closed before completion.");
        },
        onFailure: (message) => {
          setError(message);
        }
      });
    } catch (payError) {
      setQrBookingId(booking.id);
      setError(
        payError instanceof Error
          ? payError.message
          : "Payment checkout is unavailable right now. Use the UPI QR below."
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Are you sure you want to cancel this booking? Cancellation charges may apply.")) return;
    setActionLoading(`cancel-${id}`);
    try {
      const res = await fetch(`/api/bookings/${id}/cancel`, {
        method: "POST",
        ...fetchOptions,
        body: JSON.stringify({ reason: "Customer requested cancellation" })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Cancel failed");
      } else {
        showSuccess("Booking cancelled.");
        await fetchBookings();
      }
    } catch {
      setError("Network error.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExtend(booking: Booking) {
    setActionLoading(`extend-${booking.id}`);
    setError(null);
    const drop = new Date(Date.now() + 24 * 3_600_000).toISOString();
    try {
      const res = await fetch(`/api/bookings/${booking.id}/extend`, {
        method: "POST",
        ...fetchOptions,
        body: JSON.stringify({
          requested_drop_at: drop,
          duration_bucket: "day",
          duration_value: 1
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Extend failed");
        return;
      }

      const paymentOrder = json.data?.payment_order;
      if (paymentOrder?.order_id && paymentOrder?.key_id) {
        const vehicleName = getVehicleDisplayName(booking.vehicle_id);
        await openRazorpayCheckout({
          keyId: paymentOrder.key_id,
          amount: paymentOrder.amount,
          currency: paymentOrder.currency ?? "INR",
          orderId: paymentOrder.order_id,
          description: `${vehicleName} extension`,
          prefill: {
            name: customerName,
            email: session?.user?.email ?? undefined
          },
          onSuccess: () => {
            showSuccess("Extension payment submitted. Your booking updates after Razorpay confirms payment.");
          },
          onDismiss: () => {
            setError("Extension payment window closed before completion.");
          },
          onFailure: (message) => {
            setError(message);
          }
        });
      } else {
        showSuccess("Booking extended by 1 day.");
      }
      await fetchBookings();
    } catch (payError) {
      setError(
        payError instanceof Error
          ? payError.message
          : "Extension checkout is unavailable right now."
      );
    } finally {
      setActionLoading(null);
    }
  }

  const TABS = [
    { key: "all", label: "All" },
    { key: "pending_kyc", label: "Pending review" },
    { key: "admin_review", label: "Review" },
    { key: "payment_pending", label: "Pay" },
    { key: "confirmed", label: "Confirmed" },
    { key: "ongoing", label: "Ongoing" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" }
  ];

  const filtered = tab === "all" ? bookings : bookings.filter((b) => b.status === tab);

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-black/10 py-8">
        <div className="max-w-container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">My Bookings</h1>
            <p className="text-uber-body-gray text-sm mt-1">
              {bookings.length} booking{bookings.length !== 1 ? "s" : ""} · Signed in as {customerName}
            </p>
          </div>
          <a href="/browse" className="btn-primary text-sm py-2.5 px-5">
            New Booking
          </a>
        </div>
      </div>

      <div className="max-w-container mx-auto px-4 sm:px-6 py-8">
        {successMsg && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm inline-flex items-center gap-2">
            <Icon name="checkCircle" className="w-4 h-4" />
            {successMsg}
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800 text-sm flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <Icon name="warning" className="w-4 h-4" />
              {error}
            </span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600" aria-label="Dismiss error">
              <Icon name="close" className="w-4 h-4" />
            </button>
          </div>
        )}

        {notifications.length > 0 && (
          <div className="mb-6 bg-uber-chip-gray rounded-xl p-4">
            <div className="text-xs font-semibold uppercase text-uber-body-gray mb-2">Latest updates</div>
            <div className="grid gap-2">
              {notifications.map((item) => (
                <div key={item.id} className="text-sm flex items-center justify-between gap-3">
                  <span className="font-medium">{item.template_key.replace(/_/g, " ")}</span>
                  <span className="text-xs text-uber-muted-gray">{fmt(item.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`chip ${tab === t.key ? "chip-active" : ""}`}
            >
              {t.label}
              {t.key !== "all" && bookings.filter((b) => b.status === t.key).length > 0 && (
                <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${tab === t.key ? "bg-white/20 text-white" : "bg-black/10"}`}>
                  {bookings.filter((b) => b.status === t.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <svg className="animate-spin w-8 h-8 mx-auto mb-4 text-uber-body-gray" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-uber-body-gray">Loading bookings...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mx-auto mb-4">
              <Icon name="list" className="w-8 h-8 text-black/60" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{tab === "all" ? "No bookings yet" : `No ${tab} bookings`}</h2>
            <p className="text-uber-body-gray mb-6">
              {tab === "all" ? "Start by browsing available bikes." : "Try switching to a different tab."}
            </p>
            <a href="/browse" className="btn-primary">
              Browse Bikes
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((booking) => {
              const isActionable = ["confirmed", "ongoing", "extended"].includes(booking.status);
              const isCancellable = ["confirmed", "pending_kyc", "admin_review", "payment_pending"].includes(booking.status);
              const actCancel = actionLoading === `cancel-${booking.id}`;
              const actExtend = actionLoading === `extend-${booking.id}`;
              const actPay = actionLoading === `pay-${booking.id}`;
              const vIcon: IconName = "scooter";
              const vName = getVehicleDisplayName(booking.vehicle_id);
              const vehicle = PUBLIC_FLEET_BY_ID[booking.vehicle_id];

              return (
                <div key={booking.id} className="card border border-black/5 hover:shadow-card-md transition-shadow">
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative h-28 w-40 flex-shrink-0 overflow-hidden rounded-lg bg-uber-chip-gray">
                        {vehicle ? (
                          <img
                            src={vehicle.image}
                            alt={vehicle.imageAlt}
                            className="h-full w-full object-contain p-2"
                            onError={(event) => {
                              event.currentTarget.src = vehicle.fallbackImage;
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-black">
                            <Icon name={vIcon} className="w-10 h-10" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                          <h3 className="font-bold text-lg">{vName}</h3>
                          <StatusBadge status={booking.status} />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm mb-3">
                          <div>
                            <span className="text-xs text-uber-body-gray block">Pickup</span>
                            <span className="font-medium">{fmt(booking.pickup_at)}</span>
                          </div>
                          <div>
                            <span className="text-xs text-uber-body-gray block">Drop</span>
                            <span className="font-medium">{fmt(booking.drop_at)}</span>
                          </div>
                          <div>
                            <span className="text-xs text-uber-body-gray block">Total</span>
                            <span className="font-bold text-black">₹{booking.quote.total_payable.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-xs text-uber-body-gray block">Pickup zone</span>
                            <span className="font-medium">{booking.pickup_zone ?? "Bengaluru"}</span>
                          </div>
                        </div>

                        <div className="text-xs text-uber-muted-gray">
                          Ref: {formatBookingReference(booking.id)}
                        </div>
                        {booking.cancel_reason && <p className="text-xs text-red-600 mt-1">Reason: {booking.cancel_reason}</p>}
                      </div>
                    </div>

                    {(isActionable || isCancellable) && (
                      <div className="mt-4 pt-4 border-t border-black/5 flex gap-3 flex-wrap">
                      {(isActionable || booking.status === "payment_pending") && (
                        <button
                          onClick={() =>
                            booking.status === "payment_pending" ? handlePay(booking) : handleExtend(booking)
                          }
                          disabled={booking.status === "payment_pending" ? actPay : actExtend}
                          className="btn-primary text-sm py-2 px-5 disabled:opacity-50"
                        >
                          {booking.status === "payment_pending"
                            ? actPay
                              ? "Opening..."
                              : "Pay Now"
                            : actExtend
                              ? "Extending..."
                              : "Extend +1 Day"}
                        </button>
                      )}
                        {isCancellable && (
                          <button
                            onClick={() => handleCancel(booking.id)}
                            disabled={actCancel}
                            className="btn-secondary text-sm py-2 px-5 disabled:opacity-50"
                          >
                            {actCancel ? "Cancelling..." : "Cancel Booking"}
                          </button>
                        )}
                      </div>
                    )}

                    {booking.status === "payment_pending" && qrBookingId === booking.id ? (
                      <div className="mt-4 grid gap-4 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper)] p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                        <div className="rounded-lg border border-[color:var(--color-line)] bg-white p-3">
                          <img
                            src={getQrImageUrl(booking)}
                            alt={`UPI QR for booking ${booking.id}`}
                            className="mx-auto h-36 w-36 object-contain sm:h-40 sm:w-40"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="mb-1 text-xs font-bold uppercase text-[color:var(--color-muted)]">
                            UPI payment
                          </div>
                          <h4 className="text-lg font-black text-[color:var(--color-ink)]">Scan to pay ₹{booking.quote.total_payable.toLocaleString()}</h4>
                          <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-copy)]">
                            Use this QR only after the admin has approved the booking. Keep the booking ID in the payment note.
                          </p>
                          <div className="mt-3 grid gap-2 text-sm">
                            <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                              <span className="text-[color:var(--color-muted)]">UPI ID</span>
                              <span className="truncate font-bold text-[color:var(--color-ink)]">{UPI_ID}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                              <span className="text-[color:var(--color-muted)]">Booking ID</span>
                              <span className="truncate font-mono text-xs font-bold text-[color:var(--color-ink)]">{booking.id}</span>
                            </div>
                          </div>
                          <a href={getUpiLink(booking)} className="btn-primary mt-4 inline-flex text-sm">
                            Open UPI App
                          </a>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
