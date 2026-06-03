create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  segment text,
  logo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint companies_owner_id_key unique (owner_id),
  constraint companies_name_min_length check (char_length(trim(name)) >= 2),
  constraint companies_segment_check check (
    segment is null
    or segment in ('Moda', 'Varejo', 'Alimentação', 'Serviços', 'Tecnologia', 'Outros')
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_set_updated_at on public.companies;

create trigger companies_set_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

alter table public.companies enable row level security;

drop policy if exists "Users can view own company" on public.companies;
drop policy if exists "Users can create own company" on public.companies;
drop policy if exists "Users can update own company" on public.companies;
drop policy if exists "Users can delete own company" on public.companies;

create policy "Users can view own company"
on public.companies
for select
to authenticated
using (auth.uid() = owner_id);

create policy "Users can create own company"
on public.companies
for insert
to authenticated
with check (auth.uid() = owner_id);

create policy "Users can update own company"
on public.companies
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Users can delete own company"
on public.companies
for delete
to authenticated
using (auth.uid() = owner_id);
