"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Grid3X3, ImageUp, Loader2, LockKeyhole, Mail, Palette, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { OFFLINE_SESSION_CLEAR_MESSAGE, OFFLINE_SESSION_STORAGE_KEY } from "@/lib/auth/offline-session";
import { clearEditorSessionDrafts } from "@/lib/editor/session-draft";

const OTP_LENGTH = 6;

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}

export function LoginForm() {
  const router = useRouter();
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(() => Array.from({ length: OTP_LENGTH }, () => ""));
  const [step, setStep] = useState<"email" | "otp">("email");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"send" | "verify" | "resend" | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [clock, setClock] = useState(() => Date.now());

  const otp = otpDigits.join("");
  const resendSeconds = Math.max(0, Math.ceil((resendAvailableAt - clock) / 1000));
  const expirySeconds = expiresAt ? Math.max(0, Math.ceil((expiresAt - clock) / 1000)) : 0;
  const pending = pendingAction !== null;

  useEffect(() => {
    try {
      window.sessionStorage.removeItem(OFFLINE_SESSION_STORAGE_KEY);
      clearEditorSessionDrafts(window.sessionStorage);
    } catch {
      // Session storage can be unavailable in private or restricted browser modes.
    }

    if (!("serviceWorker" in navigator)) return;
    const clearMessage = { type: OFFLINE_SESSION_CLEAR_MESSAGE };
    navigator.serviceWorker.controller?.postMessage(clearMessage);
    navigator.serviceWorker.ready
      .then((registration) => registration.active?.postMessage(clearMessage))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step === "email") emailInputRef.current?.focus();
    else otpInputRefs.current[0]?.focus();
  }, [step]);

  useEffect(() => {
    if (step !== "otp") return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const progressLabel = useMemo(() => (step === "email" ? "Step 1 of 2" : "Step 2 of 2"), [step]);

  async function requestOtp(action: "send" | "resend") {
    setPendingAction(action);
    setMessage(null);
    setDebugOtp(null);

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        if (retryAfter > 0) setResendAvailableAt(Date.now() + retryAfter * 1000);
        setMessageTone("error");
        setMessage(payload.message || "Unable to send the sign-in code.");
        return;
      }

      const now = Date.now();
      const resendAfterSeconds = Math.max(1, Number(payload.resendAfterSeconds ?? 30));
      setEmail((current) => current.trim());
      setStep("otp");
      setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      setExpiresAt(payload.expiresAt ? Date.parse(payload.expiresAt) : now + 10 * 60 * 1000);
      setResendAvailableAt(now + resendAfterSeconds * 1000);
      setClock(now);
      setDebugOtp(payload.debugOtp || null);
      setMessageTone(payload.emailSkipped ? "info" : "success");
      setMessage(
        payload.emailSkipped
          ? "Email delivery is disabled locally. Use the development code below."
          : action === "resend"
            ? "A new code was sent."
            : "Check your inbox for the six-digit code.",
      );
    } catch {
      setMessageTone("error");
      setMessage("We could not reach the sign-in service. Check your connection and try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestOtp("send");
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (otp.length !== OTP_LENGTH) return;
    setPendingAction("verify");
    setMessage(null);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessageTone("error");
        setMessage(payload.message || "Unable to verify the code.");
        otpInputRefs.current[0]?.focus();
        return;
      }

      setMessageTone("success");
      setMessage("Code verified. Opening your workspace…");
      router.replace(payload.redirectTo || "/dashboard");
      router.refresh();
    } catch {
      setMessageTone("error");
      setMessage("We could not verify the code. Check your connection and try again.");
    } finally {
      setPendingAction(null);
    }
  }

  function applyOtpDigits(startIndex: number, rawValue: string) {
    const digits = rawValue.replace(/\D/g, "").slice(0, OTP_LENGTH - startIndex).split("");
    if (!digits.length) return;
    setOtpDigits((current) => {
      const next = [...current];
      digits.forEach((digit, offset) => {
        next[startIndex + offset] = digit;
      });
      return next;
    });
    const focusIndex = Math.min(OTP_LENGTH - 1, startIndex + digits.length);
    window.requestAnimationFrame(() => otpInputRefs.current[focusIndex]?.focus());
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      if (otpDigits[index]) {
        setOtpDigits((current) => current.map((digit, digitIndex) => (digitIndex === index ? "" : digit)));
      } else if (index > 0) {
        setOtpDigits((current) => current.map((digit, digitIndex) => (digitIndex === index - 1 ? "" : digit)));
        otpInputRefs.current[index - 1]?.focus();
      }
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) otpInputRefs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) otpInputRefs.current[index + 1]?.focus();
  }

  function editEmail() {
    setStep("email");
    setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
    setMessage(null);
    setDebugOtp(null);
    setExpiresAt(null);
  }

  return (
    <main className="auth-shell">
      <aside className="auth-hero" aria-hidden="true">
        <div className="auth-hero__copy">
          <BrandMark />
          <h2>
            Turn line art into <em>print-ready</em> graph charts.
          </h2>
          <p>Upload artwork, refine it on a precision pixel grid, and export tiled PDFs sized for real paper.</p>
        </div>
        <ul className="auth-hero__points">
          <li><ImageUp size={17} /> PNG, JPG, WEBP, SVG, and PDF uploads</li>
          <li><Grid3X3 size={17} /> Cell-perfect grids up to 20 × 125 cm</li>
          <li><Palette size={17} /> Palette locks with live cell counts</li>
          <li><ShieldCheck size={17} /> Private, allowlist-only workspace</li>
        </ul>
      </aside>

      <section className="auth-pane" aria-labelledby="login-title">
      <div className="auth-card">
        <div className="auth-brand-row">
          <Link href="/" aria-label="Graph Pixel Maker home" className="auth-brand-row__mark">
            <BrandMark />
          </Link>
          <span className="ui-chip">{progressLabel}</span>
        </div>

        <div className="auth-progress" aria-hidden="true">
          <span className={"auth-progress__step " + (step === "otp" ? "auth-progress__step--complete" : "auth-progress__step--active")}>
            {step === "otp" ? <CheckCircle2 size={15} /> : "1"}
          </span>
          <span className={"auth-progress__line " + (step === "otp" ? "auth-progress__line--complete" : "")} />
          <span className={"auth-progress__step " + (step === "otp" ? "auth-progress__step--active" : "")}>2</span>
        </div>

        {step === "email" ? (
          <div className="auth-step">
            <div className="auth-icon"><Mail size={22} aria-hidden="true" /></div>
            <p className="auth-eyebrow">Secure workspace access</p>
            <h1 id="login-title">Sign in with email</h1>
            <p className="auth-copy">Enter an approved email address and we’ll send a one-time sign-in code.</p>

            <form className="auth-form" onSubmit={sendOtp}>
              <label htmlFor="email">Email address</label>
              <input
                ref={emailInputRef}
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="ui-input auth-input"
                placeholder="you@example.com"
                required
              />
              {message ? <StatusMessage tone={messageTone}>{message}</StatusMessage> : null}
              <button type="submit" disabled={pending || !email.trim()} className="ui-btn ui-btn-primary auth-submit">
                {pendingAction === "send" ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                {pendingAction === "send" ? "Sending code…" : "Continue with email"}
              </button>
            </form>
          </div>
        ) : (
          <div className="auth-step">
            <div className="auth-icon"><LockKeyhole size={22} aria-hidden="true" /></div>
            <p className="auth-eyebrow">Check your inbox</p>
            <h1 id="login-title">Enter your code</h1>
            <p className="auth-copy">
              We sent a six-digit code to <strong>{email}</strong>.{" "}
              <button type="button" onClick={editEmail}>Edit email</button>
            </p>

            <form className="auth-form" onSubmit={verifyOtp}>
              <fieldset>
                <legend>One-time password</legend>
                <div
                  className="auth-otp"
                  onPaste={(event) => {
                    event.preventDefault();
                    applyOtpDigits(0, event.clipboardData.getData("text"));
                  }}
                >
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => { otpInputRefs.current[index] = element; }}
                      aria-label={"Code digit " + (index + 1)}
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      pattern="[0-9]*"
                      maxLength={index === 0 ? OTP_LENGTH : 1}
                      value={digit}
                      onFocus={(event) => event.currentTarget.select()}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, "");
                        if (digits.length > 1) applyOtpDigits(index, digits);
                        else {
                          setOtpDigits((current) => current.map((currentDigit, digitIndex) => (digitIndex === index ? digits : currentDigit)));
                          if (digits && index < OTP_LENGTH - 1) otpInputRefs.current[index + 1]?.focus();
                        }
                      }}
                      onKeyDown={(event) => handleOtpKeyDown(index, event)}
                      className="auth-otp__input"
                    />
                  ))}
                </div>
              </fieldset>

              {debugOtp ? <p className="auth-debug-code">Development code: <strong>{debugOtp}</strong></p> : null}
              {message ? <StatusMessage tone={messageTone}>{message}</StatusMessage> : null}

              <div className="auth-code-meta">
                <span>{expirySeconds > 0 ? "Code expires in " + formatCountdown(expirySeconds) : "Code expired"}</span>
                <button type="button" disabled={pending || resendSeconds > 0} onClick={() => void requestOtp("resend")}>
                  {pendingAction === "resend" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {resendSeconds > 0 ? "Resend in " + formatCountdown(resendSeconds) : "Resend code"}
                </button>
              </div>

              <button type="submit" disabled={pending || otp.length !== OTP_LENGTH || expirySeconds === 0} className="ui-btn ui-btn-primary auth-submit">
                {pendingAction === "verify" ? <Loader2 size={17} className="animate-spin" /> : <LockKeyhole size={17} />}
                {pendingAction === "verify" ? "Verifying…" : "Verify and sign in"}
              </button>
            </form>
          </div>
        )}

        <p className="auth-security-note">Passwordless access · 10-minute code · Secure session</p>
      </div>
      </section>
    </main>
  );
}

function StatusMessage({ tone, children }: { tone: "info" | "error" | "success"; children: React.ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} aria-live="polite" className={"auth-message auth-message--" + tone}>
      {children}
    </p>
  );
}
