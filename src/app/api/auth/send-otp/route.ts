import { NextRequest, NextResponse } from "next/server";
import { sendBrevoOtp } from "@/lib/auth/brevo";
import { checkRateLimit, getClientIp, isRateLimited, recordRateLimitHit } from "@/lib/auth/rate-limit";
import { generateOtp, hashOtp, normalizeEmail } from "@/lib/auth/security";
import { getActiveUserByEmail } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const OTP_TTL_MINUTES = 10;
const OTP_EMAIL_LIMIT = 5;
const OTP_EMAIL_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (!checkRateLimit(`graph-pixel-otp-ip:${ip}`, 20, 15 * 60 * 1000)) {
      return NextResponse.json({ message: "Too many OTP requests. Please try again later." }, { status: 429 });
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
      return NextResponse.json({ message: "Too many OTP requests for this email. Please wait." }, { status: 429 });
    }

    const supabase = getSupabaseAdmin();
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    const { error } = await supabase.from("email_otp_attempts").insert({
      app_user_id: user.id,
      email,
      otp_hash: hashOtp(email, otp),
      purpose: "app_login",
      expires_at: expiresAt,
      metadata: {
        userAgent: request.headers.get("user-agent"),
        ip,
      },
    });

    if (error) throw new Error("Unable to save OTP.");

    const delivery = await sendBrevoOtp(email, otp);
    const emailSkipped = "skipped" in delivery;
    recordRateLimitHit(emailRateLimitKey, OTP_EMAIL_WINDOW_MS);

    return NextResponse.json({
      message: "OTP sent.",
      expiresAt,
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
