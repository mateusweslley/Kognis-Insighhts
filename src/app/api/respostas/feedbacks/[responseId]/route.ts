import { NextRequest, NextResponse } from "next/server";

import { requireCurrentCompany } from "@/lib/company";
import { getCompanyFeedbackResponse } from "@/lib/responses";

export async function GET(
  _request: NextRequest,
  { params }: { params: { responseId: string } },
) {
  const company = await requireCurrentCompany();
  try {
    const result = await getCompanyFeedbackResponse(company.id, params.responseId);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
    if (!result.response) return NextResponse.json({ error: "Resposta não encontrada." }, { status: 404 });
    return NextResponse.json(result.response);
  } catch {
    return NextResponse.json({ error: "Nao foi possivel carregar a resposta." }, { status: 500 });
  }
}
