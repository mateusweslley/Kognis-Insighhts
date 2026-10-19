create extension if not exists pgcrypto;

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint surveys_title_min_length check (char_length(trim(title)) >= 3),
  constraint surveys_status_check check (status in ('draft', 'active', 'archived'))
);

drop trigger if exists surveys_set_updated_at on public.surveys;

create trigger surveys_set_updated_at
before update on public.surveys
for each row
execute function public.set_updated_at();

alter table public.surveys enable row level security;

drop policy if exists "Users can view own company surveys" on public.surveys;
drop policy if exists "Users can create own company surveys" on public.surveys;
drop policy if exists "Users can update own company surveys" on public.surveys;
drop policy if exists "Users can delete own company surveys" on public.surveys;

create policy "Users can view own company surveys"
on public.surveys
for select
to authenticated
using (
  exists (
    select 1
    from public.companies
    where companies.id = surveys.company_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can create own company surveys"
on public.surveys
for insert
to authenticated
with check (
  exists (
    select 1
    from public.companies
    where companies.id = surveys.company_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can update own company surveys"
on public.surveys
for update
to authenticated
using (
  exists (
    select 1
    from public.companies
    where companies.id = surveys.company_id
      and companies.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.companies
    where companies.id = surveys.company_id
      and companies.owner_id = auth.uid()
  )
);
