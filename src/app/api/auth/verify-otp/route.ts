import { NextRequest, NextResponse } from "next/server";
import { hashOtp, normalizeEmail } from "@/lib/auth/security";
import { setSessionCookie } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

type OtpVerificationResult = {
  result: "ok" | "not_allowed" | "not_found" | "expired" | "too_many" | "invalid";
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
};

function verificationError(result: OtpVerificationResult["result"]) {
  switch (result) {
    case "not_allowed":
      return { message: "This email is not allowed for Graph Pixel Maker.", status: 403 };
    case "not_found":
      return { message: "OTP not found. Please request a new code.", status: 400 };
    case "expired":
      return { message: "OTP expired. Please request a new code.", status: 400 };
    case "too_many":
      return { message: "Too many attempts. Please request a new code.", status: 429 };
    default:
      return { message: "Invalid OTP.", status: 400 };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const otp = String(body.otp || "").trim();

    if (!email || !email.includes("@") || !/^\d{6}$/.test(otp)) {
      return NextResponse.json({ message: "Valid email and 6-digit OTP are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("verify_login_otp", {
      p_email: email,
      p_otp_hash: hashOtp(email, otp),
      p_now: new Date().toISOString(),
    });
    if (error) throw new Error("Unable to verify OTP.");

    const verification = (data?.[0] ?? null) as OtpVerificationResult | null;
    if (!verification || verification.result !== "ok") {
      const failure = verificationError(verification?.result ?? "invalid");
      return NextResponse.json({ message: failure.message }, { status: failure.status });
    }
    if (!verification.user_id || !verification.user_email || !["admin", "member"].includes(verification.user_role || "")) {
      throw new Error("Unable to verify user access.");
    }

    const role = verification.user_role as AppRole;
    const response = NextResponse.json({ ok: true, email: verification.user_email, role, redirectTo: "/dashboard" });
    return setSessionCookie(response, { id: verification.user_id, email: verification.user_email, role });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to verify OTP." },
      { status: 500 },
    );
  }
}
