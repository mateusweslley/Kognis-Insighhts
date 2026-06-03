import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/pesquisas/:path*",
    "/campanhas/:path*",
    "/respostas/:path*",
    "/configuracoes/:path*",
    "/onboarding",
    "/login",
    "/cadastro",
  ],
};
