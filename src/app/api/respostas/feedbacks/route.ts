import { NextRequest, NextResponse } from "next/server";

import { requireCurrentCompany } from "@/lib/company";
import { decodeFeedbackCursor } from "@/lib/feedback-feed";
import { getCompanyFeedbackPage } from "@/lib/responses";

export async function GET(request: NextRequest) {
  const rawCursor = request.nextUrl.searchParams.get("cursor");
  const cursor = decodeFeedbackCursor(rawCursor);
  if (rawCursor && !cursor) {
    return NextResponse.json({ error: "Cursor inválido." }, { status: 400 });
  }

  const company = await requireCurrentCompany();
  try {
    const result = await getCompanyFeedbackPage(company.id, cursor);
    if (result.error || !result.page) {
      return NextResponse.json({ error: result.error ?? "Erro ao carregar feedbacks." }, { status: 500 });
    }
    return NextResponse.json(result.page);
  } catch {
    return NextResponse.json({ error: "Nao foi possivel carregar os feedbacks agora." }, { status: 500 });
  }
}
