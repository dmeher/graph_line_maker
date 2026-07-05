import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail, verifyOtpHash } from "@/lib/auth/security";
import { setSessionCookie } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

const MAX_VERIFY_ATTEMPTS = 5;

type OtpAttempt = {
  id: string;
  app_user_id: string;
  email: string;
  otp_hash: string;
  attempt_count: number;
  expires_at: string;
};

type DbUser = {
  id: string;
  email: string;
  role: AppRole;
  status: "active" | "inactive";
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const otp = String(body.otp || "").trim();

    if (!email || !email.includes("@") || !/^\d{6}$/.test(otp)) {
      return NextResponse.json({ message: "Valid email and 6-digit OTP are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: userData, error: userError } = await supabase
      .from("app_users")
      .select("id, email, role, status")
      .eq("email", email)
      .eq("status", "active")
      .maybeSingle();

    if (userError) throw new Error("Unable to verify user access.");
    if (!userData) {
      return NextResponse.json({ message: "This email is not allowed for Graph Pixel Maker." }, { status: 403 });
    }

    const user = userData as DbUser;
    const { data, error } = await supabase
      .from("email_otp_attempts")
      .select("id, app_user_id, email, otp_hash, attempt_count, expires_at")
      .eq("email", email)
      .eq("app_user_id", user.id)
      .eq("purpose", "app_login")
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error("Unable to verify OTP.");
    if (!data) return NextResponse.json({ message: "OTP not found. Please request a new code." }, { status: 400 });

    const attempt = data as OtpAttempt;
    if (new Date(attempt.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ message: "OTP expired. Please request a new code." }, { status: 400 });
    }

    if (attempt.attempt_count >= MAX_VERIFY_ATTEMPTS) {
      return NextResponse.json({ message: "Too many attempts. Please request a new code." }, { status: 429 });
    }

    const nextAttempts = Number(attempt.attempt_count || 0) + 1;
    if (!verifyOtpHash(email, otp, attempt.otp_hash)) {
      await supabase.from("email_otp_attempts").update({ attempt_count: nextAttempts }).eq("id", attempt.id);
      return NextResponse.json({ message: "Invalid OTP." }, { status: 400 });
    }

    await supabase
      .from("email_otp_attempts")
      .update({ attempt_count: nextAttempts, consumed_at: new Date().toISOString() })
      .eq("id", attempt.id);

    await supabase.from("app_users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);

    const response = NextResponse.json({ ok: true, email, role: user.role, redirectTo: "/dashboard" });
    return setSessionCookie(response, { id: user.id, email: user.email, role: user.role });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to verify OTP." },
      { status: 500 },
    );
  }
}

