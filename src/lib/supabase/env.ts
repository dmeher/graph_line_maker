export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "";
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
export const supabaseDbSchema =
  process.env.SUPABASE_DB_SCHEMA?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA?.trim() ||
  "image_to_graph";

export const hasPublicSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const hasAdminSupabaseConfig = Boolean(supabaseUrl && supabaseServiceRoleKey);

export const missingSupabaseAdminMessage =
  "Supabase admin configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_DB_SCHEMA=image_to_graph.";
