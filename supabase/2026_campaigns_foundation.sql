-- 2026_campaigns_foundation.sql
-- Sprint 1: Fundação de Campanhas.
--
-- Evolui public.campaigns e cria as tabelas de vínculo (campaign_surveys),
-- recompensa (campaign_rewards) e claims (campaign_claims), com RLS por empresa.
--
-- Nao altera surveys, survey_questions nem responses estruturalmente.
-- Nao remove campaigns.survey_id (mantido por compatibilidade nesta sprint).
-- Nao desabilita RLS. Nao concede acesso anonimo a rewards/claims/codigos.

create extension if not exists pgcrypto;

-- ============================================================
-- 1) Evoluir public.campaigns
-- ============================================================

alter table public.campaigns
  add column if not exists campaign_type text not null default 'reward_on_response';

alter table public.campaigns
  add column if not exists starts_at timestamptz;

alter table public.campaigns
  add column if not exists ends_at timestamptz;

alter table public.campaigns
  add column if not exists max_claims_total integer;

alter table public.campaigns
  add column if not exists identity_requirement text not null default 'none';

alter table public.campaigns
  add column if not exists claim_validity_days integer;

alter table public.campaigns
  add column if not exists completion_message text;

-- Amplia o status para incluir "paused". "expired" é derivado de ends_at,
-- nunca persistido.
alter table public.campaigns
  drop constraint if exists campaigns_status_check;

alter table public.campaigns
  add constraint campaigns_status_check
  check (status in ('draft', 'active', 'paused', 'archived'));

alter table public.campaigns
  drop constraint if exists campaigns_campaign_type_check;

alter table public.campaigns
  add constraint campaigns_campaign_type_check
  check (campaign_type in ('reward_on_response'));

alter table public.campaigns
  drop constraint if exists campaigns_identity_requirement_check;

alter table public.campaigns
  add constraint campaigns_identity_requirement_check
  check (identity_requirement in ('none', 'email', 'phone'));

alter table public.campaigns
  drop constraint if exists campaigns_max_claims_positive;

alter table public.campaigns
  add constraint campaigns_max_claims_positive
  check (max_claims_total is null or max_claims_total > 0);

alter table public.campaigns
  drop constraint if exists campaigns_claim_validity_positive;

alter table public.campaigns
  add constraint campaigns_claim_validity_positive
  check (claim_validity_days is null or claim_validity_days > 0);

alter table public.campaigns
  drop constraint if exists campaigns_dates_order;

alter table public.campaigns
  add constraint campaigns_dates_order
  check (starts_at is null or ends_at is null or starts_at <= ends_at);

-- ============================================================
-- 2) campaign_surveys (Campanha N:N Pesquisa)
-- ============================================================

create table if not exists public.campaign_surveys (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  survey_id uuid not null references public.surveys(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campaign_id, survey_id)
);

create index if not exists campaign_surveys_survey_id_idx
  on public.campaign_surveys (survey_id);

-- ============================================================
-- 3) Backfill de campaigns.survey_id -> campaign_surveys
-- ============================================================

insert into public.campaign_surveys (campaign_id, survey_id)
select c.id, c.survey_id
from public.campaigns c
where c.survey_id is not null
on conflict (campaign_id, survey_id) do nothing;

-- ============================================================
-- 4) campaign_rewards (uma recompensa por campanha no MVP)
-- ============================================================

create table if not exists public.campaign_rewards (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  type text not null,
  title text,
  description text,
  value numeric,
  code_mode text not null default 'unique',
  fixed_code text,
  instructions text,
  terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_rewards_type_check check (
    type in ('percentage', 'fixed_amount', 'gift', 'custom')
  ),
  constraint campaign_rewards_code_mode_check check (
    code_mode in ('unique', 'fixed')
  ),
  -- No MVP uma campanha possui uma unica recompensa.
  constraint campaign_rewards_campaign_id_key unique (campaign_id)
);

drop trigger if exists campaign_rewards_set_updated_at on public.campaign_rewards;

create trigger campaign_rewards_set_updated_at
before update on public.campaign_rewards
for each row
execute function public.set_updated_at();

-- ============================================================
-- 5) campaign_claims ("esta resposta recebeu esta recompensa")
-- ============================================================

create table if not exists public.campaign_claims (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  reward_id uuid references public.campaign_rewards(id) on delete set null,
  survey_id uuid references public.surveys(id) on delete set null,
  response_id uuid references public.responses(id) on delete set null,
  code text,
  claim_token text,
  status text not null default 'issued',
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by text,
  identity_hash text,
  device_hash text,
  reward_snapshot jsonb,
  submission_key text,
  created_at timestamptz not null default now(),
  constraint campaign_claims_status_check check (
    status in ('issued', 'redeemed', 'voided')
  ),
  constraint campaign_claims_response_id_key unique (response_id),
  constraint campaign_claims_code_key unique (code),
  constraint campaign_claims_submission_key_key unique (submission_key),
  constraint campaign_claims_reward_snapshot_object_check check (
    reward_snapshot is null or jsonb_typeof(reward_snapshot) = 'object'
  )
);

create index if not exists campaign_claims_company_id_idx
  on public.campaign_claims (company_id);

create index if not exists campaign_claims_campaign_id_idx
  on public.campaign_claims (campaign_id);

create index if not exists campaign_claims_survey_id_idx
  on public.campaign_claims (survey_id);

-- ============================================================
-- 6) Integridade: campanha e pesquisa na mesma empresa
--    (campaign_surveys)
-- ============================================================

create or replace function public.campaign_surveys_check_company()
returns trigger
language plpgsql
as $$
declare
  camp_company uuid;
  surv_company uuid;
begin
  select company_id into camp_company
  from public.campaigns where id = new.campaign_id;

  select company_id into surv_company
  from public.surveys where id = new.survey_id;

  if camp_company is null or surv_company is null then
    raise exception 'Campaign or survey not found';
  end if;

  if camp_company <> surv_company then
    raise exception 'Campaign and survey must belong to the same company';
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_surveys_check_company_trigger on public.campaign_surveys;

create trigger campaign_surveys_check_company_trigger
before insert or update on public.campaign_surveys
for each row
execute function public.campaign_surveys_check_company();

-- ============================================================
-- 7) Integridade: reward da mesma empresa da campanha
-- ============================================================

create or replace function public.campaign_rewards_check_company()
returns trigger
language plpgsql
as $$
declare
  camp_company uuid;
begin
  select company_id into camp_company
  from public.campaigns where id = new.campaign_id;

  if camp_company is null then
    raise exception 'Campaign not found';
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_rewards_check_company_trigger on public.campaign_rewards;

create trigger campaign_rewards_check_company_trigger
before insert or update on public.campaign_rewards
for each row
execute function public.campaign_rewards_check_company();

-- ============================================================
-- 8) Integridade: claim consistente com campanha/survey/empresa
-- ============================================================

create or replace function public.campaign_claims_check_integrity()
returns trigger
language plpgsql
as $$
declare
  camp_company uuid;
  claim_survey uuid;
begin
  select company_id into camp_company
  from public.campaigns where id = new.campaign_id;

  if camp_company is null then
    raise exception 'Campaign not found';
  end if;

  if new.company_id <> camp_company then
    raise exception 'Claim company must match campaign company';
  end if;

  -- A survey do claim (se informada) deve pertencer à mesma empresa da campanha.
  if new.survey_id is not null then
    select company_id into claim_survey
    from public.surveys where id = new.survey_id;

    if claim_survey <> camp_company then
      raise exception 'Claim survey must belong to the campaign company';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_claims_check_integrity_trigger on public.campaign_claims;

create trigger campaign_claims_check_integrity_trigger
before insert or update on public.campaign_claims
for each row
execute function public.campaign_claims_check_integrity();

-- ============================================================
-- 9) Regra de produto (MVP): uma pesquisa nao pode ter mais de
--    uma campanha ATIVA ao mesmo tempo.
--    Cobre tanto o vinculo N:N (campaign_surveys) quanto o legado
--    (campaigns.survey_id).
-- ============================================================

create or replace function public.campaigns_assert_no_active_conflict(
  p_survey_id uuid,
  p_campaign_id uuid
)
returns void
language plpgsql
as $$
declare
  conflict_count integer;
begin
  select count(*) into conflict_count
  from public.campaigns c
  where c.id <> p_campaign_id
    and c.status = 'active'
    and (
      c.survey_id = p_survey_id
      or exists (
        select 1
        from public.campaign_surveys cs
        where cs.campaign_id = c.id
          and cs.survey_id = p_survey_id
      )
    );

  if conflict_count > 0 then
    raise exception 'Survey already has an active campaign';
  end if;
end;
$$;

create or replace function public.campaign_surveys_enforce_active()
returns trigger
language plpgsql
as $$
declare
  is_active boolean;
begin
  select (status = 'active') into is_active
  from public.campaigns where id = new.campaign_id;

  if is_active then
    perform public.campaigns_assert_no_active_conflict(new.survey_id, new.campaign_id);
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_surveys_enforce_active_trigger on public.campaign_surveys;

create trigger campaign_surveys_enforce_active_trigger
before insert or update on public.campaign_surveys
for each row
execute function public.campaign_surveys_enforce_active();

create or replace function public.campaigns_enforce_active()
returns trigger
language plpgsql
as $$
declare
  r record;
begin
  if new.status = 'active' then
    -- vínculo legado
    if new.survey_id is not null then
      perform public.campaigns_assert_no_active_conflict(new.survey_id, new.id);
    end if;

    -- vínculos N:N
    for r in
      select survey_id from public.campaign_surveys where campaign_id = new.id
    loop
      perform public.campaigns_assert_no_active_conflict(r.survey_id, new.id);
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_enforce_active_trigger on public.campaigns;

create trigger campaigns_enforce_active_trigger
before update on public.campaigns
for each row
when (new.status is distinct from old.status)
execute function public.campaigns_enforce_active();

-- ============================================================
-- 10) RLS
-- ============================================================

alter table public.campaign_surveys enable row level security;
alter table public.campaign_rewards enable row level security;
alter table public.campaign_claims enable row level security;

-- campaign_surveys -------------------------------------------

drop policy if exists "Users can view own company campaign surveys" on public.campaign_surveys;
drop policy if exists "Users can create own company campaign surveys" on public.campaign_surveys;
drop policy if exists "Users can delete own company campaign surveys" on public.campaign_surveys;

create policy "Users can view own company campaign surveys"
on public.campaign_surveys
for select
to authenticated
using (
  exists (
    select 1
    from public.campaigns
    join public.companies on companies.id = campaigns.company_id
    where campaigns.id = campaign_surveys.campaign_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can create own company campaign surveys"
on public.campaign_surveys
for insert
to authenticated
with check (
  exists (
    select 1
    from public.campaigns
    join public.companies on companies.id = campaigns.company_id
    where campaigns.id = campaign_surveys.campaign_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can delete own company campaign surveys"
on public.campaign_surveys
for delete
to authenticated
using (
  exists (
    select 1
    from public.campaigns
    join public.companies on companies.id = campaigns.company_id
    where campaigns.id = campaign_surveys.campaign_id
      and companies.owner_id = auth.uid()
  )
);

-- campaign_rewards -------------------------------------------

drop policy if exists "Users can view own company campaign rewards" on public.campaign_rewards;
drop policy if exists "Users can create own company campaign rewards" on public.campaign_rewards;
drop policy if exists "Users can update own company campaign rewards" on public.campaign_rewards;
drop policy if exists "Users can delete own company campaign rewards" on public.campaign_rewards;

create policy "Users can view own company campaign rewards"
on public.campaign_rewards
for select
to authenticated
using (
  exists (
    select 1
    from public.campaigns
    join public.companies on companies.id = campaigns.company_id
    where campaigns.id = campaign_rewards.campaign_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can create own company campaign rewards"
on public.campaign_rewards
for insert
to authenticated
with check (
  exists (
    select 1
    from public.campaigns
    join public.companies on companies.id = campaigns.company_id
    where campaigns.id = campaign_rewards.campaign_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can update own company campaign rewards"
on public.campaign_rewards
for update
to authenticated
using (
  exists (
    select 1
    from public.campaigns
    join public.companies on companies.id = campaigns.company_id
    where campaigns.id = campaign_rewards.campaign_id
      and companies.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.campaigns
    join public.companies on companies.id = campaigns.company_id
    where campaigns.id = campaign_rewards.campaign_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can delete own company campaign rewards"
on public.campaign_rewards
for delete
to authenticated
using (
  exists (
    select 1
    from public.campaigns
    join public.companies on companies.id = campaigns.company_id
    where campaigns.id = campaign_rewards.campaign_id
      and companies.owner_id = auth.uid()
  )
);

-- campaign_claims --------------------------------------------

drop policy if exists "Users can view own company campaign claims" on public.campaign_claims;
drop policy if exists "Users can create own company campaign claims" on public.campaign_claims;
drop policy if exists "Users can update own company campaign claims" on public.campaign_claims;

create policy "Users can view own company campaign claims"
on public.campaign_claims
for select
to authenticated
using (
  exists (
    select 1
    from public.companies
    where companies.id = campaign_claims.company_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can create own company campaign claims"
on public.campaign_claims
for insert
to authenticated
with check (
  exists (
    select 1
    from public.companies
    where companies.id = campaign_claims.company_id
      and companies.owner_id = auth.uid()
  )
);

create policy "Users can update own company campaign claims"
on public.campaign_claims
for update
to authenticated
using (
  exists (
    select 1
    from public.companies
    where companies.id = campaign_claims.company_id
      and companies.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.companies
    where companies.id = campaign_claims.company_id
      and companies.owner_id = auth.uid()
  )
);

-- ============================================================
-- 11) Grants
-- ============================================================

grant select, insert, update, delete
on public.campaign_surveys
to authenticated;

grant select, insert, update, delete
on public.campaign_rewards
to authenticated;

grant select, insert, update
on public.campaign_claims
to authenticated;

-- Nenhum grant para a role anon: rewards, claims e codigos
-- permanecem inacessiveis para acesso anonimo.
