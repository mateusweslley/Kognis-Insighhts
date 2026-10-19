import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PrimaryQuestionSetting } from "@/components/surveys/primary-question-setting";
import type { SurveyQuestion } from "@/types/survey-question";

const ratingQuestion: SurveyQuestion = {
  id: "rating-question",
  survey_id: "survey-1",
  type: "rating",
  title: "Como você avalia o atendimento?",
  description: null,
  required: true,
  position: 1,
  options: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const otherQuestion: SurveyQuestion = {
  ...ratingQuestion,
  id: "text-question",
  type: "short_text",
  title: "Comentário",
};

function renderSetting(overrides: Partial<Parameters<typeof PrimaryQuestionSetting>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(PrimaryQuestionSetting, {
      questions: [ratingQuestion, otherQuestion],
      selectedQuestionId: null,
      savedQuestionId: null,
      isLoading: false,
      isSaving: false,
      error: null,
      message: null,
      onChange: vi.fn(),
      onSave: vi.fn(),
      ...overrides,
    }),
  );
}

describe("PrimaryQuestionSetting", () => {
  it("does not select a question automatically and lists only 1-to-5 ratings", () => {
    const markup = renderSetting();

    expect(markup).toContain("Nenhuma pergunta principal");
    expect(markup).toContain("Como você avalia o atendimento?");
    expect(markup).not.toContain("value=\"text-question\"");
    expect(markup).toContain("Nenhuma pergunta será escolhida automaticamente.");
  });

  it("explains when the survey has no eligible rating question", () => {
    const markup = renderSetting({ questions: [otherQuestion] });

    expect(markup).toContain("Crie uma pergunta do tipo avaliação de 1 a 5");
    expect(markup).not.toContain("Selecionada:");
  });

  it("shows the current selection and the historical recalculation warning before saving a change", () => {
    const markup = renderSetting({
      selectedQuestionId: "rating-question",
      savedQuestionId: "old-rating-question",
    });

    expect(markup).toContain("Como você avalia o atendimento?");
    expect(markup).toContain("a média e a percepção positiva históricas serão recalculadas");
    expect(markup).toContain("As respostas já recebidas não serão alteradas");
  });

  it("announces persistence errors and success with accessible status roles", () => {
    expect(renderSetting({ error: "Falha ao salvar" })).toContain('role="alert"');
    expect(renderSetting({ message: "Configuração salva" })).toContain('role="status"');
  });
});
