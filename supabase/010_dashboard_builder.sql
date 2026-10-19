-- 2026_dashboard_builder.sql
-- Sprint 2: Dashboard Builder.
-- Cria as tabelas de dashboards, widgets e templates com RLS por empresa.
-- Nao altera RLS existente de surveys/responses.

create extension if not exists pgcrypto;

-- 1) dashboards
create table if not exists public.dashboards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  template_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint dashboards_name_min_length check (char_length(trim(name)) >= 2)
);

drop trigger if exists dashboards_set_updated_at on public.dashboards;

create trigger dashboards_set_updated_at
before update on public.dashboards
for each row
execute function public.set_updated_at();

-- 2) dashboard_widgets
create table if not exists public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  title text not null,
  survey_id uuid references public.surveys(id) on delete set null,
  question_id uuid references public.survey_questions(id) on delete set null,
  metric text not null,
  visualization text not null,
  config jsonb not null default '{}'::jsonb,
  position integer not null default 1,
  width integer not null default 1,
  height integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint dashboard_widgets_title_min_length check (char_length(trim(title)) >= 1),
  constraint dashboard_widgets_position_positive check (position >= 1),
  constraint dashboard_widgets_width_positive check (width >= 1),
  constraint dashboard_widgets_height_positive check (height >= 1),
  constraint dashboard_widgets_config_object_check check (jsonb_typeof(config) = 'object')
);

drop trigger if exists dashboard_widgets_set_updated_at on public.dashboard_widgets;

create trigger dashboard_widgets_set_updated_at
before update on public.dashboard_widgets
for each row
execute function public.set_updated_at();

-- 3) dashboard_templates (recursos globais do Kognis; sem RLS por empresa)
create table if not exists public.dashboard_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  type text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint dashboard_templates_name_min_length check (char_length(trim(name)) >= 2),
  constraint dashboard_templates_config_object_check check (jsonb_typeof(config) = 'object')
);

drop trigger if exists dashboard_templates_set_updated_at on public.dashboard_templates;

create trigger dashboard_templates_set_updated_at
before update on public.dashboard_templates
for each row
execute function public.set_updated_at();

-- 4) RLS

alter table public.dashboards enable row level security;
alter table public.dashboard_widgets enable row level security;
alter table public.dashboard_templates enable row level security;

drop policy if exists "Users can view own company dashboards" on public.dashboards;
drop policy if exists "Users can create own company dashboards" on public.dashboards;
drop policy if exists "Users can update own company dashboards" on public.dashboards;
drop policy if exists "Users can delete own company dashboards" on public.dashboards;

create policy "Users can view own company dashboards"
on public.dashboards
for select
to authenticated
using (
  exists (
    select 1
    from public.companies
    where companies.id = dashboards.company_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can create own company dashboards"
on public.dashboards
for insert
to authenticated
with check (
  exists (
    select 1
    from public.companies
    where companies.id = dashboards.company_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can update own company dashboards"
on public.dashboards
for update
to authenticated
using (
  exists (
    select 1
    from public.companies
    where companies.id = dashboards.company_id
      and companies.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.companies
    where companies.id = dashboards.company_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can delete own company dashboards"
on public.dashboards
for delete
to authenticated
using (
  exists (
    select 1
    from public.companies
    where companies.id = dashboards.company_id
      and companies.owner_id = auth.uid()
  )
);

-- Widgets: isolamento por empresa via relação com dashboards.
drop policy if exists "Users can view own company dashboard widgets" on public.dashboard_widgets;
drop policy if exists "Users can create own company dashboard widgets" on public.dashboard_widgets;
drop policy if exists "Users can update own company dashboard widgets" on public.dashboard_widgets;
drop policy if exists "Users can delete own company dashboard widgets" on public.dashboard_widgets;

create policy "Users can view own company dashboard widgets"
on public.dashboard_widgets
for select
to authenticated
using (
  exists (
    select 1
    from public.dashboards
    join public.companies on companies.id = dashboards.company_id
    where dashboards.id = dashboard_widgets.dashboard_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can create own company dashboard widgets"
on public.dashboard_widgets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.dashboards
    join public.companies on companies.id = dashboards.company_id
    where dashboards.id = dashboard_widgets.dashboard_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can update own company dashboard widgets"
on public.dashboard_widgets
for update
to authenticated
using (
  exists (
    select 1
    from public.dashboards
    join public.companies on companies.id = dashboards.company_id
    where dashboards.id = dashboard_widgets.dashboard_id
      and companies.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.dashboards
    join public.companies on companies.id = dashboards.company_id
    where dashboards.id = dashboard_widgets.dashboard_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can delete own company dashboard widgets"
on public.dashboard_widgets
for delete
to authenticated
using (
  exists (
    select 1
    from public.dashboards
    join public.companies on companies.id = dashboards.company_id
    where dashboards.id = dashboard_widgets.dashboard_id
      and companies.owner_id = auth.uid()
  )
);

-- Templates internos: leitura global para usuários autenticados.
drop policy if exists "Authenticated can view dashboard templates" on public.dashboard_templates;

create policy "Authenticated can view dashboard templates"
on public.dashboard_templates
for select
to authenticated
using (is_active = true);

-- Permissões para a role authenticated.
-- RLS continua responsável pelo controle por empresa.

grant select, insert, update, delete
on public.dashboards
to authenticated;

grant select, insert, update, delete
on public.dashboard_widgets
to authenticated;

grant select
on public.dashboard_templates
to authenticated;