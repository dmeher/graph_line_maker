"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { OFFLINE_SESSION_CLEAR_MESSAGE, OFFLINE_SESSION_STORAGE_KEY } from "@/lib/auth/offline-session";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("dmeher1996@gmail.com");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [message, setMessage] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      window.sessionStorage.removeItem(OFFLINE_SESSION_STORAGE_KEY);
    } catch {
      // Session storage can be unavailable in private or restricted browser modes.
    }

    if (!("serviceWorker" in navigator)) return;
    const message = { type: OFFLINE_SESSION_CLEAR_MESSAGE };
    navigator.serviceWorker.controller?.postMessage(message);
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.active?.postMessage(message);
      })
      .catch(() => {});
  }, []);

  async function sendOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setDebugOtp(null);

    const response = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json().catch(() => ({}));
    setPending(false);

    if (!response.ok) {
      setMessage(payload.message || "Unable to send OTP.");
      return;
    }

    setStep("otp");
    setDebugOtp(payload.debugOtp || null);
    setMessage(payload.emailSkipped ? "Email is not configured; use the dev OTP shown below." : "OTP sent to your email.");
  }

  async function verifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const response = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    const payload = await response.json().catch(() => ({}));
    setPending(false);

    if (!response.ok) {
      setMessage(payload.message || "Unable to verify OTP.");
      return;
    }

    router.replace(payload.redirectTo || "/dashboard");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--panel)] p-3 sm:p-4">
      <section className="w-full max-w-md rounded-md border border-[var(--line)] bg-white p-4 shadow-sm sm:p-6">
        <BrandMark />
        <div className="mt-8">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-teal-50 text-[var(--teal)]">
            {step === "email" ? <Mail size={20} aria-hidden="true" /> : <ShieldCheck size={20} aria-hidden="true" />}
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">Sign in with email OTP</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Access is restricted to active Graph Pixel Maker users.
          </p>
        </div>

        {step === "email" ? (
          <form className="mt-6 space-y-4" onSubmit={sendOtp}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full min-w-0 rounded-md border border-[var(--line)] px-3 text-sm outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              required
            />
            {message && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}
            <button
              type="submit"
              disabled={pending}
              className="h-11 w-full rounded-md bg-[var(--teal)] text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={verifyOtp}>
            <label className="block text-sm font-medium text-slate-700" htmlFor="otp">
              6-digit OTP
            </label>
            <input
              id="otp"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-12 w-full min-w-0 rounded-md border border-[var(--line)] px-3 text-center font-mono text-xl tracking-[0.3em] outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-teal-100"
              required
            />
            {debugOtp && <p className="rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-sm">Dev OTP: {debugOtp}</p>}
            {message && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}
            <button
              type="submit"
              disabled={pending || otp.length !== 6}
              className="h-11 w-full rounded-md bg-[var(--teal)] text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Verifying..." : "Verify and sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setOtp("");
                setMessage(null);
                setDebugOtp(null);
              }}
              className="h-11 w-full rounded-md border border-[var(--line)] text-sm font-semibold text-slate-700"
            >
              Use a different email
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
