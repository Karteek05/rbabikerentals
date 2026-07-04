"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "@/app/components/Icon";
import { authClient } from "@/lib/auth/auth-client";
import { isGoogleAuthEnabled, startGoogleSignIn } from "@/lib/auth/google-sign-in";

type LoginPromptModalProps = {
  open: boolean;
  onClose: () => void;
  onSignedIn?: () => void;
  title?: string;
  description?: string;
  returnPath?: string;
};

export default function LoginPromptModal({
  open,
  onClose,
  onSignedIn,
  title = "Sign in to continue",
  description = "Create an account or sign in to submit your booking request and track it in My Bookings.",
  returnPath
}: LoginPromptModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (!open) return;
    setError("");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && session?.user) {
      onSignedIn?.();
      onClose();
    }
  }, [open, session?.user, onClose, onSignedIn]);

  if (!open) return null;

  const signupHref = returnPath
    ? `/signup?returnTo=${encodeURIComponent(returnPath)}`
    : "/signup";

  async function handleEmailSignIn(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { error: signInError } = await authClient.signIn.email({ email, password });
    if (signInError) {
      setError(signInError.message || "Failed to sign in. Please check your credentials.");
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    const result = await startGoogleSignIn(returnPath ?? "/profile");
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close sign in dialog"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-prompt-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-black/50 transition-colors hover:bg-black/5 hover:text-black"
          aria-label="Close"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>

        <div className="mb-5 pr-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-black text-white">
            <Icon name="shield" className="h-6 w-6" />
          </div>
          <h2 id="login-prompt-title" className="text-2xl font-bold text-black">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-uber-body-gray">{description}</p>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm font-medium text-red-600">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-uber-body-gray">
              Email
            </span>
            <input
              className="w-full rounded-lg border border-black/20 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-uber-body-gray">
              Password
            </span>
            <input
              className="w-full rounded-lg border border-black/20 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-black py-3 text-sm font-bold text-white transition-colors hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {isGoogleAuthEnabled ? (
          <>
            <div className="my-4 flex items-center">
              <div className="flex-1 border-t border-black/10" />
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-uber-muted-gray">
                Or
              </span>
              <div className="flex-1 border-t border-black/10" />
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-black/20 bg-white px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-70"
            >
              Continue with Google
            </button>
          </>
        ) : null}

        <p className="mt-5 text-center text-sm text-uber-body-gray">
          Don&apos;t have an account?{" "}
          <Link href={signupHref} className="font-bold text-black hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
