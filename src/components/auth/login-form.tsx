"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Crop,
  Eye,
  Grid3X3,
  Layers3,
  Loader2,
  LockKeyhole,
  Mail,
  MousePointer2,
  Palette,
  RefreshCw,
  Send,
  ShieldCheck,
  WandSparkles,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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
    <main className="atelier-auth">
      <aside className="atelier-auth__showcase" aria-hidden="true">
        <header className="atelier-auth__showcase-head">
          <BrandMark />
          <span><ShieldCheck size={13} /> Private workspace</span>
        </header>

        <div className="atelier-auth__story">
          <p className="atelier-auth__kicker">Graph Pixel Maker / Studio access</p>
          <h2>Make the grid feel like a creative surface.</h2>
          <p>Every layer, cell, color, and measurement remains close to the canvas—and under your control.</p>

          <div className="atelier-auth-preview">
            <div className="atelier-auth-preview__bar">
              <div><i /><i /><i /></div>
              <strong>Border study</strong>
              <span><Check size={11} /> Saved</span>
            </div>
            <div className="atelier-auth-preview__body">
              <div className="atelier-auth-preview__tools">
                <span className="is-active"><MousePointer2 size={14} /></span>
                <span><Crop size={14} /></span>
                <span><WandSparkles size={14} /></span>
                <span><Palette size={14} /></span>
              </div>
              <div className="atelier-auth-preview__stage">
                <div className="atelier-auth-preview__paper">
                  <svg viewBox="0 0 320 184" focusable="false">
                    <defs>
                      <pattern id="atelier-auth-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                        <path d="M16 0H0V16" fill="none" stroke="currentColor" strokeOpacity=".15" />
                      </pattern>
                    </defs>
                    <rect width="320" height="184" fill="url(#atelier-auth-grid)" />
                    <path
                      d="M32 132c28 0 36-82 78-82 34 0 39 65 72 65 43 0 47-82 94-82"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeLinecap="square"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="atelier-auth-preview__selection"><i /><i /><i /><i /></span>
                </div>
                <div className="atelier-auth-preview__layer-card">
                  <Layers3 size={14} />
                  <span><strong>Floral outline</strong><small>Source layer</small></span>
                  <Eye size={13} />
                </div>
                <div className="atelier-auth-preview__palette"><span /><span /><span /><span /></div>
              </div>
            </div>
          </div>
        </div>

        <footer className="atelier-auth__showcase-foot">
          <span><Grid3X3 size={14} /> Centimeter grid</span>
          <span><Palette size={14} /> Count-aware color</span>
          <span><Layers3 size={14} /> Editable layers</span>
        </footer>
      </aside>

      <section className="atelier-auth__access" aria-labelledby="login-title">
        <header className="atelier-auth__access-head">
          <Link href="/" aria-label="Graph Pixel Maker home" className="atelier-auth__mobile-brand">
            <BrandMark />
          </Link>
          <Link href="/" className="atelier-auth__back">
            <ArrowLeft size={15} aria-hidden="true" />
            Back to home
          </Link>
          <span className="atelier-auth__secure"><LockKeyhole size={13} /> Passwordless</span>
        </header>

        <div className="atelier-auth__access-body">
          <article className="atelier-access-card">
            <header className="atelier-access-card__head">
              <div className="atelier-access-card__progress" aria-label={progressLabel}>
                <span className={step === "email" ? "is-active" : "is-complete"}>
                  {step === "otp" ? <CheckCircle2 size={14} /> : "1"}
                  <small>Email</small>
                </span>
                <i className={step === "otp" ? "is-complete" : ""} />
                <span className={step === "otp" ? "is-active" : ""}>
                  2
                  <small>Verify</small>
                </span>
              </div>
              <span className="atelier-access-card__step">{progressLabel}</span>
            </header>

            {step === "email" ? (
              <div className="atelier-access-step">
                <div className="atelier-access-step__title">
                  <span className="atelier-access-step__icon"><Mail size={20} aria-hidden="true" /></span>
                  <div>
                    <p>Workspace access</p>
                    <h1 id="login-title">Welcome to the studio</h1>
                  </div>
                </div>
                <p className="atelier-access-step__copy">
                  Use your approved email address. We’ll send a secure six-digit code—no password required.
                </p>

                <form className="atelier-access-form" onSubmit={sendOtp}>
                  <div className="atelier-access-field">
                    <div className="atelier-access-field__label">
                      <label htmlFor="email">Email address</label>
                      <span>Approved accounts only</span>
                    </div>
                    <div className="atelier-access-field__control">
                      <Mail size={17} aria-hidden="true" />
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
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                  </div>
                  {message ? <StatusMessage tone={messageTone}>{message}</StatusMessage> : null}
                  <button
                    type="submit"
                    disabled={pending || !email.trim()}
                    className="atelier-access-button"
                  >
                    {pendingAction === "send" ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                    {pendingAction === "send" ? "Sending code…" : "Continue with email"}
                    {pendingAction !== "send" ? <ArrowRight size={16} aria-hidden="true" /> : null}
                  </button>
                </form>

                <div className="atelier-access-note">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <p><strong>Private by design.</strong> Your administrator controls workspace access.</p>
                </div>
              </div>
            ) : (
              <div className="atelier-access-step">
                <div className="atelier-access-step__title">
                  <span className="atelier-access-step__icon atelier-access-step__icon--success">
                    <LockKeyhole size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <p>Check your inbox</p>
                    <h1 id="login-title">Enter your code</h1>
                  </div>
                </div>
                <p className="atelier-access-step__copy">
                  We sent a six-digit code to <strong>{email}</strong>.{" "}
                  <button type="button" onClick={editEmail}>Edit email</button>
                </p>

                <form className="atelier-access-form" onSubmit={verifyOtp}>
                  <fieldset className="atelier-otp-fieldset">
                    <legend>One-time password</legend>
                    <div
                      className="atelier-otp"
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
                              setOtpDigits((current) =>
                                current.map((currentDigit, digitIndex) => (digitIndex === index ? digits : currentDigit)),
                              );
                              if (digits && index < OTP_LENGTH - 1) otpInputRefs.current[index + 1]?.focus();
                            }
                          }}
                          onKeyDown={(event) => handleOtpKeyDown(index, event)}
                          className="atelier-otp__input"
                        />
                      ))}
                    </div>
                  </fieldset>

                  {debugOtp ? (
                    <p className="atelier-access-debug">Development code <strong>{debugOtp}</strong></p>
                  ) : null}
                  {message ? <StatusMessage tone={messageTone}>{message}</StatusMessage> : null}

                  <div className="atelier-access-code-meta">
                    <span>{expirySeconds > 0 ? `Code expires in ${formatCountdown(expirySeconds)}` : "Code expired"}</span>
                    <button
                      type="button"
                      disabled={pending || resendSeconds > 0}
                      onClick={() => void requestOtp("resend")}
                    >
                      {pendingAction === "resend" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      {resendSeconds > 0 ? `Resend in ${formatCountdown(resendSeconds)}` : "Resend code"}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={pending || otp.length !== OTP_LENGTH || expirySeconds === 0}
                    className="atelier-access-button"
                  >
                    {pendingAction === "verify" ? <Loader2 size={17} className="animate-spin" /> : <LockKeyhole size={17} />}
                    {pendingAction === "verify" ? "Verifying…" : "Verify and sign in"}
                    {pendingAction !== "verify" ? <ArrowRight size={16} aria-hidden="true" /> : null}
                  </button>
                </form>
              </div>
            )}

            <footer className="atelier-access-card__foot">
              <ShieldCheck size={14} aria-hidden="true" />
              <span>Passwordless access</span>
              <i />
              <span>10-minute code</span>
              <i />
              <span>Secure session</span>
            </footer>
          </article>
        </div>

        <footer className="atelier-auth__access-foot">
          <span>Graph Pixel Maker</span>
          <span>Precision graph studio</span>
        </footer>
      </section>
    </main>
  );
}

function StatusMessage({ tone, children }: { tone: "info" | "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`atelier-access-message atelier-access-message--${tone}`}
    >
      {children}
    </p>
  );
}
