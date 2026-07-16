import { NextRequest, NextResponse } from "next/server";
import { sendBrevoOtp } from "@/lib/auth/brevo";
import { checkRateLimit, getClientIp, isRateLimited, recordRateLimitHit } from "@/lib/auth/rate-limit";
import { generateOtp, hashOtp, normalizeEmail } from "@/lib/auth/security";
import { getActiveUserByEmail } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const OTP_TTL_MINUTES = 10;
const OTP_EMAIL_LIMIT = 5;
const OTP_EMAIL_WINDOW_MS = 15 * 60 * 1000;
const OTP_RESEND_SECONDS = 30;

function rateLimitResponse(message: string, retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, message, retryAfterSeconds, resendAfterSeconds: retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (!checkRateLimit(`graph-pixel-otp-ip:${ip}`, 20, 15 * 60 * 1000)) {
      return rateLimitResponse("Too many OTP requests. Please try again later.", 15 * 60);
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    if (!email || !email.includes("@")) {
      return NextResponse.json({ message: "Valid email is required." }, { status: 400 });
    }

    const user = await getActiveUserByEmail(email);
    if (!user) {
      return NextResponse.json({ message: "This email is not allowed for Graph Pixel Maker." }, { status: 403 });
    }

    const emailRateLimitKey = `graph-pixel-otp-email:${email}`;
    if (isRateLimited(emailRateLimitKey, OTP_EMAIL_LIMIT, OTP_EMAIL_WINDOW_MS)) {
      return rateLimitResponse("Too many OTP requests for this email. Please wait.", 15 * 60);
    }

    const supabase = getSupabaseAdmin();
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    const { data: rateLimitRows, error } = await supabase.rpc("create_login_otp_attempt", {
      p_app_user_id: user.id,
      p_email: email,
      p_otp_hash: hashOtp(email, otp),
      p_expires_at: expiresAt,
      p_ip: ip,
      p_user_agent: request.headers.get("user-agent") ?? "",
      p_now: new Date().toISOString(),
    });

    if (error) throw new Error("Unable to save OTP.");
    const authoritativeLimit = Array.isArray(rateLimitRows) ? rateLimitRows[0] : null;
    if (authoritativeLimit?.result === "email_limited" || authoritativeLimit?.result === "ip_limited") {
      const retryAfter = Math.max(1, Number(authoritativeLimit.retry_after_seconds) || 15 * 60);
      return rateLimitResponse(
        authoritativeLimit.result === "email_limited"
          ? "Too many OTP requests for this email. Please wait."
          : "Too many OTP requests. Please try again later.",
        retryAfter,
      );
    }
    if (authoritativeLimit?.result !== "ok") {
      return NextResponse.json({ message: "This email is not allowed for Graph Pixel Maker." }, { status: 403 });
    }

    const delivery = await sendBrevoOtp(email, otp);
    const emailSkipped = "skipped" in delivery;
    recordRateLimitHit(emailRateLimitKey, OTP_EMAIL_WINDOW_MS);

    return NextResponse.json({
      ok: true,
      message: "OTP sent.",
      expiresAt,
      resendAfterSeconds: OTP_RESEND_SECONDS,
      emailSkipped: emailSkipped || undefined,
      debugOtp: process.env.NODE_ENV === "production" ? undefined : otp,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to send OTP." },
      { status: 500 },
    );
  }
}
