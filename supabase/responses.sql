create extension if not exists pgcrypto;

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  answers jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.responses enable row level security;

drop policy if exists "Anyone can view active public surveys" on public.surveys;
drop policy if exists "Visitors can answer active surveys" on public.responses;
drop policy if exists "Users can view own company responses" on public.responses;

create policy "Anyone can view active public surveys"
on public.surveys
for select
to anon, authenticated
using (status = 'active');

create policy "Visitors can answer active surveys"
on public.responses
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.surveys
    where surveys.id = responses.survey_id
      and surveys.status = 'active'
  )
);

create policy "Users can view own company responses"
on public.responses
for select
to authenticated
using (
  exists (
    select 1
    from public.surveys
    join public.companies on companies.id = surveys.company_id
    where surveys.id = responses.survey_id
      and companies.owner_id = auth.uid()
  )
);
