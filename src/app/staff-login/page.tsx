"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import Icon from "@/app/components/Icon";
import { motion } from "framer-motion";

function StaffLoginForm() {
  const router = useRouter();
  const [role, setRole] = useState<"admin" | "partner">("admin");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");

  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (!session?.user || showOtp) return;

    let cancelled = false;

    async function redirectStaff() {
      try {
        const response = await fetch("/api/account/me", {
          credentials: "include",
          cache: "no-store"
        });
        const json = await response.json();
        if (cancelled || !response.ok || !json?.ok) return;

        const role = json.data?.user?.role as string | undefined;
        if (role === "admin") router.push("/admin");
        else if (role === "partner_investor") router.push("/partner");
        else router.push("/");
      } catch {
        if (!cancelled) router.push("/");
      }
    }

    redirectStaff();
    return () => {
      cancelled = true;
    };
  }, [session?.user, router, showOtp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "login") {
      const { error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        setError(error.message || "Failed to sign in. Please check your credentials.");
        setLoading(false);
      }
    } else {
      // Security feature: Whitelist admin/partner registration to company domain
      if (!email.toLowerCase().endsWith("@rbabikerentals.com")) {
        setError("Unauthorized: Staff registration is restricted to @rbabikerentals.com email addresses.");
        setLoading(false);
        return;
      }

      const { error } = await authClient.signUp.email({
        email,
        password,
        name
      });

      if (error) {
        setError(error.message || "Failed to register. Please try again.");
        setLoading(false);
      } else {
        const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
        if (otpError) {
          setError(otpError.message || "Failed to send verification email. Please try logging in.");
          setLoading(false);
        } else {
          setShowOtp(true);
          setLoading(false);
        }
      }
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await authClient.emailOtp.verifyEmail({ email, otp });
    
    if (error) {
      setError(error.message || "Invalid or expired OTP. Please try again.");
      setLoading(false);
    } else {
      const roleRes = await fetch("/api/account/staff-role", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: role === "admin" ? "admin" : "partner_investor" })
      });
      const roleJson = await roleRes.json();
      if (!roleRes.ok || !roleJson.ok) {
        setError(roleJson?.error?.message ?? "Account verified, but staff role assignment failed.");
        setLoading(false);
        return;
      }
      router.push(role === "admin" ? "/admin" : "/partner");
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
            <Icon name={showOtp ? "mail" : (role === "admin" ? "shield" : "briefcase")} className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-black text-brand-dark">
            {showOtp ? "Verify Email" : "Staff Access"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#526074]">
            {showOtp 
              ? `We sent a 6-digit code to ${email}. Please enter it below to verify your staff account.` 
              : (role === "admin" ? "Secure admin dashboard." : "Manage your fleet investments.")}
          </p>
        </div>

        <div className="rounded-2xl border border-brand-dark/10 bg-white p-6 shadow-[rgba(0,0,0,0.08)_0px_8px_24px]">
          
          {!showOtp && (
            <>
              <div className="mb-6 flex overflow-hidden rounded-lg border border-brand-dark/10 bg-[#f7f7f7] p-1">
                <button
                  onClick={() => setRole("admin")}
                  className={`flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                    role === "admin" ? "bg-white text-brand-dark shadow-sm" : "text-[#afafaf] hover:text-[#526074]"
                  }`}
                >
                  Admin
                </button>
                <button
                  onClick={() => setRole("partner")}
                  className={`flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                    role === "partner" ? "bg-white text-brand-dark shadow-sm" : "text-[#afafaf] hover:text-[#526074]"
                  }`}
                >
                  Partner
                </button>
              </div>

              <div className="mb-6 flex overflow-hidden border-b border-brand-dark/10">
                <button
                  onClick={() => { setMode("login"); setError(""); }}
                  className={`flex-1 pb-3 text-sm font-bold transition-colors border-b-2 ${
                    mode === "login" ? "border-brand-dark text-brand-dark" : "border-transparent text-[#afafaf] hover:text-[#526074]"
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setMode("register"); setError(""); }}
                  className={`flex-1 pb-3 text-sm font-bold transition-colors border-b-2 ${
                    mode === "register" ? "border-brand-dark text-brand-dark" : "border-transparent text-[#afafaf] hover:text-[#526074]"
                  }`}
                >
                  Register
                </button>
              </div>
            </>
          )}

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm text-center font-medium">
              {error}
            </div>
          )}

          {!showOtp ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#526074] uppercase tracking-wider">Full Name</span>
                  <input
                    className="form-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#526074] uppercase tracking-wider">Email</span>
                <input
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`${role}@rbabikerentals.com`}
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
                  minLength={8}
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 mt-2 text-sm font-bold"
              >
                {loading ? (mode === "login" ? "Signing in..." : "Registering...") : (mode === "login" ? "Sign in" : "Register")}
              </button>
            </form>
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
