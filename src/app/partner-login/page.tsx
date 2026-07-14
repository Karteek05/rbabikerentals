"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import {
  resolvePostLoginPath,
  resolveSafeReturnTo
} from "@/lib/auth/post-login-redirect";
import Icon from "@/app/components/Icon";
import { motion } from "framer-motion";

function PartnerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const { data: session } = authClient.useSession();

  const handlePartnerAccess = useCallback(async () => {
    const res = await fetch("/api/partner/application", { credentials: "include" });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError("Could not verify partner access.");
      return;
    }

    const data = json.data;
    if (data.is_approved_partner) {
      router.push(resolvePostLoginPath({ role: "partner_investor", returnTo, fallback: "/partner" }));
      return;
    }
    if (data.partner_application_status === "pending") {
      setInfo("Your application is under admin review.");
      setError("");
      return;
    }
    if (data.partner_application_status === "rejected") {
      setError(
        data.partner_rejection_reason
          ? `Application rejected: ${data.partner_rejection_reason}`
          : "Your partner application was not approved."
      );
      return;
    }
    setError("This account does not have partner access yet.");
    setInfo("");
  }, [router, returnTo]);

  useEffect(() => {
    if (session?.user) {
      handlePartnerAccess();
    }
  }, [session?.user, handlePartnerAccess]);

  const handleEmailSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { error: signInError } = await authClient.signIn.email({
        email: normalizedEmail,
        password
      });

      if (signInError) {
        setError(signInError.message || "Failed to sign in. Please check your credentials.");
        return;
      }

      await handlePartnerAccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7] px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-md flex-col justify-center"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-dark text-white shadow-[0_8px_16px_rgba(0,0,0,0.1)]">
            <Icon name="briefcase" className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-black text-brand-dark">Partner Sign in</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#526074]">Manage your fleet investments.</p>
        </div>

        <div className="rounded-2xl border border-brand-dark/10 bg-white p-6 shadow-[rgba(0,0,0,0.08)_0px_8px_24px]">
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm font-medium text-red-600">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm font-medium text-amber-800">
              {info}{" "}
              <Link href="/partner-apply?status=pending" className="underline">
                View status
              </Link>
            </div>
          )}

          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#526074]">
                Email
              </span>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#526074]">
                Password
              </span>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>

            <button type="submit" disabled={loading} className="btn-primary mt-2 w-full py-3 text-sm font-bold">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#526074]">
            New partner?{" "}
            <Link href="/partner-apply" className="font-semibold text-brand-dark underline">
              Apply here
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function PartnerLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f7f7]" />}>
      <PartnerLoginForm />
    </Suspense>
  );
}
