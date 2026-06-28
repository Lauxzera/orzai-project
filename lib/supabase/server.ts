import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseClientConfigured } from "@/lib/supabase/shared";

export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  if (!isSupabaseClientConfigured()) {
    throw new Error("Supabase client ainda nao foi configurado neste ambiente.");
  }

  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Chamadas de Server Component podem cair aqui; o middleware cuida do refresh da sessão.
        }
      },
    },
  });
}
