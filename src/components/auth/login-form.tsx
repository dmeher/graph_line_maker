"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Send } from "lucide-react";
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
    <main className="grid min-h-dvh place-items-center bg-[#f8fafc] p-5">
      <section className="grid w-full max-w-[1050px] gap-16 rounded-lg border border-[#d7dde5] bg-white p-12 lg:grid-cols-[1fr_auto_1fr]">
        <div className="mock-card mx-auto w-full max-w-[430px] p-12 text-center">
          <div className="mx-auto flex justify-center">
            <BrandMark />
          </div>
          <h1 className="mt-10 text-[24px] font-semibold tracking-[-0.01em] text-[#101828]">Sign in with email OTP</h1>
          <p className="mt-3 text-sm text-[#667085]">We'll send a one-time password to your email.</p>

          <form className="mt-8 space-y-4 text-left" onSubmit={sendOtp}>
            <label className="block text-xs font-medium text-[#344054]" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mock-input h-11"
              required
            />
            {message && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}
            <button
              type="submit"
              disabled={pending}
              className="mock-btn mock-btn-primary h-11 w-full"
            >
              {pending ? "Sending OTP..." : "Send OTP"}
              <Send size={16} />
            </button>
          </form>
          <p className="mt-12 text-center text-[11px] leading-5 text-[#667085]">
            By continuing, you agree to our Terms of Service<br />and Privacy Policy.
          </p>
        </div>

        <div className="hidden items-center text-4xl text-[#98a2b3] lg:flex">-&gt;</div>

        <div className="mock-card mx-auto w-full max-w-[430px] p-12 text-center">
          <div className="mx-auto flex justify-center">
            <BrandMark />
          </div>
          <h2 className="mt-10 text-[24px] font-semibold tracking-[-0.01em] text-[#101828]">Verify code</h2>
          <p className="mt-3 text-sm leading-6 text-[#667085]">
            Enter the 6-digit code sent to<br />
            <span className="font-semibold text-[#101828]">{email || "alex.kumar@example.com"}</span>{" "}
            <button type="button" onClick={() => setStep("email")} className="font-semibold text-[#008c8f]">Edit</button>
          </p>

          <form className="mt-8 space-y-5 text-left" onSubmit={verifyOtp}>
            <label className="block text-xs font-medium text-[#344054]" htmlFor="otp">OTP</label>
            <div className="grid grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <input
                  key={index}
                  aria-label={`OTP digit ${index + 1}`}
                  inputMode="numeric"
                  maxLength={1}
                  value={otp[index] ?? ""}
                  onChange={(event) => {
                    const next = `${otp.slice(0, index)}${event.target.value.replace(/\D/g, "").slice(0, 1)}${otp.slice(index + 1)}`.slice(0, 6);
                    setOtp(next);
                  }}
                  className={`h-12 rounded-md border bg-white text-center text-lg font-semibold outline-none ${
                    index === 5 ? "border-[#008c8f] shadow-[0_0_0_2px_rgba(0,140,143,0.12)]" : "border-[#d7dde5]"
                  }`}
                  disabled={step === "email"}
                />
              ))}
            </div>
            {debugOtp && <p className="rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-sm">Dev OTP: {debugOtp}</p>}
            {step === "otp" && message && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}
            <p className="text-center text-xs text-[#667085]">Didn't receive code? <span className="font-semibold text-[#008c8f]">Resend in 00:28</span></p>
            <button
              type="submit"
              disabled={pending || otp.length !== 6}
              className="mock-btn mock-btn-primary h-11 w-full"
            >
              {pending ? "Verifying..." : "Verify and sign in"}
              <Lock size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setOtp("");
                setMessage(null);
                setDebugOtp(null);
              }}
              className="mx-auto block text-sm font-semibold text-[#008c8f]"
            >
              &lt;- Back to email
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
