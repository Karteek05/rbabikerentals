"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/auth-client";
import Link from "next/link";
import Icon from "@/app/components/Icon";
import { motion } from "framer-motion";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await (authClient as any).requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });

    if (error) {
      setError(error.message || "Something went wrong.");
    } else {
      setSuccess(true);
    }
    setLoading(false);
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
            <Icon name="mail" className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-black text-brand-dark">Forgot Password</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#526074]">Enter your email address to receive a password reset link.</p>
        </div>

        <div className="rounded-2xl border border-brand-dark/10 bg-white p-6 shadow-[rgba(0,0,0,0.08)_0px_8px_24px]">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm text-center font-medium">
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center">
              <div className="mb-4 text-green-600">
                <Icon name="checkCircle" className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-brand-dark font-bold text-lg mb-2">Check your email</p>
              <p className="text-sm text-[#526074] mb-6">
                If an account exists with {email}, you will receive a password reset link shortly.
              </p>
              <Link href="/login" className="btn-secondary w-full py-3 block text-sm font-bold">
                Return to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 mt-2 text-sm font-bold"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-[#526074]">
          Remember your password?{" "}
          <Link href="/login" className="font-bold text-brand-dark hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
