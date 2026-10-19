create extension if not exists pgcrypto;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  survey_id uuid references public.surveys(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint campaigns_name_min_length check (char_length(trim(name)) >= 3),
  constraint campaigns_status_check check (status in ('draft', 'active', 'archived'))
);

drop trigger if exists campaigns_set_updated_at on public.campaigns;

create trigger campaigns_set_updated_at
before update on public.campaigns
for each row
execute function public.set_updated_at();

alter table public.campaigns enable row level security;

drop policy if exists "Users can view own company campaigns" on public.campaigns;
drop policy if exists "Users can create own company campaigns" on public.campaigns;
drop policy if exists "Users can update own company campaigns" on public.campaigns;
drop policy if exists "Users can delete own company campaigns" on public.campaigns;

create policy "Users can view own company campaigns"
on public.campaigns
for select
to authenticated
using (
  exists (
    select 1
    from public.companies
    where companies.id = campaigns.company_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can create own company campaigns"
on public.campaigns
for insert
to authenticated
with check (
  exists (
    select 1
    from public.companies
    where companies.id = campaigns.company_id
      and companies.owner_id = auth.uid()
  )
  and (
    survey_id is null
    or exists (
      select 1
      from public.surveys
      join public.companies on companies.id = surveys.company_id
      where surveys.id = campaigns.survey_id
        and companies.owner_id = auth.uid()
    )
  )
);

create policy "Users can update own company campaigns"
on public.campaigns
for update
to authenticated
using (
  exists (
    select 1
    from public.companies
    where companies.id = campaigns.company_id
      and companies.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.companies
    where companies.id = campaigns.company_id
      and companies.owner_id = auth.uid()
  )
  and (
    survey_id is null
    or exists (
      select 1
      from public.surveys
      join public.companies on companies.id = surveys.company_id
      where surveys.id = campaigns.survey_id
        and companies.owner_id = auth.uid()
    )
  )
);
