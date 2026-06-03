import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/types/company";

export async function getCurrentCompany() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Nao foi possivel carregar os dados da empresa.");
  }

  return data as Company | null;
}

export async function requireCurrentCompany() {
  const company = await getCurrentCompany();

  if (!company) {
    redirect("/onboarding");
  }

  return company;
}
