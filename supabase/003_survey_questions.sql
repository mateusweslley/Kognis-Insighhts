create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  type text not null,
  title text not null,
  description text,
  required boolean default false,
  position integer not null,
  options jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint survey_questions_type_check check (
    type in ('short_text', 'long_text', 'single_choice', 'rating')
  ),
  constraint survey_questions_title_min_length check (char_length(trim(title)) >= 2),
  constraint survey_questions_position_positive check (position >= 1),
  constraint survey_questions_options_array_check check (jsonb_typeof(options) = 'array')
);

drop trigger if exists survey_questions_set_updated_at on public.survey_questions;

create trigger survey_questions_set_updated_at
before update on public.survey_questions
for each row
execute function public.set_updated_at();

alter table public.survey_questions enable row level security;

drop policy if exists "Users can view own company survey questions" on public.survey_questions;
drop policy if exists "Users can create own company survey questions" on public.survey_questions;
drop policy if exists "Users can update own company survey questions" on public.survey_questions;
drop policy if exists "Users can delete own company survey questions" on public.survey_questions;
drop policy if exists "Public can view active survey questions" on public.survey_questions;

create policy "Users can view own company survey questions"
on public.survey_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.surveys
    join public.companies on companies.id = surveys.company_id
    where surveys.id = survey_questions.survey_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Public can view active survey questions"
on public.survey_questions
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.surveys
    where surveys.id = survey_questions.survey_id
      and surveys.status = 'active'
  )
);

create policy "Users can create own company survey questions"
on public.survey_questions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.surveys
    join public.companies on companies.id = surveys.company_id
    where surveys.id = survey_questions.survey_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can update own company survey questions"
on public.survey_questions
for update
to authenticated
using (
  exists (
    select 1
    from public.surveys
    join public.companies on companies.id = surveys.company_id
    where surveys.id = survey_questions.survey_id
      and companies.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.surveys
    join public.companies on companies.id = surveys.company_id
    where surveys.id = survey_questions.survey_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can delete own company survey questions"
on public.survey_questions
for delete
to authenticated
using (
  exists (
    select 1
    from public.surveys
    join public.companies on companies.id = surveys.company_id
    where surveys.id = survey_questions.survey_id
      and companies.owner_id = auth.uid()
  )
);
