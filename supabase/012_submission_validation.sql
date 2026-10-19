-- SEC-01: server-side validation for public survey submissions.
-- Limits: 1 MiB serialized JSON payload; at most 100 answered questions per
-- dynamic submission; short_text 500 chars; full_name 200; long_text/comment
-- 10,000; email 254; single_choice option value 500. Legacy response shape stays intact.
-- This migration does not rewrite or revalidate historical response rows.

drop index if exists public.responses_submission_key_unique_idx;
create unique index if not exists responses_survey_submission_key_unique_idx
  on public.responses (survey_id, submission_key)
  where submission_key is not null;

alter table public.campaign_claims
  drop constraint if exists campaign_claims_submission_key_key;
create unique index if not exists campaign_claims_survey_submission_key_unique_idx
  on public.campaign_claims (survey_id, submission_key)
  where survey_id is not null and submission_key is not null;
create unique index if not exists campaign_claims_null_survey_submission_key_unique_idx
  on public.campaign_claims (submission_key)
  where survey_id is null and submission_key is not null;

-- A survey deletion sets campaign_claims.survey_id to NULL. Clear only the
-- operational idempotency key first, so keys shared by different surveys do
-- not collide in the NULL-scope unique index. The claim and reward snapshot
-- remain available for history; the related response is deleted by its FK.
create or replace function public.clear_campaign_claim_submission_key_before_survey_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  update public.campaign_claims
  set submission_key = null
  where survey_id = old.id
    and submission_key is not null;

  return old;
end;
$$;

drop trigger if exists campaign_claims_clear_submission_key_before_survey_delete
  on public.surveys;
create trigger campaign_claims_clear_submission_key_before_survey_delete
before delete on public.surveys
for each row
execute function public.clear_campaign_claim_submission_key_before_survey_delete();

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
  v_answer record;
  v_question record;
  v_input_text text;
  v_answer_number numeric;
begin
  -- 1. Validate the public payload and bind it to the active survey.
  if p_survey_id is null then
    raise exception 'Survey is required' using errcode = '22023';
  end if;

  v_submission_key := nullif(btrim(p_submission_key), '');
  if v_submission_key is null then
    raise exception 'Submission key is required' using errcode = '22023';
  end if;
  if char_length(v_submission_key) > 128 then
    raise exception 'Submission key is too long' using errcode = '22023';
  end if;
  if v_submission_key !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Submission key format is invalid' using errcode = '22023';
  end if;

  v_device_hash := nullif(btrim(p_device_hash), '');
  if v_device_hash is not null and octet_length(v_device_hash) > 256 then
    raise exception 'Device hash is too long' using errcode = '22023';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'Answers payload must be a JSON object' using errcode = '22023';
  end if;
  if octet_length(p_answers::text) > 1048576 then
    raise exception 'Submission payload exceeds 1 MiB' using errcode = '22023';
  end if;

  select id, company_id, status
  into v_survey
  from public.surveys
  where id = p_survey_id
    and status = 'active'
  for share;

  if not found then
    raise exception 'Survey is not active or does not exist' using errcode = 'P0001';
  end if;

  if p_answers ? 'mode' then
    if jsonb_typeof(p_answers->'mode') is distinct from 'string'
       or p_answers->>'mode' <> 'dynamic'
       or jsonb_typeof(p_answers->'answers') is distinct from 'object'
       or (SELECT count(*) FROM jsonb_object_keys(p_answers)) <> 2
       or p_answers - array['mode', 'answers'] <> '{}'::jsonb
    then
      raise exception 'Dynamic answers payload is invalid' using errcode = '22023';
    end if;

    if (SELECT count(*) FROM jsonb_object_keys(p_answers->'answers')) = 0 then
      raise exception 'Dynamic answers must contain at least one answer' using errcode = '22023';
    end if;
    if (SELECT count(*) FROM jsonb_object_keys(p_answers->'answers')) > 100 then
      raise exception 'Dynamic submission exceeds the 100-answer limit' using errcode = '22023';
    end if;

    for v_answer in
      select key, value
      from jsonb_each(p_answers->'answers')
    loop
      select q.id, q.type, q.required, q.options
      into v_question
      from public.survey_questions q
      where q.id::text = v_answer.key
        and q.survey_id = p_survey_id;

      if not found then
        raise exception 'Unknown or mismatched question id' using errcode = '22023';
      end if;
      if jsonb_typeof(v_answer.value) = 'null' then
        raise exception 'Answer value is empty or null' using errcode = '22023';
      end if;
      if jsonb_typeof(v_answer.value) is distinct from 'string'
         and jsonb_typeof(v_answer.value) is distinct from 'number'
      then
        raise exception 'Answer value is invalid for question type' using errcode = '22023';
      end if;

      v_input_text := v_answer.value #>> '{}';
      if jsonb_typeof(v_answer.value) = 'string' and btrim(v_input_text) = '' then
        raise exception 'Answer value is empty or null' using errcode = '22023';
      end if;

      case v_question.type
        when 'short_text' then
          if jsonb_typeof(v_answer.value) is distinct from 'string' then
            raise exception 'Answer value is invalid for question type' using errcode = '22023';
          end if;
          if char_length(v_input_text) > 500 then
            raise exception 'Answer exceeds the maximum length for question type' using errcode = '22023';
          end if;
        when 'long_text' then
          if jsonb_typeof(v_answer.value) is distinct from 'string' then
            raise exception 'Answer value is invalid for question type' using errcode = '22023';
          end if;
          if char_length(v_input_text) > 10000 then
            raise exception 'Answer exceeds the maximum length for question type' using errcode = '22023';
          end if;
        when 'full_name' then
          if jsonb_typeof(v_answer.value) is distinct from 'string' then
            raise exception 'Answer value is invalid for question type' using errcode = '22023';
          end if;
          if char_length(v_input_text) > 200 then
            raise exception 'Answer exceeds the maximum length for question type' using errcode = '22023';
          end if;
        when 'single_choice' then
          if jsonb_typeof(v_answer.value) is distinct from 'string' then
            raise exception 'Answer value is invalid for question type' using errcode = '22023';
          end if;
          if char_length(v_input_text) > 500 then
            raise exception 'Answer exceeds the maximum length for question type' using errcode = '22023';
          end if;
          if not exists (
            select 1
            from jsonb_array_elements(v_question.options) as configured_option(value)
            where jsonb_typeof(configured_option.value) = 'string'
              and configured_option.value #>> '{}' = v_input_text
          ) then
            raise exception 'Selected option is not valid for question' using errcode = '22023';
          end if;
        when 'rating' then
          if jsonb_typeof(v_answer.value) is distinct from 'number' then
            raise exception 'Answer value is invalid for question type' using errcode = '22023';
          end if;
          v_answer_number := v_input_text::numeric;
          if v_answer_number <> trunc(v_answer_number)
             or v_answer_number < 1 or v_answer_number > 5
          then
            raise exception 'Rating is outside the allowed range' using errcode = '22023';
          end if;
        when 'rating_10' then
          if jsonb_typeof(v_answer.value) is distinct from 'number' then
            raise exception 'Answer value is invalid for question type' using errcode = '22023';
          end if;
          v_answer_number := v_input_text::numeric;
          if v_answer_number <> trunc(v_answer_number)
             or v_answer_number < 0 or v_answer_number > 10
          then
            raise exception 'Rating is outside the allowed range' using errcode = '22023';
          end if;
        when 'number' then
          if jsonb_typeof(v_answer.value) is distinct from 'number' then
            raise exception 'Answer value is invalid for question type' using errcode = '22023';
          end if;
          v_answer_number := v_input_text::numeric;
          if abs(v_answer_number) > 1.7976931348623157e308::numeric then
            raise exception 'Number answer is outside the supported range' using errcode = '22023';
          end if;
        when 'email' then
          if jsonb_typeof(v_answer.value) is distinct from 'string'
             or char_length(v_input_text) > 254
             or v_input_text !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
          then
            raise exception 'Email answer is invalid' using errcode = '22023';
          end if;
        when 'phone' then
          if jsonb_typeof(v_answer.value) is distinct from 'string'
             or v_input_text !~ '^[0-9]{10,11}$'
          then
            raise exception 'Phone answer is invalid' using errcode = '22023';
          end if;
        else
          raise exception 'Unsupported question type' using errcode = '22023';
      end case;
    end loop;

    if exists (
      select 1
      from public.survey_questions q
      where q.survey_id = p_survey_id
        and q.required is true
        and not (p_answers->'answers' ? q.id::text)
    ) then
      raise exception 'Required question is unanswered' using errcode = '22023';
    end if;
  else
    if p_answers - array['name', 'email', 'rating', 'comment'] <> '{}'::jsonb
       or not (p_answers ? 'name')
       or not (p_answers ? 'rating')
    then
      raise exception 'Legacy payload contains unsupported fields' using errcode = '22023';
    end if;
    if jsonb_typeof(p_answers->'name') is distinct from 'string'
       or btrim(p_answers->>'name') = ''
       or char_length(p_answers->>'name') > 200
    then
      raise exception 'Legacy name is invalid' using errcode = '22023';
    end if;
    if jsonb_typeof(p_answers->'rating') is distinct from 'number' then
      raise exception 'Legacy rating is invalid' using errcode = '22023';
    end if;
    v_answer_number := (p_answers->>'rating')::numeric;
    if v_answer_number <> trunc(v_answer_number)
       or v_answer_number < 1 or v_answer_number > 5
    then
      raise exception 'Legacy rating is invalid' using errcode = '22023';
    end if;

    if p_answers ? 'email' and jsonb_typeof(p_answers->'email') is distinct from 'null' then
      if jsonb_typeof(p_answers->'email') is distinct from 'string' then
        raise exception 'Legacy email is invalid' using errcode = '22023';
      end if;
      v_input_text := p_answers->>'email';
      if btrim(v_input_text) <> ''
         and (char_length(v_input_text) > 254 or v_input_text !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
      then
        raise exception 'Legacy email is invalid' using errcode = '22023';
      end if;
    end if;

    if p_answers ? 'comment' and jsonb_typeof(p_answers->'comment') is distinct from 'null' then
      if jsonb_typeof(p_answers->'comment') is distinct from 'string'
         or char_length(p_answers->>'comment') > 10000
      then
        raise exception 'Legacy comment is invalid' using errcode = '22023';
      end if;
    end if;
  end if;

  -- Keep optional device-hash behavior while bounding stored input.
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
      raise;
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
