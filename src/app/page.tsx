import { LandingHero } from "@/components/marketing/landing-hero";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <LandingHero isAuthenticated={Boolean(user)} />;
}
