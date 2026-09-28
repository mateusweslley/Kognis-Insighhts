-- 2026_question_types.sql
-- Adiciona os novos tipos estruturados de pergunta ao CHECK de survey_questions.type.
-- Nao é destrutiva: apenas amplia a lista de tipos aceitos.
-- Nao altera registros existentes nem RLS.

alter table public.survey_questions
  drop constraint if exists survey_questions_type_check;

alter table public.survey_questions
  add constraint survey_questions_type_check
  check (
    type in (
      'short_text',
      'long_text',
      'single_choice',
      'rating',
      'full_name',
      'email',
      'phone',
      'number',
      'rating_10'
    )
  );
