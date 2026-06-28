import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl, isSupabaseServiceConfigured } from "@/lib/supabase/shared";

export function createSupabaseServiceClient(): SupabaseClient {
  if (!isSupabaseServiceConfigured()) {
    throw new Error("Supabase service role ainda nao foi configurado neste ambiente.");
  }

  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
