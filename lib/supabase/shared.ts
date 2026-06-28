export function getSupabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
}

export function getSupabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();
}

export function getSupabaseServiceRoleKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
}

export function getSupabaseDatabaseUrl() {
  return (process.env.SUPABASE_DATABASE_URL ?? "").trim();
}

export function getSupabaseDirectUrl() {
  return (process.env.SUPABASE_DIRECT_URL ?? "").trim();
}

export function isSupabaseClientConfigured() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function isSupabaseServiceConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

export function getSupabaseProjectRef() {
  try {
    const url = new URL(getSupabaseUrl());
    const host = url.hostname;
    if (!host.endsWith(".supabase.co")) return "";
    return host.replace(".supabase.co", "");
  } catch {
    return "";
  }
}

function isSupabaseDatabaseHost(value: string) {
  return value.includes(".supabase.co") || value.includes(".pooler.supabase.com");
}

export function getSupabaseIntegrationStatus() {
  const databaseUrl = getSupabaseDatabaseUrl();
  const directUrl = getSupabaseDirectUrl();
  return {
    projectRef: getSupabaseProjectRef(),
    clientConfigured: isSupabaseClientConfigured(),
    serviceConfigured: isSupabaseServiceConfigured(),
    urlConfigured: Boolean(getSupabaseUrl()),
    publishableKeyConfigured: Boolean(getSupabasePublishableKey()),
    serviceRoleConfigured: Boolean(getSupabaseServiceRoleKey()),
    databaseUrlConfigured: Boolean(databaseUrl),
    directUrlConfigured: Boolean(directUrl),
    databasePointsToSupabase: isSupabaseDatabaseHost(databaseUrl),
    directUrlPointsToSupabase: isSupabaseDatabaseHost(directUrl),
  };
}
