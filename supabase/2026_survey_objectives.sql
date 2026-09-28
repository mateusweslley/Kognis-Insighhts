-- 2026_survey_objectives.sql
-- Separa "objetivo da pesquisa" de "como começar (template)".
--
-- Modelo antigo: objective in (null, 'blank', 'custom')
--   'blank'  misturava "sem objetivo" e "começar do zero".
--   'custom' indicava objetivo personalizado.
--
-- Modelo novo: objective in (
--   'know_customers', 'customer_experience', 'satisfaction',
--   'purchase_intent', 'product_service', 'other', 'undefined'
-- )
--   'other' usa a nova coluna objective_note (texto livre).
--
-- Compatibilidade: NÃO remove nem renomeia valores antigos. A leitura no
-- front-end normaliza 'blank' -> 'undefined' e 'custom' -> 'other'.
-- Esta migration apenas amplia a lista permitida e adiciona a coluna de nota.
-- Nao altera registros existentes nem RLS.

-- 1) Coluna para o texto livre de "Outro objetivo"
alter table public.surveys
  add column if not exists objective_note text;

-- 2) Validação mínima de objective_note (não restringe vocabulário)
alter table public.surveys
  drop constraint if exists surveys_objective_note_min_length;

alter table public.surveys
  add constraint surveys_objective_note_min_length
  check (objective_note is null or char_length(trim(objective_note)) >= 2);

-- 3) Amplia a lista de objetivos permitidos (values antigos continuam aceitos
--    para não quebrar registros existentes durante a transição).
alter table public.surveys
  drop constraint if exists surveys_objective_check;

alter table public.surveys
  add constraint surveys_objective_check
  check (
    objective is null
    or objective in (
      -- valores legados (mantidos temporariamente para compatibilidade de leitura)
      'blank',
      'custom',
      -- novos objetivos
      'know_customers',
      'customer_experience',
      'satisfaction',
      'purchase_intent',
      'product_service',
      'other',
      'undefined'
    )
  );
