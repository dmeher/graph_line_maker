import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  hasAdminSupabaseConfig,
  missingSupabaseAdminMessage,
  supabaseDbSchema,
  supabaseServiceRoleKey,
  supabaseUrl,
} from "@/lib/supabase/env";

function createGraphPixelAdminClient() {
  if (!hasAdminSupabaseConfig) {
    throw new Error(missingSupabaseAdminMessage);
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    db: { schema: supabaseDbSchema },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export type GraphPixelAdminClient = ReturnType<typeof createGraphPixelAdminClient>;

let adminClient: GraphPixelAdminClient | null = null;

export function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createGraphPixelAdminClient();
  }

  return adminClient;
}

export function tryGetSupabaseAdmin() {
  if (!hasAdminSupabaseConfig) return null;
  return getSupabaseAdmin();
}

