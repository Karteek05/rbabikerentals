"use client";

import { useRef, useState } from "react";
import Icon from "../components/Icon";
import { authClient } from "@/lib/auth/auth-client";

const API_HEADERS = {
  "Content-Type": "application/json"
};

type KycStatus = "idle" | "loading" | "pending" | "verified" | "failed";

const STEPS = ["Start", "Verify", "Done"] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-10">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  done
                    ? "bg-black text-white"
                    : active
                      ? "bg-black text-white ring-4 ring-uber-chip-gray"
                      : "bg-uber-chip-gray text-uber-body-gray"
                }`}
              >
                {done ? <Icon name="checkCircle" className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs mt-1.5 font-medium ${active ? "text-black" : "text-uber-muted-gray"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 mx-2 mb-4 transition-colors ${done ? "bg-black" : "bg-uber-chip-gray"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function KycPage() {
  const { data: session } = authClient.useSession();
  const [status, setStatus] = useState<KycStatus>("idle");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stepIndex =
    status === "idle" || status === "loading"
      ? 0
      : status === "pending"
        ? 1
        : status === "verified" || status === "failed"
          ? 2
          : 0;

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function pollStatus(reqId: string) {
    setPollCount((c) => c + 1);
    try {
      const res = await fetch(`/api/kyc/digilocker/status/${reqId}`, {
        headers: API_HEADERS
      });
      const json = await res.json();
      if (!res.ok) {
        stopPolling();
        setError(json?.error?.message ?? "Status check failed");
        setStatus("failed");
        return;
      }
      const kycStatus: string = json?.data?.status ?? "";
      if (kycStatus === "verified") {
        stopPolling();
        setStatus("verified");
      } else if (kycStatus === "failed" || kycStatus === "manual_review") {
        stopPolling();
        setStatus(kycStatus === "failed" ? "failed" : "pending");
      }
    } catch {
      stopPolling();
      setError("Network error during status check");
      setStatus("failed");
    }
  }

  async function startKyc() {
    setStatus("loading");
    setError(null);
    setPollCount(0);

    try {
      const res = await fetch("/api/kyc/digilocker/start", {
        method: "POST",
        headers: API_HEADERS,
        body: JSON.stringify({ user_id: session?.user?.id })
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        const msg: string = json?.error?.message ?? "";
        if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("verified")) {
          setStatus("verified");
          return;
        }
        setError(msg || "Failed to start KYC");
        setStatus("failed");
        return;
      }

      const reqId: string = json.data?.request_id ?? json.data?.requestId ?? "";
      setRequestId(reqId);
      setStatus("pending");

      pollRef.current = setInterval(() => pollStatus(reqId), 3000);
      await pollStatus(reqId);
    } catch {
      setError("Network error starting KYC. Please try again.");
      setStatus("failed");
    }
  }

  function reset() {
    stopPolling();
    setStatus("idle");
    setRequestId(null);
    setError(null);
    setPollCount(0);
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-black/10 py-8">
        <div className="max-w-container mx-auto px-4 sm:px-6">
          <h1 className="text-4xl font-bold">KYC Verification</h1>
          <p className="text-uber-body-gray text-sm mt-1">
            Verify Aadhaar and Driving Licence once to unlock booking.
          </p>
        </div>
      </div>

      <div className="max-w-container mx-auto px-4 sm:px-6 py-12">
        <div className="max-w-lg mx-auto">
          <StepIndicator current={stepIndex} />

          {status === "idle" && (
            <div className="card border border-black/10 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center mx-auto mb-5">
                <Icon name="idCard" className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Get KYC Verified</h2>
              <p className="text-uber-body-gray text-sm mb-6 leading-relaxed max-w-sm mx-auto">
                We use Setu DigiLocker to verify your Aadhaar and Driving Licence. This is a one-time process.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-8 text-sm">
                {[
                  { icon: "shield", text: "Encrypted flow" },
                  { icon: "clock", text: "Fast process" },
                  { icon: "idCard", text: "Digital verification" },
                  { icon: "checkCircle", text: "Policy aligned" }
                ].map((f) => (
                  <div key={f.text} className="bg-uber-chip-gray rounded-lg px-4 py-3 flex items-center gap-2">
                    <Icon name={f.icon as "shield" | "clock" | "idCard" | "checkCircle"} className="w-4 h-4" />
                    <span className="font-medium text-xs">{f.text}</span>
                  </div>
                ))}
              </div>
              <button onClick={startKyc} className="btn-primary w-full py-3.5 text-base">
                Start DigiLocker Verification
              </button>
            </div>
          )}

          {status === "loading" && (
            <div className="card border border-black/10 p-8 text-center">
              <svg className="animate-spin w-12 h-12 mx-auto mb-5 text-black" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <h2 className="text-xl font-bold mb-2">Initialising DigiLocker...</h2>
              <p className="text-uber-body-gray text-sm">Connecting to Setu DigiLocker securely.</p>
            </div>
          )}

          {status === "pending" && (
            <div className="card border border-black/10 p-8 text-center">
              <div className="mb-5 relative">
                <div className="w-16 h-16 mx-auto rounded-full bg-uber-chip-gray flex items-center justify-center">
                  <Icon name="refresh" className="w-8 h-8" />
                </div>
              </div>
              <h2 className="text-xl font-bold mb-2">Verification in Progress</h2>
              <p className="text-uber-body-gray text-sm mb-4 leading-relaxed">
                Complete the verification in DigiLocker. We check your status every 3 seconds.
              </p>

              <div className="flex justify-center gap-1.5 mb-6">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-black/20 animate-pulse"
                    style={{ animationDelay: `${i * 0.3}s` }}
                  />
                ))}
              </div>

              {requestId && (
                <div className="bg-uber-chip-gray rounded-lg px-4 py-3 mb-5 text-left">
                  <div className="text-xs text-uber-body-gray mb-0.5">Request ID</div>
                  <div className="font-mono text-xs break-all">{requestId}</div>
                </div>
              )}

              <p className="text-xs text-uber-muted-gray">Polled {pollCount} time{pollCount !== 1 ? "s" : ""}</p>

              <button onClick={reset} className="btn-secondary w-full mt-5 py-2.5 text-sm">
                Cancel and Start Over
              </button>
            </div>
          )}

          {status === "verified" && (
            <div className="card border border-black/10 p-8 text-center">
              <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-5">
                <Icon name="checkCircle" className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Verification Complete</h2>
              <p className="text-uber-body-gray text-sm mb-2">Your Aadhaar and Driving Licence have been verified.</p>
              <p className="text-uber-body-gray text-sm mb-8">You can now book any available vehicle.</p>

              <div className="flex justify-center gap-6 mb-8">
                {["Aadhaar", "DL"].map((doc) => (
                  <div key={doc} className="text-center">
                    <div className="w-12 h-12 bg-uber-chip-gray rounded-full flex items-center justify-center mx-auto mb-2">
                      <Icon name="checkCircle" className="w-6 h-6 text-black" />
                    </div>
                    <span className="text-xs font-medium">{doc}</span>
                  </div>
                ))}
              </div>

              <a href="/browse" className="btn-primary w-full py-3.5 text-base block text-center">
                Browse and Book Bikes
              </a>
            </div>
          )}

          {status === "failed" && (
            <div className="card border border-red-200 p-8 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <Icon name="close" className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">Verification Failed</h2>
              {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
              <p className="text-uber-body-gray text-sm mb-6">
                Documents could not be verified. Ensure Aadhaar and DL are valid, then try again.
              </p>
              <div className="flex flex-col gap-3">
                <button onClick={reset} className="btn-primary py-3 w-full">
                  Try Again
                </button>
                <a href="#" className="btn-secondary py-3 w-full text-center">
                  Contact Support
                </a>
              </div>
            </div>
          )}

          {status === "idle" && (
            <p className="text-center text-xs text-uber-muted-gray mt-6">
              We access only consented KYC documents. Data is encrypted in transit.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
