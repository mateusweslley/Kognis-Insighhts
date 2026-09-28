-- 2026_submission_gateway.sql
-- Sprint 2: Submission Gateway + Emissão de Recompensas.
--
-- 1) Adiciona responses.submission_key (nullable) + índice UNIQUE parcial para idempotência.
-- 2) Substitui a constraint global campaign_claims_code_key por índice UNIQUE parcial
--    restrito a code_mode = 'unique', permitindo múltiplos claims com código fixo
--    compartilhado (code_mode = 'fixed').
-- 3) Corrige campaigns_enforce_active_trigger para contemplar BEFORE INSERT OR UPDATE
--    quando status = 'active' ou survey_id é alterado enquanto ativa.
-- 4) Cria a RPC public.submit_public_survey_response (SECURITY DEFINER) como porta
--    única de gravação de respostas públicas + emissão protegida de recompensas.

create extension if not exists pgcrypto;

-- ============================================================
-- 1) Idempotência em public.responses
-- ============================================================

alter table public.responses
  add column if not exists submission_key text;

create unique index if not exists responses_submission_key_unique_idx
  on public.responses (submission_key)
  where submission_key is not null;

-- ============================================================
-- 2) Unicidade de códigos em public.campaign_claims
--    Remove a constraint global campaign_claims_code_key (que impedia
--    múltiplos claims com o mesmo fixed_code em code_mode = 'fixed')
--    e aplica unicidade apenas para códigos gerados em code_mode = 'unique'.
-- ============================================================

alter table public.campaign_claims
  drop constraint if exists campaign_claims_code_key;

create unique index if not exists campaign_claims_unique_code_idx
  on public.campaign_claims (code)
  where code is not null
    and coalesce(reward_snapshot->>'code_mode', 'unique') = 'unique';

create unique index if not exists campaign_claims_campaign_identity_unique_idx
  on public.campaign_claims (campaign_id, identity_hash)
  where identity_hash is not null
    and status <> 'voided';

-- ============================================================
-- 3) Trigger de campanha ativa (INSERT + UPDATE)
-- ============================================================

create or replace function public.campaigns_enforce_active()
returns trigger
language plpgsql
as $$
declare
  r record;
  v_campaign_id uuid;
begin
  if new.status = 'active' then
    v_campaign_id := coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    -- Vínculo legado (campaigns.survey_id)
    if new.survey_id is not null then
      perform public.campaigns_assert_no_active_conflict(new.survey_id, v_campaign_id);
    end if;

    -- Vínculos N:N (campaign_surveys)
    if new.id is not null then
      for r in
        select survey_id from public.campaign_surveys where campaign_id = new.id
      loop
        perform public.campaigns_assert_no_active_conflict(r.survey_id, new.id);
      end loop;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_enforce_active_trigger on public.campaigns;

create trigger campaigns_enforce_active_trigger
before insert or update on public.campaigns
for each row
when (new.status = 'active')
execute function public.campaigns_enforce_active();

-- ============================================================
-- 4) Gerador criptográfico de código único (KOGNIS-XXXXXX)
--    Alfabeto sem caracteres ambíguos (0, O, 1, I).
-- ============================================================

create or replace function public.generate_unique_campaign_code()
returns text
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := gen_random_bytes(6);
  v_result text := 'KOGNIS-';
  v_idx integer;
begin
  for i in 0..5 loop
    v_idx := (get_byte(v_bytes, i) % 32) + 1;
    v_result := v_result || substr(v_alphabet, v_idx, 1);
  end loop;

  return v_result;
end;
$$;

-- ============================================================
-- 5) RPC: public.submit_public_survey_response
-- ============================================================

create or replace function public.submit_public_survey_response(
  p_survey_id uuid,
  p_answers jsonb,
  p_submission_key text,
  p_device_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_survey record;
  v_submission_key text;
  v_device_hash text;
  v_response_id uuid;
  v_existing_claim record;
  v_campaign record;
  v_reward record;
  v_now timestamptz := now();
  v_active_claims_count integer := 0;
  v_question_id uuid;
  v_raw_identity text;
  v_normalized_identity text;
  v_identity_hash text;
  v_identity_valid boolean := true;
  v_already_claimed boolean := false;
  v_code text;
  v_claim_token text;
  v_expires_at timestamptz;
  v_reward_snapshot jsonb;
  v_reward_payload jsonb := null;
  v_completion_message text := null;
  v_attempt integer;
  v_claim_inserted boolean := false;
begin
  -- 1. Validar pesquisa e payload de respostas
  if p_survey_id is null then
    raise exception 'Survey is required' using errcode = '22023';
  end if;

  if p_answers is null
     or jsonb_typeof(p_answers) <> 'object'
     or p_answers = '{}'::jsonb
  then
    raise exception 'Answers payload must be a non-empty JSON object' using errcode = '22023';
  end if;

  if (p_answers->>'mode') = 'dynamic' then
    if jsonb_typeof(p_answers->'answers') <> 'object' then
      raise exception 'Dynamic answers payload is invalid' using errcode = '22023';
    end if;
  end if;

  select id, company_id, status
  into v_survey
  from public.surveys
  where id = p_survey_id;

  if v_survey.id is null or v_survey.status <> 'active' then
    raise exception 'Survey is not active or does not exist' using errcode = 'P0001';
  end if;

  v_submission_key := nullif(btrim(p_submission_key), '');
  v_device_hash := nullif(btrim(p_device_hash), '');

  -- 2. Verificar idempotência por submission_key
  if v_submission_key is not null then
    select r.id
    into v_response_id
    from public.responses r
    where r.submission_key = v_submission_key
      and r.survey_id = p_survey_id
    limit 1;

    if v_response_id is not null then
      select
        cc.code,
        cc.claim_token,
        cc.issued_at,
        cc.expires_at,
        cc.reward_snapshot
      into v_existing_claim
      from public.campaign_claims cc
      where cc.response_id = v_response_id
        and cc.status <> 'voided'
      limit 1;

      if v_existing_claim.code is not null and v_existing_claim.reward_snapshot is not null then
        v_completion_message := v_existing_claim.reward_snapshot->>'completion_message';
        v_reward_payload := jsonb_build_object(
          'title', v_existing_claim.reward_snapshot->'title',
          'description', v_existing_claim.reward_snapshot->'description',
          'type', v_existing_claim.reward_snapshot->>'type',
          'value', v_existing_claim.reward_snapshot->'value',
          'code_mode', coalesce(v_existing_claim.reward_snapshot->>'code_mode', 'unique'),
          'code', v_existing_claim.code,
          'claim_token', v_existing_claim.claim_token,
          'instructions', v_existing_claim.reward_snapshot->'instructions',
          'terms', v_existing_claim.reward_snapshot->'terms',
          'expires_at', v_existing_claim.expires_at,
          'issued_at', v_existing_claim.issued_at,
          'completion_message', v_existing_claim.reward_snapshot->'completion_message'
        );
      end if;

      return jsonb_build_object(
        'submitted', true,
        'response_id', v_response_id,
        'completion_message', v_completion_message,
        'reward', v_reward_payload
      );
    end if;
  end if;

  -- 3. Inserir resposta (com tratamento de corrida idempotente em submission_key)
  begin
    insert into public.responses (survey_id, answers, submission_key)
    values (p_survey_id, p_answers, v_submission_key)
    returning id into v_response_id;
  exception
    when unique_violation then
      if v_submission_key is not null then
        select r.id
        into v_response_id
        from public.responses r
        where r.submission_key = v_submission_key
          and r.survey_id = p_survey_id
        limit 1;

        if v_response_id is not null then
          select
            cc.code,
            cc.claim_token,
            cc.issued_at,
            cc.expires_at,
            cc.reward_snapshot
          into v_existing_claim
          from public.campaign_claims cc
          where cc.response_id = v_response_id
            and cc.status <> 'voided'
          limit 1;

          if v_existing_claim.code is not null and v_existing_claim.reward_snapshot is not null then
            v_completion_message := v_existing_claim.reward_snapshot->>'completion_message';
            v_reward_payload := jsonb_build_object(
              'title', v_existing_claim.reward_snapshot->'title',
              'description', v_existing_claim.reward_snapshot->'description',
              'type', v_existing_claim.reward_snapshot->>'type',
              'value', v_existing_claim.reward_snapshot->'value',
              'code_mode', coalesce(v_existing_claim.reward_snapshot->>'code_mode', 'unique'),
              'code', v_existing_claim.code,
              'claim_token', v_existing_claim.claim_token,
              'instructions', v_existing_claim.reward_snapshot->'instructions',
              'terms', v_existing_claim.reward_snapshot->'terms',
              'expires_at', v_existing_claim.expires_at,
              'issued_at', v_existing_claim.issued_at,
              'completion_message', v_existing_claim.reward_snapshot->'completion_message'
            );
          end if;

          return jsonb_build_object(
            'submitted', true,
            'response_id', v_response_id,
            'completion_message', v_completion_message,
            'reward', v_reward_payload
          );
        end if;
      end if;

      -- Se submission_key colidiu com outra survey_id, salva a resposta sem submission_key
      insert into public.responses (survey_id, answers, submission_key)
      values (p_survey_id, p_answers, null)
      returning id into v_response_id;
  end;

  -- ============================================================
  -- REGRA CRÍTICA: Bloco protegido de campanha e recompensa.
  -- Qualquer falha aqui faz rollback APENAS da subtransação do claim,
  -- preservando integralmente o registro já gravado em public.responses.
  -- ============================================================
  begin
    -- 4 & 5. Resolver campanha ativa (priorizando campaign_surveys e mantendo
    --        compatibilidade com campaigns.survey_id) e adquirir LOCK FOR UPDATE
    select c.*
    into v_campaign
    from public.campaigns c
    where c.company_id = v_survey.company_id
      and c.status = 'active'
      and (
        exists (
          select 1
          from public.campaign_surveys cs
          where cs.campaign_id = c.id
            and cs.survey_id = p_survey_id
        )
        or c.survey_id = p_survey_id
      )
    order by
      case
        when exists (
          select 1
          from public.campaign_surveys cs
          where cs.campaign_id = c.id
            and cs.survey_id = p_survey_id
        ) then 0
        else 1
      end,
      c.created_at desc
    limit 1
    for update of c;

    -- 6. Verificar existência e janela temporal (starts_at / ends_at)
    if v_campaign.id is not null
       and (v_campaign.starts_at is null or v_campaign.starts_at <= v_now)
       and (v_campaign.ends_at is null or v_campaign.ends_at > v_now)
    then
      -- 7. Buscar campaign_rewards da campanha
      select rw.*
      into v_reward
      from public.campaign_rewards rw
      where rw.campaign_id = v_campaign.id
      limit 1;

      if v_reward.id is not null then
        -- 8. Verificar estoque (max_claims_total) sob o lock FOR UPDATE da campanha
        if v_campaign.max_claims_total is not null then
          select count(*)
          into v_active_claims_count
          from public.campaign_claims cc
          where cc.campaign_id = v_campaign.id
            and cc.status <> 'voided';
        end if;

        if v_campaign.max_claims_total is null
           or v_active_claims_count < v_campaign.max_claims_total
        then
          -- 9. Verificar identidade conforme identity_requirement
          if v_campaign.identity_requirement = 'none' then
            v_identity_valid := true;
            v_identity_hash := null;
          elsif v_campaign.identity_requirement = 'email' then
            if (p_answers->>'mode') = 'dynamic' then
              select sq.id
              into v_question_id
              from public.survey_questions sq
              where sq.survey_id = p_survey_id
                and sq.type = 'email'
              order by sq.position asc
              limit 1;

              if v_question_id is not null then
                v_raw_identity := (p_answers->'answers')->>(v_question_id::text);
              end if;
            else
              v_raw_identity := p_answers->>'email';
            end if;

            v_normalized_identity := lower(btrim(coalesce(v_raw_identity, '')));

            if v_normalized_identity = ''
               or char_length(v_normalized_identity) > 254
               or v_normalized_identity !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
            then
              v_identity_valid := false;
            else
              v_identity_hash := encode(digest(v_normalized_identity, 'sha256'), 'hex');
            end if;
          elsif v_campaign.identity_requirement = 'phone' then
            if (p_answers->>'mode') = 'dynamic' then
              select sq.id
              into v_question_id
              from public.survey_questions sq
              where sq.survey_id = p_survey_id
                and sq.type = 'phone'
              order by sq.position asc
              limit 1;

              if v_question_id is not null then
                v_raw_identity := (p_answers->'answers')->>(v_question_id::text);
              end if;
            else
              -- Formulário legado não possui telefone
              v_raw_identity := null;
            end if;

            v_normalized_identity := regexp_replace(coalesce(v_raw_identity, ''), '\D', '', 'g');

            if char_length(v_normalized_identity) < 10
               or char_length(v_normalized_identity) > 11
            then
              v_identity_valid := false;
            else
              v_identity_hash := encode(digest(v_normalized_identity, 'sha256'), 'hex');
            end if;
          else
            v_identity_valid := false;
          end if;

          if v_identity_valid and v_identity_hash is not null then
            select exists (
              select 1
              from public.campaign_claims cc
              where cc.campaign_id = v_campaign.id
                and cc.identity_hash = v_identity_hash
                and cc.status <> 'voided'
            )
            into v_already_claimed;
          end if;

          if v_identity_valid and not v_already_claimed then
            -- 11. Gerar claim_token único
            v_claim_token := encode(gen_random_bytes(16), 'hex');

            -- 12. Calcular expires_at
            if v_campaign.claim_validity_days is not null and v_campaign.claim_validity_days > 0 then
              v_expires_at := v_now + make_interval(days => v_campaign.claim_validity_days);
            else
              v_expires_at := null;
            end if;

            -- 13. Construir reward_snapshot imutável
            v_reward_snapshot := jsonb_build_object(
              'reward_id', v_reward.id,
              'type', v_reward.type,
              'title', v_reward.title,
              'description', v_reward.description,
              'value', v_reward.value,
              'code_mode', v_reward.code_mode,
              'instructions', v_reward.instructions,
              'terms', v_reward.terms,
              'campaign_name', v_campaign.name,
              'completion_message', v_campaign.completion_message
            );

            -- 10 & 14. Gerar código (fixed ou unique com retry) e inserir campaign_claim
            if v_reward.code_mode = 'fixed' then
              v_code := nullif(btrim(v_reward.fixed_code), '');

              if v_code is not null then
                insert into public.campaign_claims (
                  company_id,
                  campaign_id,
                  reward_id,
                  survey_id,
                  response_id,
                  code,
                  claim_token,
                  status,
                  issued_at,
                  expires_at,
                  identity_hash,
                  device_hash,
                  reward_snapshot,
                  submission_key
                )
                values (
                  v_campaign.company_id,
                  v_campaign.id,
                  v_reward.id,
                  p_survey_id,
                  v_response_id,
                  v_code,
                  v_claim_token,
                  'issued',
                  v_now,
                  v_expires_at,
                  v_identity_hash,
                  v_device_hash,
                  v_reward_snapshot,
                  v_submission_key
                );

                v_claim_inserted := true;
              end if;
            elsif v_reward.code_mode = 'unique' then
              for v_attempt in 1..10 loop
                v_code := public.generate_unique_campaign_code();
                begin
                  insert into public.campaign_claims (
                    company_id,
                    campaign_id,
                    reward_id,
                    survey_id,
                    response_id,
                    code,
                    claim_token,
                    status,
                    issued_at,
                    expires_at,
                    identity_hash,
                    device_hash,
                    reward_snapshot,
                    submission_key
                  )
                  values (
                    v_campaign.company_id,
                    v_campaign.id,
                    v_reward.id,
                    p_survey_id,
                    v_response_id,
                    v_code,
                    v_claim_token,
                    'issued',
                    v_now,
                    v_expires_at,
                    v_identity_hash,
                    v_device_hash,
                    v_reward_snapshot,
                    v_submission_key
                  );

                  v_claim_inserted := true;
                  exit;
                exception
                  when unique_violation then
                    -- Se colidiu por código único, tenta gerar outro código;
                    -- se colidiu por response_id / submission_key / identity_hash, encerra.
                    if exists (
                      select 1
                      from public.campaign_claims cc
                      where cc.response_id = v_response_id
                         or (v_identity_hash is not null and cc.campaign_id = v_campaign.id and cc.identity_hash = v_identity_hash and cc.status <> 'voided')
                    ) then
                      exit;
                    end if;
                end;
              end loop;
            end if;

            if v_claim_inserted and v_code is not null then
              v_completion_message := v_campaign.completion_message;
              v_reward_payload := jsonb_build_object(
                'title', v_reward.title,
                'description', v_reward.description,
                'type', v_reward.type,
                'value', v_reward.value,
                'code_mode', v_reward.code_mode,
                'code', v_code,
                'claim_token', v_claim_token,
                'instructions', v_reward.instructions,
                'terms', v_reward.terms,
                'expires_at', v_expires_at,
                'issued_at', v_now,
                'completion_message', v_campaign.completion_message
              );
            end if;
          end if;
        end if;
      end if;
    end if;
  exception
    when others then
      -- Preserva a resposta gravada em public.responses e oculta qualquer erro interno de campanha.
      v_reward_payload := null;
      v_completion_message := null;
  end;

  -- 15. Retornar somente dados públicos necessários
  return jsonb_build_object(
    'submitted', true,
    'response_id', v_response_id,
    'completion_message', v_completion_message,
    'reward', v_reward_payload
  );
end;
$$;

revoke all on function public.submit_public_survey_response(uuid, jsonb, text, text) from public;

grant execute on function public.submit_public_survey_response(uuid, jsonb, text, text)
  to anon, authenticated;
