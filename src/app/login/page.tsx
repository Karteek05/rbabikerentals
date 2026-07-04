"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { isGoogleAuthEnabled, startGoogleSignIn } from "@/lib/auth/google-sign-in";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import { motion } from "framer-motion";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: session } = authClient.useSession();

  // Redirect if already logged in
  useEffect(() => {
    if (searchParams.get("mode") === "register") {
      router.replace("/signup");
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (session?.user) {
      const role = (session.user as any).role as string;
      if (role === "admin") router.push("/admin");
      else if (role === "partner_investor") router.push("/partner");
      else if (role === "customer") router.push("/customer");
      else router.push("/");
    }
  }, [session, router]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await authClient.signIn.email({
      email,
      password,
    });

    if (error) {
      setError(error.message || "Failed to sign in. Please check your credentials.");
      setLoading(false);
    } else {
      // The useEffect will handle redirect once session updates
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    const result = await startGoogleSignIn("/profile");
    if (!result.ok) {
      setError(result.error);
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
          <h1 className="text-4xl font-black text-brand-dark">Sign in</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#526074]">Book scooters, view rentals, and keep your account handy.</p>
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
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="block">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="block text-xs font-bold text-[#526074] uppercase tracking-wider">Password</span>
                <Link href="/forgot-password" className="text-[10px] font-bold text-brand-dark hover:underline">Forgot?</Link>
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

          {isGoogleAuthEnabled ? (
            <>
              <div className="my-6 flex items-center">
                <div className="flex-1 border-t border-brand-dark/10"></div>
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#afafaf]">Or</span>
                <div className="flex-1 border-t border-brand-dark/10"></div>
              </div>

              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-full border border-brand-dark/20 bg-white text-brand-dark px-5 py-3 text-sm font-bold transition-colors hover:bg-[#f7f7f7] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>
            </>
          ) : null}
        </div>

        <p className="mt-6 text-center text-sm text-[#526074]">
          Don't have an account?{" "}
          <Link href="/signup" className="font-bold text-brand-dark hover:underline">
            Sign up
          </Link>
        </p>

        <div className="mt-4 rounded-xl border border-brand-dark/10 bg-white/70 backdrop-blur-md p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-brand-dark">
            <Icon name="settings" className="h-4 w-4" />
            Staff dashboard access
          </div>
          <div className="grid grid-cols-1">
            <Link href="/staff-login" className="btn-secondary text-center text-xs py-2 block">
              Staff Access (Admin / Partner)
            </Link>
          </div>
        </div>
        
        <p className="text-center text-[10px] text-[#afafaf] mt-8">
          By signing in, you agree to our{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-[#526074]"
          >
            Terms &amp; Conditions
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-[#526074]"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f7f7]" />}>
      <LoginForm />
    </Suspense>
  );
}
