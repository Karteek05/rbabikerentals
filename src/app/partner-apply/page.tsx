"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import Icon from "@/app/components/Icon";
import { motion } from "framer-motion";

type ApplicationState = {
  partner_application_status: string | null;
  partner_rejection_reason: string | null;
  is_approved_partner: boolean;
};

function PartnerApplyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [application, setApplication] = useState<ApplicationState | null>(null);

  const { data: session } = authClient.useSession();

  const loadApplication = useCallback(async () => {
    const res = await fetch("/api/partner/application", { credentials: "include" });
    const json = await res.json();
    if (!res.ok || !json.ok) return null;
    return json.data as ApplicationState;
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    loadApplication()
      .then((data) => {
        if (data) setApplication(data);
      })
      .catch(() => undefined);
  }, [session?.user, loadApplication]);

  async function submitApplication() {
    const res = await fetch("/api/partner/apply", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        partner_business_name: businessName.trim() || undefined,
        message: message.trim() || undefined
      })
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json?.error?.message ?? "Failed to submit application");
    }
    const next = await loadApplication();
    if (next) setApplication(next);
  }

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error: signUpError } = await authClient.signUp.email({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim()
      });
      if (signUpError) {
        setError(signUpError.message || "Failed to register.");
        return;
      }

      const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim().toLowerCase(),
        type: "email-verification"
      });
      if (otpError) {
        setError(otpError.message || "Failed to send verification email.");
        return;
      }
      setShowOtp(true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error: verifyError } = await authClient.emailOtp.verifyEmail({
        email: normalizedEmail,
        otp
      });
      if (verifyError) {
        setError(verifyError.message || "Invalid or expired OTP.");
        return;
      }

      const { error: signInError } = await authClient.signIn.email({
        email: normalizedEmail,
        password
      });
      if (signInError) {
        setError(signInError.message || "Email verified, but sign-in failed.");
        return;
      }

      await submitApplication();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApplySignedIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await submitApplication();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (application?.is_approved_partner) {
    return (
      <StatusCard
        title="You are an approved partner"
        body="Sign in to access your fleet dashboard."
        action={
          <Link href="/partner-login" className="btn btn-primary">
            Go to partner login
          </Link>
        }
      />
    );
  }

  if (application?.partner_application_status === "pending") {
    return (
      <StatusCard
        title="Application under review"
        body="Our team is reviewing your partner application. You will receive an email once it is approved."
      />
    );
  }

  if (application?.partner_application_status === "rejected") {
    return (
      <StatusCard
        title="Application not approved"
        body={
          application?.partner_rejection_reason
            ? `Reason: ${application.partner_rejection_reason}`
            : "Your previous application was not approved."
        }
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setApplication(null);
              router.replace("/partner-apply");
            }}
          >
            Submit a new application
          </button>
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f7] px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-md flex-col justify-center"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-dark text-white">
            <Icon name={showOtp ? "mail" : "briefcase"} className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-black text-brand-dark">
            {showOtp ? "Verify email" : "Partner with RBA"}
          </h1>
          <p className="mt-2 text-sm text-[#526074]">
            {showOtp
              ? `Enter the code sent to ${email}`
              : "Apply to list your fleet on RBA. Admin approval is required before dashboard access."}
          </p>
        </div>

        <div className="rounded-2xl border border-brand-dark/10 bg-white p-6 shadow-[rgba(0,0,0,0.08)_0px_8px_24px]">
          {error ? (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm font-medium text-red-600">
              {error}
            </div>
          ) : null}

          {session?.user && !showOtp ? (
            <form onSubmit={handleApplySignedIn} className="space-y-4">
              <label className="block">
                <span className="form-label">Business name</span>
                <input
                  className="form-input"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder="Your fleet or business name"
                />
              </label>
              <label className="block">
                <span className="form-label">Phone</span>
                <input
                  className="form-input"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="10-digit mobile number"
                />
              </label>
              <label className="block">
                <span className="form-label">Notes for admin</span>
                <textarea
                  className="form-input"
                  rows={3}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Fleet size, operating area, etc."
                />
              </label>
              <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                {loading ? "Submitting…" : "Submit application"}
              </button>
            </form>
          ) : !showOtp ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <label className="block">
                <span className="form-label">Full name</span>
                <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className="block">
                <span className="form-label">Email</span>
                <input
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="form-label">Password</span>
                <input
                  className="form-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </label>
              <label className="block">
                <span className="form-label">Phone</span>
                <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="block">
                <span className="form-label">Business name</span>
                <input
                  className="form-input"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </label>
              <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                {loading ? "Creating account…" : "Create account & apply"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <label className="block">
                <span className="form-label">6-digit OTP</span>
                <input
                  className="form-input text-center text-xl tracking-widest"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  required
                />
              </label>
              <button
                type="submit"
                className="btn-primary w-full py-3"
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying…" : "Verify & submit application"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-[#526074]">
            Already approved?{" "}
            <Link href="/partner-login" className="font-semibold text-brand-dark underline">
              Partner sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function StatusCard({
  title,
  body,
  action
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
      <div className="max-w-md rounded-2xl border border-brand-dark/10 bg-white p-8 text-center shadow-card">
        <h1 className="text-2xl font-black text-brand-dark">{title}</h1>
        <p className="mt-3 text-sm text-[#526074]">{body}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}

export default function PartnerApplyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f7f7]" />}>
      <PartnerApplyForm />
    </Suspense>
  );
}
