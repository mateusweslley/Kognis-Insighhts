/**
 * Read-only diagnostic for the CURRENT unversioned response contract.
 * Not a historical resolver and not integrated into product calculations.
 * Current questions/timestamps are deliberately not accepted as historical proof.
 * See docs/response-history-a8-proposal.md before adopting a persistent contract.
 */
export type HistoricalEvidenceState =
  | "legacy_contract_only"
  | "unknown_history"
  | "no_answer"
  | "invalid_payload";

export type HistoricalEvidenceEntry = {
  responseId: string;
  state: HistoricalEvidenceState;
  /** IDs only: the diagnostic does not copy answer values or personal data. */
  questionIds: string[];
};

export type ResponseHistoryAudit =
  | { status: "error"; reason: string; entries: [] }
  | {
      status: "assessed";
      counts: Record<HistoricalEvidenceState, number>;
      entries: HistoricalEvidenceEntry[];
    };

export function auditResponseHistory({ surveyId, responses, complete, sourceError }: {
  surveyId: string;
  responses: readonly { id: string; survey_id: string; answers: unknown }[];
  /** Must come from a successful complete reader, not from page length. */
  complete: boolean;
  sourceError: string | null;
}): ResponseHistoryAudit {
  if (sourceError || !complete) return { status: "error", reason: "incomplete_source", entries: [] };
  const seen = new Set<string>();
  for (const response of responses) {
    if (!response || !surveyId || response.survey_id !== surveyId
        || !response.id || seen.has(response.id)) {
      return { status: "error", reason: "duplicate_or_out_of_scope", entries: [] };
    }
    seen.add(response.id);
  }
  const entries = responses.map((response): HistoricalEvidenceEntry => {
    const answers = response.answers;
    const entry = (state: HistoricalEvidenceState, questionIds: string[] = []): HistoricalEvidenceEntry =>
      ({ responseId: response.id, state, questionIds });
    if (!isRecord(answers)) return entry("invalid_payload");
    if (Object.hasOwn(answers, "mode")) {
      if (answers.mode !== "dynamic" || !isRecord(answers.answers)) return entry("invalid_payload");
      if (Object.keys(answers).some((key) => key !== "mode" && key !== "answers")) return entry("invalid_payload");
      const values = Object.entries(answers.answers);
      if (values.some(([key, value]) => !key || (typeof value !== "string"
          && (typeof value !== "number" || !Number.isFinite(value))))) return entry("invalid_payload");
      if (!values.length || values.every(([, value]) => typeof value === "string" && !value.trim())) return entry("no_answer");
      // Even a value matching today's options or scale is not historical proof.
      return entry("unknown_history", values.map(([key]) => key).sort());
    }
    if (!Object.keys(answers).length) return entry("no_answer");
    if (Object.keys(answers).some((key) => !["name", "email", "rating", "comment"].includes(key))) return entry("invalid_payload");
    if (typeof answers.name !== "string" || !answers.name.trim()
        || typeof answers.rating !== "number" || !Number.isInteger(answers.rating)
        || answers.rating < 1 || answers.rating > 5
        || [answers.email, answers.comment].some((value) => value != null && typeof value !== "string")) {
      return entry("invalid_payload");
    }
    // The fixed legacy payload proves its 1–5 rating, not an original survey title,
    // dynamic question association or primary-question selection.
    return entry("legacy_contract_only");
  });
  const counts: Record<HistoricalEvidenceState, number> = {
    legacy_contract_only: 0, unknown_history: 0, no_answer: 0, invalid_payload: 0,
  };
  for (const entry of entries) counts[entry.state] += 1;
  return { status: "assessed", counts, entries };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
