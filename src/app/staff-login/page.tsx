"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";
import {
  fetchAccountRole,
  resolvePostLoginPath,
  resolveSafeReturnTo
} from "@/lib/auth/post-login-redirect";
import Icon from "@/app/components/Icon";
import PasswordInput from "@/app/components/PasswordInput";
import { motion } from "framer-motion";

function StaffLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { data: session } = authClient.useSession();

  const redirectAuthenticatedUser = useCallback(async () => {
    const role = await fetchAccountRole();
    if (role === "admin") {
      router.push(returnTo ?? "/admin");
      return;
    }
    if (role === "partner_investor") {
      router.push("/partner");
      return;
    }
    setError("This account does not have staff access.");
  }, [router, returnTo]);

  useEffect(() => {
    if (session?.user) {
      void redirectAuthenticatedUser();
    }
  }, [session?.user, redirectAuthenticatedUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@rbabikerentals.com")) {
      setError("Staff access requires an @rbabikerentals.com email address.");
      setLoading(false);
      return;
    }

    try {
      const { error: signInError } = await authClient.signIn.email({
        email: normalizedEmail,
        password
      });

      if (signInError) {
        setError(signInError.message || "Failed to sign in. Please check your credentials.");
        return;
      }

      const role = await fetchAccountRole();
      if (role === "admin") {
        router.push(resolvePostLoginPath({ role, returnTo, fallback: "/admin" }));
        return;
      }
      if (role === "partner_investor") {
        router.push("/partner");
        return;
      }
      setError("This account does not have staff access.");
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
            <Icon name="shield" className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-black text-brand-dark">Staff sign in</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#526074]">Admin and operations access only.</p>
        </div>

        <div className="rounded-2xl border border-brand-dark/10 bg-white p-6 shadow-[rgba(0,0,0,0.08)_0px_8px_24px]">
          {error ? (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm font-medium text-red-600">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#526074]">Email</span>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@rbabikerentals.com"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#526074]">Password</span>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </label>

            <button type="submit" disabled={loading} className="btn-primary mt-2 w-full py-3 text-sm font-bold">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#526074]">
            Fleet partner?{" "}
            <Link href="/partner-login" className="font-semibold text-brand-dark underline">
              Partner login
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f7f7]" />}>
      <StaffLoginForm />
    </Suspense>
  );
}
