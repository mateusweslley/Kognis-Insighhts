function isValidHttpUrl(value?: string): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getSupabaseEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!isValidHttpUrl(rawUrl)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) URL.");
  }

  if (!rawKey || isValidHttpUrl(rawKey)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to a valid anon key.");
  }

  return {
    supabaseUrl: rawUrl,
    supabaseAnonKey: rawKey,
  };
}
