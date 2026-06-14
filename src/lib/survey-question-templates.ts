import type { NewSurveyQuestion, SurveyQuestionType } from "@/types/survey-question";

export type SurveyQuestionTemplateId = "customer_profile" | "purchase_review" | "product_review" | "blank";

export type SurveyQuestionTemplate = {
  id: SurveyQuestionTemplateId;
  title: string;
  description: string;
  questions: Array<{
    title: string;
    type: SurveyQuestionType;
    description?: string;
    required?: boolean;
    options?: string[];
  }>;
};

export const surveyQuestionTemplates: SurveyQuestionTemplate[] = [
  {
    id: "customer_profile",
    title: "Conhecer meu cliente",
    description: "Perguntas simples sobre perfil e frequencia de compra.",
    questions: [
      {
        title: "Sexo",
        type: "single_choice",
        options: ["Feminino", "Masculino", "Prefiro nao informar"],
      },
      {
        title: "Faixa etaria",
        type: "single_choice",
        options: ["Ate 18 anos", "19 a 29 anos", "30 a 44 anos", "45 a 59 anos", "60 anos ou mais"],
      },
      {
        title: "Cidade",
        type: "short_text",
      },
      {
        title: "Frequencia de compra",
        type: "single_choice",
        options: ["Primeira compra", "Compro de vez em quando", "Compro com frequencia"],
      },
    ],
  },
  {
    id: "purchase_review",
    title: "Avaliar uma compra",
    description: "Entenda como foi a experiencia recente do consumidor.",
    questions: [
      {
        title: "Como foi sua experiencia?",
        type: "long_text",
      },
      {
        title: "Nota de 1 a 5",
        type: "rating",
      },
      {
        title: "Voce compraria novamente?",
        type: "single_choice",
        options: ["Sim", "Nao", "Talvez"],
      },
      {
        title: "Comentario",
        type: "long_text",
      },
    ],
  },
  {
    id: "product_review",
    title: "Avaliar um produto",
    description: "Colete percepcoes sobre um produto especifico.",
    questions: [
      {
        title: "Qual produto comprou?",
        type: "short_text",
      },
      {
        title: "Como avalia o produto?",
        type: "rating",
      },
      {
        title: "O que mais gostou?",
        type: "long_text",
      },
      {
        title: "O que melhoraria?",
        type: "long_text",
      },
    ],
  },
  {
    id: "blank",
    title: "Comecar do zero",
    description: "Crie as perguntas uma por uma.",
    questions: [],
  },
];

export function getSurveyQuestionTemplate(templateId: SurveyQuestionTemplateId) {
  return surveyQuestionTemplates.find((template) => template.id === templateId) ?? surveyQuestionTemplates[0];
}

export function createQuestionsFromTemplate(
  templateId: SurveyQuestionTemplateId,
  surveyId: string,
): NewSurveyQuestion[] {
  const template = getSurveyQuestionTemplate(templateId);

  return template.questions.map((question, index) => ({
    survey_id: surveyId,
    type: question.type,
    title: question.title,
    description: question.description ?? null,
    required: question.required ?? false,
    position: index + 1,
    options: question.options ?? [],
  }));
}
