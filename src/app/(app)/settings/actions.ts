"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BOOTSTRAP_ADMIN_EMAIL } from "@/lib/constants";
import { normalizeEmail } from "@/lib/auth/security";
import { isBootstrapAdmin, requireAdmin } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { displayNameFromEmail } from "@/lib/utils/format";
import type { AppRole, AppUserStatus } from "@/lib/types";

const upsertUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().max(120).optional(),
  role: z.union([z.literal("admin"), z.literal("member")]),
});

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  role: z.union([z.literal("admin"), z.literal("member")]),
  status: z.union([z.literal("active"), z.literal("inactive")]),
});

export async function upsertAppUser(formData: FormData) {
  const session = await requireAdmin();
  const email = normalizeEmail(formData.get("email"));
  const parsed = upsertUserSchema.parse({
    email,
    displayName: String(formData.get("displayName") || "").trim(),
    role: String(formData.get("role") || "member"),
  });

  if (isBootstrapAdmin(parsed.email) && parsed.role !== "admin") {
    throw new Error(`${BOOTSTRAP_ADMIN_EMAIL} must remain an admin.`);
  }

  const displayName = parsed.displayName || displayNameFromEmail(parsed.email);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("app_users").upsert(
    {
      email: parsed.email,
      display_name: displayName,
      role: parsed.email === BOOTSTRAP_ADMIN_EMAIL ? "admin" : parsed.role,
      status: "active",
      invited_by_id: session.userId,
      invited_by_email: session.email,
    },
    { onConflict: "email" },
  );

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function updateAppUser(formData: FormData) {
  const session = await requireAdmin();
  const parsed = updateUserSchema.parse({
    userId: String(formData.get("userId") || ""),
    role: String(formData.get("role") || "member") as AppRole,
    status: String(formData.get("status") || "active") as AppUserStatus,
  });

  const supabase = getSupabaseAdmin();
  const { data: user, error: lookupError } = await supabase
    .from("app_users")
    .select("email")
    .eq("id", parsed.userId)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);
  if (!user) throw new Error("User not found.");
  if (user.email === session.email && parsed.status !== "active") {
    throw new Error("You cannot deactivate your current session user.");
  }
  if (isBootstrapAdmin(user.email) && (parsed.role !== "admin" || parsed.status !== "active")) {
    throw new Error(`${BOOTSTRAP_ADMIN_EMAIL} must remain an active admin.`);
  }

  const { error } = await supabase
    .from("app_users")
    .update({ role: parsed.role, status: parsed.status })
    .eq("id", parsed.userId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

