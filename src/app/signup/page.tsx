"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { isGoogleAuthEnabled, startGoogleSignIn } from "@/lib/auth/google-sign-in";
import { resolvePostLoginPath, resolveSafeReturnTo } from "@/lib/auth/post-login-redirect";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import { motion } from "framer-motion";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = resolveSafeReturnTo(searchParams.get("returnTo"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");

  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (session?.user && !showOtp) {
      router.push(returnTo ?? "/profile");
    }
  }, [session, router, showOtp, returnTo]);

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const { error } = await authClient.signUp.email({
      email,
      password,
      name
    });

    if (error) {
      setError(error.message || "Failed to sign up. Please try again.");
      setLoading(false);
    } else {
      // Automatically send OTP
      const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
      if (otpError) {
        setError(otpError.message || "Failed to send verification email. Please try logging in.");
        setLoading(false);
      } else {
        setShowOtp(true);
        setLoading(false);
      }
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error, data } = await authClient.emailOtp.verifyEmail({ email, otp });
    
    if (error) {
      setError(error.message || "Invalid or expired OTP. Please try again.");
      setLoading(false);
    } else {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(signInError.message || "Email verified, but sign-in failed. Please try logging in.");
        setLoading(false);
        return;
      }
      router.push(resolvePostLoginPath({ role: "customer", returnTo, fallback: "/profile" }));
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError("");
    const result = await startGoogleSignIn(returnTo ?? "/profile");
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
            <Icon name={showOtp ? "mail" : "user-plus"} className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-black text-brand-dark">
            {showOtp ? "Verify Email" : "Sign up"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#526074]">
            {showOtp 
              ? `We sent a 6-digit code to ${email}. Please enter it below to verify your account.` 
              : "Create an account to book scooters and manage your rentals."}
          </p>
        </div>

        <div className="rounded-2xl border border-brand-dark/10 bg-white p-6 shadow-[rgba(0,0,0,0.08)_0px_8px_24px]">
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          {!showOtp ? (
            <>
              <form onSubmit={handleEmailSignUp} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#526074]">
                    Full Name
                  </span>
                  <input
                    className="form-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </label>
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
                    minLength={8}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#526074]">
                    Confirm Password
                  </span>
                  <input
                    className="form-input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary mt-2 w-full py-3 text-sm font-bold"
                >
                  {loading ? "Signing up..." : "Sign up"}
                </button>
              </form>

              {isGoogleAuthEnabled ? (
                <>
                  <div className="my-6 flex items-center">
                    <div className="flex-1 border-t border-brand-dark/10"></div>
                    <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#afafaf]">
                      Or
                    </span>
                    <div className="flex-1 border-t border-brand-dark/10"></div>
                  </div>

                  <button
                    onClick={handleGoogleSignUp}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-brand-dark/20 bg-white px-5 py-3 text-sm font-bold text-brand-dark transition-colors hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Continue with Google
                  </button>
                </>
              ) : null}
            </>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#526074]">
                  6-Digit OTP
                </span>
                <input
                  className="form-input text-center text-xl tracking-widest"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  maxLength={6}
                />
              </label>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="btn-primary mt-4 w-full py-3 text-sm font-bold"
              >
                {loading ? "Verifying..." : "Verify & Sign In"}
              </button>
            </form>
          )}
        </div>

        {!showOtp && (
          <p className="mt-6 text-center text-sm text-[#526074]">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-brand-dark hover:underline">
              Sign in
            </Link>
          </p>
        )}

        {!showOtp ? (
          <p className="mt-8 text-center text-[10px] text-[#afafaf]">
            By signing up, you agree to our{" "}
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
        ) : null}
      </motion.div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f7f7]" />}>
      <SignUpForm />
    </Suspense>
  );
}
