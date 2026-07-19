"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/app/components/Icon";
import { authClient } from "@/lib/auth/auth-client";
import { readAccountPayload } from "@/app/profile/profile-data";
import { Skeleton } from "@/components/ui/Skeleton";
import type { KycStatus } from "@/lib/types/domain";

const STATUS_COPY: Record<
  KycStatus,
  { title: string; body: string; tone: "neutral" | "progress" | "success" | "warning" | "danger" }
> = {
  not_started: {
    title: "Verify your identity",
    body: "Complete DigiLocker verification so we can review your booking. Aadhaar and driving licence are required.",
    tone: "neutral"
  },
  in_progress: {
    title: "Verification in progress",
    body: "Finish the DigiLocker consent flow or wait while we sync your documents.",
    tone: "progress"
  },
  verified: {
    title: "Identity verified",
    body: "Your documents are verified. Bookings move to admin review automatically.",
    tone: "success"
  },
  manual_review: {
    title: "Under manual review",
    body: "We received your documents but need an admin to confirm them before payment opens.",
    tone: "warning"
  },
  failed: {
    title: "Verification failed",
    body: "DigiLocker could not verify your documents. Try again or contact support.",
    tone: "danger"
  },
  expired: {
    title: "Verification expired",
    body: "Your previous verification session expired. Start a new DigiLocker check.",
    tone: "warning"
  }
};

const STEPS = ["Start", "DigiLocker", "Review", "Done"];

function stepIndex(status: KycStatus) {
  if (status === "not_started" || status === "failed" || status === "expired") return 0;
  if (status === "in_progress") return 1;
  if (status === "manual_review") return 2;
  return 3;
}

function toneClass(tone: (typeof STATUS_COPY)[KycStatus]["tone"]) {
  if (tone === "success") return "border-green-200 bg-green-50 text-green-900";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-900";
  if (tone === "progress") return "border-blue-200 bg-blue-50 text-blue-900";
  return "border-[color:var(--color-line)] bg-[color:var(--color-paper-2)] text-[color:var(--color-ink)]";
}

export default function KycPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [userId, setUserId] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState<KycStatus>("not_started");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const returnTo = searchParams.get("return") ?? "/my-bookings";

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const accountRes = await fetch("/api/account/me", { credentials: "include" });
      const accountJson = await accountRes.json();
      const account = readAccountPayload(accountJson);
      if (!account.authenticated || !account.user) {
        router.push(`/login?next=${encodeURIComponent("/kyc")}`);
        return;
      }
      setUserId(account.user.id);
      setKycStatus(account.user.kyc_status);

      const kycRes = await fetch(`/api/kyc/${account.user.id}`, { credentials: "include" });
      const kycJson = await kycRes.json();
      if (kycRes.ok && kycJson.ok && kycJson.data?.status) {
        setKycStatus(kycJson.data.status);
      }
    } catch {
      setError("Could not load verification status.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (sessionPending) return;
    if (!session?.user) {
      router.push(`/login?next=${encodeURIComponent("/kyc")}`);
      return;
    }
    void loadStatus();
  }, [session, sessionPending, router, loadStatus]);

  async function startVerification() {
    if (!userId) return;
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/kyc/digilocker/start", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "Could not start verification.");
        return;
      }
      if (json.data?.redirect_url) {
        window.location.href = json.data.redirect_url;
        return;
      }
      setKycStatus("in_progress");
    } catch {
      setError("Could not start verification.");
    } finally {
      setStarting(false);
    }
  }

  const copy = STATUS_COPY[kycStatus];
  const activeStep = stepIndex(kycStatus);
  const canStart = ["not_started", "failed", "expired", "in_progress"].includes(kycStatus);

  return (
    <div className="min-h-screen bg-[color:var(--color-paper)]">
      <section className="border-b border-[color:var(--color-line)] bg-[color:var(--color-ink)] py-10 text-white sm:py-14">
        <div className="section-shell">
          <p className="mb-2 text-sm font-semibold text-[color:var(--color-accent)]">Identity verification</p>
          <h1 className="max-w-2xl text-4xl font-black sm:text-5xl">Verify once, ride sooner.</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">
            DigiLocker confirms your Aadhaar and driving licence. Admin review opens after verification.
          </p>
        </div>
      </section>

      <section className="section-shell py-10">
        {loading ? (
          <div className="mx-auto max-w-2xl space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
            {error ? (
              <div className="error-banner">{error}</div>
            ) : null}

            <div className={`rounded-xl border p-5 ${toneClass(copy.tone)}`}>
              <div className="flex items-start gap-3">
                <Icon name="shield" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h2 className="text-lg font-black">{copy.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed opacity-90">{copy.body}</p>
                </div>
              </div>
            </div>

            <ol className="grid gap-3 sm:grid-cols-4">
              {STEPS.map((label, index) => {
                const done = index < activeStep;
                const current = index === activeStep;
                return (
                  <li
                    key={label}
                    className={`rounded-lg border px-3 py-3 text-center text-sm ${
                      current
                        ? "border-[color:var(--color-ink)] bg-white font-bold text-[color:var(--color-ink)]"
                        : done
                          ? "border-[color:var(--color-line)] bg-[color:var(--color-paper-2)] text-[color:var(--color-copy)]"
                          : "border-[color:var(--color-line)] bg-white text-[color:var(--color-muted)]"
                    }`}
                  >
                    <div className="text-[11px] uppercase tracking-wider">Step {index + 1}</div>
                    <div className="mt-1">{label}</div>
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-wrap gap-3">
              {canStart ? (
                <button
                  type="button"
                  onClick={() => void startVerification()}
                  disabled={starting}
                  className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {starting ? <span className="spinner" /> : null}
                  {kycStatus === "in_progress" ? "Continue DigiLocker" : "Verify with DigiLocker"}
                </button>
              ) : null}
              <Link href={returnTo} className="btn-secondary">
                Back to bookings
              </Link>
              <button type="button" onClick={() => void loadStatus()} className="btn-secondary">
                Refresh status
              </button>
            </div>

            <div className="rounded-lg border border-dashed border-[color:var(--color-line)] bg-white p-4 text-sm text-[color:var(--color-copy)]">
              <p className="font-semibold text-[color:var(--color-ink)]">What we check</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Aadhaar via DigiLocker consent</li>
                <li>Valid driving licence</li>
                <li>Admin approval before payment opens</li>
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
