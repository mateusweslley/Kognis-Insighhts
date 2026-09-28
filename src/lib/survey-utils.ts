import { surveyObjectives, surveyStatuses } from "@/types/survey";
import type { SurveyObjective, SurveyStatus } from "@/types/survey";

export function isValidSurveyStatus(status: string): status is SurveyStatus {
  return surveyStatuses.includes(status as SurveyStatus);
}

export function isValidSurveyObjective(objective: unknown): objective is SurveyObjective {
  return typeof objective === "string" && surveyObjectives.includes(objective as SurveyObjective);
}

// Normaliza um objetivo vindo do banco (ou de um formulário) para um valor conhecido.
// Mantém compatibilidade com os valores históricos:
//   null / "blank"  -> "undefined"  (começar do zero era criação, não objetivo)
//   "custom"        -> "other"      (objetivo personalizado antigo)
//   texto desconhecido -> "other"
export function normalizeSurveyObjective(objective: unknown): SurveyObjective {
  if (objective === null || objective === undefined || objective === "") {
    return "undefined";
  }

  if (objective === "blank") {
    return "undefined";
  }

  if (objective === "custom") {
    return "other";
  }

  if (isValidSurveyObjective(objective)) {
    return objective;
  }

  return "other";
}

// Normaliza a nota anexa de "Outro objetivo" para string ou null.
export function normalizeObjectiveNote(note: unknown): string | null {
  if (note === null || note === undefined) {
    return null;
  }

  const trimmed = String(note).trim();

  return trimmed.length > 0 ? trimmed : null;
}
