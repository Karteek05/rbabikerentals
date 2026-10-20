"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Sidebar from "@/app/components/Sidebar";
import Icon from "@/app/components/Icon";
import { ADMIN_NAV_ITEMS } from "@/app/components/admin/admin-nav";
import { useToast } from "@/app/components/ToastProvider";
type Mode = "payments" | "incidents" | "policies" | "locations" | "settlements";
type AnyRow = Record<string, unknown>;
const title: Record<Mode, string> = { payments: "Payments & refunds", incidents: "Incident triage", policies: "Policies & promotions", locations: "Pickup locations", settlements: "Manual partner settlements" };

function formatCell(mode: Mode, key: string, value: unknown): string {
  if (mode === "payments" && key === "booking" && typeof value === "object" && value !== null) {
    const booking = value as AnyRow;
    return `${String(booking.id)} · ${String(booking.status)}`;
  }
  if (mode === "payments" && key === "payment" && typeof value === "object" && value !== null) {
    const payment = value as AnyRow;
    const amount = Number(payment.amount);
    const date = payment.updated_at ?? payment.created_at;
    return `${String(payment.status)} · ${Number.isFinite(amount) ? `₹${(amount / 100).toLocaleString("en-IN")}` : "amount unavailable"} · ${date ? new Date(String(date)).toLocaleDateString("en-IN") : "date unavailable"}`;
  }
  if (mode === "incidents" && key === "photo_urls" && Array.isArray(value)) return `${value.length} photo${value.length === 1 ? "" : "s"}`;
  if (mode === "settlements" && key === "amount_paise") return `₹${(Number(value) / 100).toLocaleString("en-IN")}`;
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "object" && value !== null) return "Details available";
  return String(value ?? "—");
}

function formatHeading(key: string): string {
  const labels: Record<string, string> = {
    booking: "Booking (ID · status)", payment: "Payment (status · amount · updated)",
    provider_order_id: "Provider order ID", provider_refund_id: "Provider refund ID",
    amount_paise: "Amount paid (INR)", period_start: "Period start", period_end: "Period end",
    paid_at: "Transfer date", created_at: "Recorded at", photo_urls: "Evidence",
    admin_notes: "Triage notes", discount_percent: "Discount (%)", active: "Active"
  };
  return labels[key] ?? key.replaceAll("_", " ");
}

export default function AdminOperationsPage({ mode }: { mode: Mode }) {
  const [items, setItems] = useState<AnyRow[]>([]);
  const [extra, setExtra] = useState<AnyRow>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast();
  const [deletingPromotion, setDeletingPromotion] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const set = (key: string, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/${mode}`, { credentials: "include", cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error?.message ?? "Could not load admin data.");
      const data = json.data ?? {};
      setItems(data.items ?? data.promotions ?? []);
      if (data.policy) { setForm((old) => ({ ...old, ...Object.fromEntries(Object.entries(data.policy).map(([key, value]) => [key, String(value)])) })); }
      setExtra(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load admin data."); }
    finally { setLoading(false); }
  }, [mode]);
  useEffect(() => { void load(); }, [load]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      let url = `/api/admin/${mode}`; let method = "POST"; let body: Record<string, unknown> = {};
      if (mode === "payments") { url = "/api/payments/refund"; body = { booking_id: form.booking_id, amount: form.amount ? Math.round(Number(form.amount) * 100) : undefined, reason: form.reason }; }
      if (mode === "incidents") { method = "PATCH"; body = { id: form.id, status: form.status, admin_notes: form.admin_notes }; }
      if (mode === "policies") { method = "PATCH"; body = { cancellation_over_24h_percent: Number(form.cancellation_over_24h_percent), cancellation_under_24h_percent: Number(form.cancellation_under_24h_percent), coupon_code: form.coupon_code, coupon_discount_percent: form.coupon_discount_percent ? Number(form.coupon_discount_percent) : undefined, coupon_active: form.coupon_active !== "false" }; }
      if (mode === "locations") body = { id: form.id || undefined, name: form.name, active: form.active !== "false" };
      if (mode === "settlements") body = { partner_id: form.partner_id, period_start: form.period_start, period_end: form.period_end, amount_paise: Math.round(Number(form.amount_rupees) * 100), reference: form.reference, paid_at: form.paid_at, notes: form.notes };
      const response = await fetch(url, { method, credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error?.message ?? "Could not save changes.");
      showToast({
        title: mode === "payments" ? "Refund requested" : "Changes saved",
        message: mode === "payments" ? "The payment provider accepted the refund request." : "Your update has been saved."
      });
      setForm({});
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save changes."); }
    finally { setBusy(false); }
  };
  const deletePromotion = async (code: string) => {
    if (!window.confirm(`Delete promotion ${code}? It will no longer apply to new quotes.`)) return;
    setDeletingPromotion(code);
    setError("");
    try {
      const response = await fetch("/api/admin/coupons", {
        method: "DELETE",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code })
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error?.message ?? "Could not delete promotion.");
      setItems((current) => current.filter((item) => item.code !== code));
      showToast({ title: "Promotion deleted", message: `${code} no longer applies to new quotes.` });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete promotion.");
    } finally {
      setDeletingPromotion(null);
    }
  };
  const label = (text: string, key: string, type = "text", required = false) => <label className="grid gap-1 text-sm" key={key}>{text}<input aria-label={text} name={key} autoComplete="off" className="rounded border p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700" type={type} step={type === "number" ? "0.01" : undefined} min={type === "number" ? 0 : undefined} max={type === "number" && key.includes("percent") ? 100 : undefined} value={form[key] ?? ""} required={required} onChange={(event) => set(key, event.target.value)} /></label>;
  const select = (text: string, key: string, options: Array<[string, string]>, required = true) => <label className="grid gap-1 text-sm" key={key}>{text}<select name={key} className="rounded border p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700" value={form[key] ?? ""} onChange={(event) => set(key, event.target.value)} required={required}><option value="">Choose…</option>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>;
  const renderForm = () => {
    if (mode === "payments") return <>{select("Booking", "booking_id", items.map((row) => { const b = row.booking as AnyRow; return [String(b.id), `${String(b.id)} · ${String(b.status)}`] as [string, string]; }))}{label("Refund amount in INR (blank refunds remaining balance)", "amount", "number")}{label("Reason", "reason", "text", true)}</>;
    if (mode === "incidents") return <>{select("Incident", "id", items.map((row) => [String(row.id), `${String(row.id)} · ${String(row.status ?? "open")}`]))}{select("Status", "status", [["open","Open"],["investigating","Investigating"],["resolved","Resolved"],["dismissed","Dismissed"]])}{label("Triage notes", "admin_notes")}</>;
    if (mode === "policies") return <>{label("Cancellation charge when pickup is at least 24 hours away (%)", "cancellation_over_24h_percent", "number", true)}{label("Cancellation charge when pickup is under 24 hours away (%)", "cancellation_under_24h_percent", "number", true)}{label("Promotion code", "coupon_code")}{label("Promotion discount (%)", "coupon_discount_percent", "number")}{select("Promotion active", "coupon_active", [["true","Yes"],["false","No"]], false)}<p className="text-sm text-slate-600">GST remains fixed at 18%. Configured promotion codes are applied to new server-generated quotes.</p></>;
    if (mode === "locations") return <>{label("Pickup location name", "name", "text", true)}{select("Active", "active", [["true","Yes"],["false","No"]])}</>;
    return <>{select("Partner", "partner_id", ((extra.partners as AnyRow[]) ?? []).map((row) => [String(row.id), String(row.name)]))}{label("Period start", "period_start", "date", true)}{label("Period end", "period_end", "date", true)}{label("Amount actually transferred (INR)", "amount_rupees", "number", true)}{label("Transfer reference", "reference", "text", true)}{label("Transfer date", "paid_at", "date", true)}{label("Notes", "notes")}</>;
  };
  return <div className="min-h-screen bg-slate-50 md:flex"><Sidebar role="admin" userName="Admin (ops)" navItems={ADMIN_NAV_ITEMS} /><main className="mx-auto w-full max-w-6xl p-5 md:p-8"><header className="mb-6 flex items-center gap-3"><Icon name="settings" /><div><h1 className="text-2xl font-semibold">{title[mode]}</h1><p className="text-sm text-slate-600">Admin-only operational records and controls.</p></div></header>
    {error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {mode === "payments" && <p className="mb-4 rounded bg-white p-3">Razorpay mode: <strong>{String(extra.razorpay_mode ?? (loading ? "Loading…" : "unknown"))}</strong></p>}
    <form onSubmit={submit} className="mb-8 grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-2">{renderForm()}<button disabled={busy || loading} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{busy ? "Saving…" : mode === "payments" ? "Request refund" : mode === "settlements" ? "Record actual transfer" : "Save"}</button></form>
    {loading ? <p role="status">Loading…</p> : items.length === 0 ? <p className="rounded border bg-white p-5">No records to show.</p> : <div className="overflow-x-auto rounded border bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b">{Object.keys(items[0]).map((key) => <th className="p-3" scope="col" key={key}>{formatHeading(key)}</th>)}{(mode === "locations" || mode === "policies") && <th className="p-3" scope="col">Actions</th>}</tr></thead><tbody>{items.map((row, index) => <tr className="border-b last:border-0" key={String(row.id ?? row.code ?? index)}>{Object.entries(row).map(([key, value]) => <td className="max-w-sm p-3" key={key}>{formatCell(mode, key, value)}</td>)}{mode === "locations" && <td className="p-3"><button type="button" className="rounded px-2 py-1 underline hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700" onClick={() => setForm({ id: String(row.id), name: String(row.name), active: String(row.active) })}>Edit location</button></td>}{mode === "policies" && <td className="p-3"><div className="flex flex-wrap gap-3"><button type="button" className="rounded px-2 py-1 underline hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700" onClick={() => setForm((old) => ({ ...old, coupon_code: String(row.code), coupon_discount_percent: String(row.discount_percent), coupon_active: String(row.active) }))}>Edit promotion</button><button type="button" className="rounded px-2 py-1 text-red-700 underline hover:text-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50" disabled={deletingPromotion === String(row.code)} onClick={() => void deletePromotion(String(row.code))}>{deletingPromotion === String(row.code) ? "Deleting…" : "Delete promotion"}</button></div></td>}</tr>)}</tbody></table></div>}
    {mode === "settlements" && <p className="mt-3 text-sm text-slate-600">Only actual recorded transfers are shown. No payout entitlement is calculated.</p>}</main></div>;
}
