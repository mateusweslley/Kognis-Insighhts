-- 2026_metrics_baseline.sql
-- Fundacao de dados da Sprint 1: objective (surveys) e topic (survey_questions).
-- Nao altera registros existentes. Nao altera RLS.

-- 1) surveys.objective
alter table public.surveys
  add column if not exists objective text;

-- 2) survey_questions.topic
-- Sem lista fechada. Vocabulario livre; apenas validacao minima abaixo.
alter table public.survey_questions
  add column if not exists topic text;

-- 3) constraint de objective (apenas 'blank' e 'custom')
alter table public.surveys
  drop constraint if exists surveys_objective_check;

alter table public.surveys
  add constraint surveys_objective_check
  check (
    objective is null
    or objective in ('blank', 'custom')
  );

-- 4) validacao minima de topic: impede valor em branco, sem restringir vocabulario
alter table public.survey_questions
  drop constraint if exists survey_questions_topic_min_length;

alter table public.survey_questions
  add constraint survey_questions_topic_min_length
  check (topic is null or char_length(trim(topic)) >= 2);
