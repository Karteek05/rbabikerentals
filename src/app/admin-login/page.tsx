"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import {
  fetchAccountRole,
  resolvePostLoginPath,
  resolveSafeReturnTo
} from "@/lib/auth/post-login-redirect";
import Icon from "@/app/components/Icon";
import { motion } from "framer-motion";

function AdminLoginForm() {
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
    setError("This account does not have admin access.");
  }, [router, returnTo]);

  useEffect(() => {
    if (session?.user) {
      redirectAuthenticatedUser();
    }
  }, [session?.user, redirectAuthenticatedUser]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@rbabikerentals.com")) {
      setError("Unauthorized. Admin access requires an @rbabikerentals.com email address.");
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
      if (role !== "admin") {
        setError("This account does not have admin access.");
        return;
      }

      router.push(resolvePostLoginPath({ role, returnTo, fallback: "/admin" }));
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
          <h1 className="text-4xl font-black text-brand-dark">Admin Sign in</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#526074]">Secure staff access.</p>
        </div>

        <div className="rounded-2xl border border-brand-dark/10 bg-white p-6 shadow-[rgba(0,0,0,0.08)_0px_8px_24px]">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#526074] uppercase tracking-wider">Email</span>
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
              <div className="mb-1.5 flex items-center justify-between">
                <span className="block text-xs font-bold text-[#526074] uppercase tracking-wider">Password</span>
              </div>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-2 text-sm font-bold"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f7f7]" />}>
      <AdminLoginForm />
    </Suspense>
  );
}
