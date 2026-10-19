import * as React from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { SurveyQuestion } from "@/types/survey-question";

type PrimaryQuestionSettingProps = {
  questions: SurveyQuestion[];
  selectedQuestionId: string | null;
  savedQuestionId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  message: string | null;
  onChange: (questionId: string | null) => void;
  onSave: () => void;
};

export function PrimaryQuestionSetting({
  questions,
  selectedQuestionId,
  savedQuestionId,
  isLoading,
  isSaving,
  error,
  message,
  onChange,
  onSave,
}: PrimaryQuestionSettingProps) {
  const eligibleQuestions = questions.filter((question) => question.type === "rating");
  const selectedQuestion = questions.find((question) => question.id === selectedQuestionId);
  const savedQuestionExists = eligibleQuestions.some((question) => question.id === savedQuestionId);
  const hasPendingChange = selectedQuestionId !== savedQuestionId;

  return (
    <section
      className="space-y-3 rounded-md border border-border bg-surface-muted p-4"
      aria-labelledby="primary-question-heading"
    >
      <div>
        <h2 id="primary-question-heading" className="text-sm font-semibold text-text-primary">
          Pergunta principal de avaliação
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Selecione explicitamente uma pergunta de avaliação de 1 a 5. Essa configuração poderá ser usada nos indicadores do dashboard.
        </p>
      </div>

      {isLoading ? <p role="status" className="text-sm text-muted-foreground">Carregando configuração...</p> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {message ? <p role="status" className="text-sm text-success">{message}</p> : null}

      {!isLoading && !error ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="primary-question-select">Pergunta configurada</Label>
            <Select
              id="primary-question-select"
              value={selectedQuestionId ?? ""}
              onChange={(event) => onChange(event.target.value || null)}
              disabled={isSaving}
              aria-describedby="primary-question-help"
            >
              <option value="">Nenhuma pergunta principal</option>
              {savedQuestionId && !savedQuestionExists ? (
                <option value={savedQuestionId}>Configuração atual indisponível</option>
              ) : null}
              {eligibleQuestions.map((question) => (
                <option key={question.id} value={question.id}>
                  {question.title}
                </option>
              ))}
            </Select>
            <p id="primary-question-help" className="text-xs text-muted-foreground">
              {eligibleQuestions.length === 0
                ? "Crie uma pergunta do tipo avaliação de 1 a 5 para poder configurá-la."
                : selectedQuestion
                  ? `Selecionada: ${selectedQuestion.title}`
                  : "Nenhuma pergunta será escolhida automaticamente."}
            </p>
          </div>

          {hasPendingChange && savedQuestionId ? (
            <p className="rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-sm text-warning">
              Ao salvar, a média e a percepção positiva históricas serão recalculadas usando a nova pergunta. As respostas já recebidas não serão alteradas.
            </p>
          ) : null}

          <Button
            type="button"
            variant="secondary"
            onClick={onSave}
            disabled={isSaving || !hasPendingChange}
          >
            {isSaving ? "Salvando configuração..." : "Salvar pergunta principal"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
