import "server-only";

import { normalizeEmail } from "@/lib/auth/security";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendBrevoOtp(email: string, otp: string) {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || "Graph Pixel Maker";

  if (!apiKey || !senderEmail) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Brevo email is not configured.");
    }
    console.info(`[graph-pixel] Development OTP for ${normalizeEmail(email)}: ${otp}`);
    return { skipped: true };
  }

  const safeSenderName = escapeHtml(senderName);
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: normalizeEmail(email) }],
      subject: "Your Graph Pixel Maker login code",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; color: #111827;">
          <h2>${safeSenderName} Login Code</h2>
          <p>Your one-time login code is:</p>
          <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px;">${otp}</p>
          <p>This code expires in 10 minutes.</p>
          <p>If you did not request this code, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Brevo email failed: ${await response.text()}`);
  }

  return response.json();
}

