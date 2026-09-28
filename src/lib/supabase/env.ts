const FALLBACK_SUPABASE_URL = "https://fdtgtawwdbkprzqtlree.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkdGd0YXd3ZGJrcHJ6cXRscmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNjM2NzUsImV4cCI6MjEwNTkzOTY3NX0.bGAG6G-rUOGBiKmW_AHRU-wtA0XjDrUt6e7L9Qo7zY4";

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

  // Handle case where NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are swapped
  if (!isValidHttpUrl(rawUrl) && isValidHttpUrl(rawKey)) {
    return {
      supabaseUrl: rawKey,
      supabaseAnonKey: rawUrl || FALLBACK_SUPABASE_ANON_KEY,
    };
  }

  return {
    supabaseUrl: isValidHttpUrl(rawUrl) ? rawUrl : FALLBACK_SUPABASE_URL,
    supabaseAnonKey: rawKey && !isValidHttpUrl(rawKey) ? rawKey : FALLBACK_SUPABASE_ANON_KEY,
  };
}
