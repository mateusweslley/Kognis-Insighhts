-- Persists an optional, explicitly selected 1-to-5 rating question per survey.
-- Existing surveys remain unconfigured; historical responses are not changed.

alter table public.survey_questions
  add constraint survey_questions_id_survey_id_key unique (id, survey_id);

alter table public.surveys
  add column primary_question_id uuid;

alter table public.surveys
  add constraint surveys_primary_question_same_survey_fkey
  foreign key (primary_question_id, id)
  references public.survey_questions (id, survey_id)
  on delete no action;

create or replace function public.validate_survey_primary_question()
returns trigger
language plpgsql
as $$
declare
  selected_question_type text;
begin
  if new.primary_question_id is null then
    return new;
  end if;

  select question.type
    into selected_question_type
  from public.survey_questions as question
  where question.id = new.primary_question_id
    and question.survey_id = new.id
  for update;

  if not found or selected_question_type <> 'rating' then
    raise exception 'Primary question must be a rating question from the same survey'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger surveys_validate_primary_question
before insert or update of id, primary_question_id
on public.surveys
for each row
execute function public.validate_survey_primary_question();

create or replace function public.prevent_incompatible_primary_question_type()
returns trigger
language plpgsql
as $$
begin
  if new.type is distinct from old.type
    and new.type <> 'rating'
    and exists (
      select 1
      from public.surveys
      where surveys.primary_question_id = old.id
    )
  then
    raise exception 'A configured primary question must remain a rating question'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger survey_questions_preserve_primary_question_type
before update of type
on public.survey_questions
for each row
execute function public.prevent_incompatible_primary_question_type();

create or replace function public.clear_deleted_primary_survey_question()
returns trigger
language plpgsql
as $$
begin
  update public.surveys
  set primary_question_id = null
  where id = old.survey_id
    and primary_question_id = old.id;

  return old;
end;
$$;

create trigger survey_questions_clear_deleted_primary_question
before delete
on public.survey_questions
for each row
execute function public.clear_deleted_primary_survey_question();
