-- pgTAP acceptance tests for 012_submission_validation.sql.
-- Run only in a disposable Supabase test database after applying migrations there.
begin;

select plan(52);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values (
  '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'sec01-test@example.invalid', '', '{}'::jsonb, '{}'::jsonb
);

insert into public.companies (id, owner_id, name, slug)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'SEC01 tests', 'sec01-tests');

insert into public.surveys (id, company_id, title, status)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'SEC01 active A', 'active'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'SEC01 active B', 'active'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'SEC01 inactive', 'archived');

insert into public.campaigns (id, company_id, name, status)
values ('60000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'SEC01 test campaign', 'active');

insert into public.survey_questions (id, survey_id, type, title, required, position, options)
values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'short_text', 'Short', true, 1, '[]'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'rating', 'Rating', true, 2, '[]'),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'single_choice', 'Choice', false, 3, '["A", "B"]'),
  ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001', 'rating_10', 'Rating 10', false, 4, '[]'),
  ('40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000001', 'number', 'Number', false, 5, '[]'),
  ('40000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000001', 'email', 'Email', false, 6, '[]'),
  ('40000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000001', 'phone', 'Phone', false, 7, '[]'),
  ('40000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000001', 'long_text', 'Long', false, 8, '[]'),
  ('40000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000001', 'full_name', 'Full name', false, 9, '[]'),
  ('40000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000002', 'short_text', 'Other survey', true, 1, '[]'),
  ('40000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000002', 'rating', 'Other rating', true, 2, '[]');

select is(
  (public.submit_public_survey_response(
    '30000000-0000-4000-8000-000000000001',
    '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Bem atendido","40000000-0000-4000-8000-000000000002":5,"40000000-0000-4000-8000-000000000003":"A","40000000-0000-4000-8000-000000000004":0,"40000000-0000-4000-8000-000000000005":0,"40000000-0000-4000-8000-000000000006":"a@example.com","40000000-0000-4000-8000-000000000007":"11987654321","40000000-0000-4000-8000-000000000008":"Comentário longo","40000000-0000-4000-8000-000000000009":"Cliente"}}'::jsonb,
    '00000000-0000-4000-8000-000000000001'
  )->>'submitted')::boolean,
  true,
  'accepts valid dynamic values, including numeric zero'
);
select is(
  (public.submit_public_survey_response(
    '30000000-0000-4000-8000-000000000001',
    '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Fallback key","40000000-0000-4000-8000-000000000002":4}}'::jsonb,
    'sub_1760000000000_abcdefghij'
  )->>'submitted')::boolean,
  true,
  'accepts the existing browser fallback submission-key format'
);

select is(
  (public.submit_public_survey_response(
    '30000000-0000-4000-8000-000000000001',
    '{"name":"Cliente legado","rating":4,"email":null,"comment":""}'::jsonb,
    '00000000-0000-4000-8000-000000000002'
  )->>'submitted')::boolean,
  true,
  'accepts the legacy contract with optional email and comment'
);
select is(
  (public.submit_public_survey_response(
    '30000000-0000-4000-8000-000000000001',
    '{"name":"Cliente campanha","rating":5,"email":"cliente@example.com"}'::jsonb,
    '00000000-0000-4000-8000-000000000003'
  )->>'submitted')::boolean,
  true,
  'accepts a valid legacy email used by campaign eligibility'
);

select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"future","answers":{}}'::jsonb, '00000000-0000-4000-8000-000000000010')$$, '22023', 'Submission payload mode is invalid', 'rejects unknown mode');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic"}'::jsonb, '00000000-0000-4000-8000-000000000011')$$, '22023', 'Dynamic answers payload is invalid', 'rejects missing answers object');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{}}'::jsonb, '00000000-0000-4000-8000-000000000012')$$, '22023', 'Dynamic answers must contain at least one answer', 'rejects empty dynamic answers');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":null,"40000000-0000-4000-8000-000000000002":5}}'::jsonb, '00000000-0000-4000-8000-000000000013')$$, '22023', 'Answer value is empty or null', 'rejects null dynamic answer');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"   ","40000000-0000-4000-8000-000000000002":5}}'::jsonb, '00000000-0000-4000-8000-000000000014')$$, '22023', 'Answer value is empty or null', 'rejects whitespace dynamic answer');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"50000000-0000-4000-8000-000000000001":"forged","40000000-0000-4000-8000-000000000002":5}}'::jsonb, '00000000-0000-4000-8000-000000000015')$$, '22023', 'Unknown or mismatched question id', 'rejects unknown question id');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000010":"foreign","40000000-0000-4000-8000-000000000002":5}}'::jsonb, '00000000-0000-4000-8000-000000000016')$$, '22023', 'Unknown or mismatched question id', 'rejects question id from another survey');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000002":"5"}}'::jsonb, '00000000-0000-4000-8000-000000000017')$$, '22023', 'Answer value is invalid for question type', 'rejects rating encoded as text');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000002":0}}'::jsonb, '00000000-0000-4000-8000-000000000018')$$, '22023', 'Rating is outside the allowed range', 'rejects rating below 1');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000002":6}}'::jsonb, '00000000-0000-4000-8000-000000000019')$$, '22023', 'Rating is outside the allowed range', 'rejects rating above 5');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000004":11}}'::jsonb, '00000000-0000-4000-8000-000000000034')$$, '22023', 'Rating is outside the allowed range', 'rejects rating_10 above 10');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":false,"40000000-0000-4000-8000-000000000002":5}}'::jsonb, '00000000-0000-4000-8000-000000000035')$$, '22023', 'Answer value is invalid for question type', 'rejects boolean for short_text');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000005":"0"}}'::jsonb, '00000000-0000-4000-8000-000000000036')$$, '22023', 'Answer value is invalid for question type', 'rejects string for number');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000006":123}}'::jsonb, '00000000-0000-4000-8000-000000000037')$$, '22023', 'Answer value is invalid for question type', 'rejects non-string optional email');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000002":5,"40000000-0000-4000-8000-000000000008":[]}}'::jsonb, '00000000-0000-4000-8000-000000000040')$$, '22023', 'Answer value is invalid for question type', 'rejects array for optional long_text');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000002":5,"40000000-0000-4000-8000-000000000003":"C"}}'::jsonb, '00000000-0000-4000-8000-000000000020')$$, '22023', 'Selected option is not valid for question', 'rejects unconfigured choice');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000002":5}}'::jsonb, '00000000-0000-4000-8000-000000000021')$$, '22023', 'Required question is unanswered', 'rejects missing required question');
select throws_ok(format($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', jsonb_build_object('mode','dynamic','answers',jsonb_build_object('40000000-0000-4000-8000-000000000001',repeat('x',501),'40000000-0000-4000-8000-000000000002',5)), '%s')$$, '00000000-0000-4000-8000-000000000022'), '22023', 'Answer exceeds the maximum length for question type', 'rejects short text over 500 characters');
select throws_ok(format($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', jsonb_build_object('mode','dynamic','answers',jsonb_build_object('40000000-0000-4000-8000-000000000001','Valid','40000000-0000-4000-8000-000000000002',5,'40000000-0000-4000-8000-000000000008',repeat('x',10001))), '%s')$$, '00000000-0000-4000-8000-000000000023'), '22023', 'Answer exceeds the maximum length for question type', 'rejects long text over 10000 characters');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000002":5,"40000000-0000-4000-8000-000000000006":"invalido"}}'::jsonb, '00000000-0000-4000-8000-000000000024')$$, '22023', 'Email answer is invalid', 'rejects invalid email');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000002":5,"40000000-0000-4000-8000-000000000007":"(11) 98765-4321"}}'::jsonb, '00000000-0000-4000-8000-000000000025')$$, '22023', 'Phone answer is invalid', 'rejects phone not normalized by the public form');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000002":5},"unexpected":true}'::jsonb, '00000000-0000-4000-8000-000000000026')$$, '22023', 'Dynamic answers payload is invalid', 'rejects ambiguous envelope fields');
select throws_ok(format($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', jsonb_build_object('mode','dynamic','answers',jsonb_build_object('40000000-0000-4000-8000-000000000001',repeat('x',1048577),'40000000-0000-4000-8000-000000000002',5)), '%s')$$, '00000000-0000-4000-8000-000000000027'), '22023', 'Submission payload exceeds 1 MiB', 'rejects payload above byte limit');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"name":"Legacy","rating":0}'::jsonb, '00000000-0000-4000-8000-000000000028')$$, '22023', 'Legacy rating is invalid', 'rejects invalid legacy rating');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"name":"Legacy","rating":4,"company_id":"forged"}'::jsonb, '00000000-0000-4000-8000-000000000029')$$, '22023', 'Legacy payload contains unsupported fields', 'rejects extra legacy fields');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"name":"Legacy","rating":4,"email":123}'::jsonb, '00000000-0000-4000-8000-000000000038')$$, '22023', 'Legacy email is invalid', 'rejects non-string optional legacy email');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"name":"Legacy","rating":4,"comment":false}'::jsonb, '00000000-0000-4000-8000-000000000039')$$, '22023', 'Legacy comment is invalid', 'rejects non-string optional legacy comment');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000002":5}}'::jsonb, null)$$, '22023', 'Submission key is required', 'rejects null submission key');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000002":5}}'::jsonb, '   ')$$, '22023', 'Submission key is required', 'rejects blank submission key');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000002":5}}'::jsonb, 'bad key/format')$$, '22023', 'Submission key format is invalid', 'rejects unsupported key format');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000001', '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Valid","40000000-0000-4000-8000-000000000002":5}}'::jsonb, repeat('a',129))$$, '22023', 'Submission key is too long', 'rejects oversized submission key');
select throws_ok($$select public.submit_public_survey_response('30000000-0000-4000-8000-000000000003', '{"name":"Legacy","rating":4}'::jsonb, '00000000-0000-4000-8000-000000000030')$$, 'P0001', 'Survey is not active or does not exist', 'rejects inactive survey');

create temporary table sec01_retry_first as
select public.submit_public_survey_response(
  '30000000-0000-4000-8000-000000000001',
  '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Retry","40000000-0000-4000-8000-000000000002":5}}'::jsonb,
  '00000000-0000-4000-8000-000000000031'
) as result;

select is(
  (select result->>'response_id' from sec01_retry_first),
  (public.submit_public_survey_response(
    '30000000-0000-4000-8000-000000000001',
    '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Different retry payload","40000000-0000-4000-8000-000000000002":1}}'::jsonb,
    '00000000-0000-4000-8000-000000000031'
  )->>'response_id'),
  'same survey and key return the original response on retry'
);
select is((select count(*)::integer from public.responses where survey_id='30000000-0000-4000-8000-000000000001' and submission_key='00000000-0000-4000-8000-000000000031'), 1, 'retry stores only one response');
select is((select answers #>> '{answers,40000000-0000-4000-8000-000000000001}' from public.responses where survey_id='30000000-0000-4000-8000-000000000001' and submission_key='00000000-0000-4000-8000-000000000031'), 'Retry', 'retry with a different payload does not overwrite the original response');

select public.submit_public_survey_response(
  '30000000-0000-4000-8000-000000000001',
  '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Survey A","40000000-0000-4000-8000-000000000002":5}}'::jsonb,
  '00000000-0000-4000-8000-000000000032'
);
select public.submit_public_survey_response(
  '30000000-0000-4000-8000-000000000002',
  '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000010":"Survey B","40000000-0000-4000-8000-000000000011":5}}'::jsonb,
  '00000000-0000-4000-8000-000000000032'
);
select is((select count(*)::integer from public.responses where submission_key='00000000-0000-4000-8000-000000000032'), 2, 'same key is independently unique per survey');

insert into public.survey_questions (survey_id, type, title, required, position, options)
select '30000000-0000-4000-8000-000000000001', 'short_text', 'Question ' || n, false, n + 9, '[]'::jsonb
from generate_series(1, 92) as n;

select public.submit_public_survey_response(
  '30000000-0000-4000-8000-000000000001',
  '{"mode":"dynamic","answers":{"40000000-0000-4000-8000-000000000001":"Many questions","40000000-0000-4000-8000-000000000002":5}}'::jsonb,
  '00000000-0000-4000-8000-000000000033'
);
select is((select count(*)::integer from public.responses where survey_id='30000000-0000-4000-8000-000000000001' and submission_key='00000000-0000-4000-8000-000000000033'), 1, 'accepts a survey with more than 100 configured questions when submitted answers are within limit');

select is(
  (public.submit_public_survey_response(
    '30000000-0000-4000-8000-000000000001',
    jsonb_build_object('mode', 'dynamic', 'answers', (
      select jsonb_object_agg(q.id::text, case q.type
        when 'rating' then '5'::jsonb
        when 'rating_10' then '0'::jsonb
        when 'number' then '0'::jsonb
        when 'single_choice' then '"A"'::jsonb
        when 'email' then '"a@example.com"'::jsonb
        when 'phone' then '"11987654321"'::jsonb
        else '"x"'::jsonb
      end)
      from (
        select id, type
        from public.survey_questions
        where survey_id='30000000-0000-4000-8000-000000000001'
        order by required desc, position
        limit 100
      ) q
    )),
    '00000000-0000-4000-8000-000000000041'
  )->>'submitted')::boolean,
  true,
  'accepts exactly 100 valid dynamic answers'
);
select throws_ok(
  $$with answers as (
    select jsonb_object_agg(q.id::text, case q.type
      when 'rating' then '5'::jsonb
      when 'rating_10' then '0'::jsonb
      when 'number' then '0'::jsonb
      when 'single_choice' then '"A"'::jsonb
      when 'email' then '"a@example.com"'::jsonb
      when 'phone' then '"11987654321"'::jsonb
      else '"x"'::jsonb
    end) as value
    from public.survey_questions q
    where q.survey_id='30000000-0000-4000-8000-000000000001'
  )
  select public.submit_public_survey_response(
    '30000000-0000-4000-8000-000000000001',
    jsonb_build_object('mode', 'dynamic', 'answers', answers.value),
    '00000000-0000-4000-8000-000000000042'
  ) from answers$$,
  '22023',
  'Dynamic submission exceeds the 100-answer limit',
  'rejects 101 dynamic answers'
);

insert into public.campaign_claims (company_id, campaign_id, survey_id, submission_key)
values ('20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', null, 'claim-null-survey-key');
select throws_ok(
  $$insert into public.campaign_claims (company_id, campaign_id, survey_id, submission_key) values ('20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', null, 'claim-null-survey-key')$$,
  '23505',
  'duplicate key value violates unique constraint "campaign_claims_null_survey_submission_key_unique_idx"',
  'keeps submission keys unique when campaign claim survey_id is null'
);
insert into public.campaign_claims (company_id, campaign_id, survey_id, response_id, submission_key, reward_snapshot)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    (select id from public.responses where survey_id='30000000-0000-4000-8000-000000000001' and submission_key='00000000-0000-4000-8000-000000000032'),
    'claim-shared-survey-key',
    '{"title":"Preserved reward A"}'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    (select id from public.responses where survey_id='30000000-0000-4000-8000-000000000002' and submission_key='00000000-0000-4000-8000-000000000032'),
    'claim-shared-survey-key',
    '{"title":"Preserved reward B"}'
  );
select is((select count(*)::integer from public.campaign_claims where submission_key='claim-shared-survey-key'), 2, 'campaign claim submission keys remain unique per non-null survey');

create temporary table sec01_survey_delete_guard (
  survey_id uuid not null references public.surveys(id) on delete restrict
);
insert into sec01_survey_delete_guard (survey_id)
values ('30000000-0000-4000-8000-000000000001');
select throws_ok(
  $$delete from public.surveys where id='30000000-0000-4000-8000-000000000001'$$,
  '23503',
  'update or delete on table "surveys" violates foreign key constraint "sec01_survey_delete_guard_survey_id_fkey" on table "sec01_survey_delete_guard"',
  'controlled foreign-key failure aborts the survey deletion after its before-delete trigger'
);
select is((select submission_key from public.campaign_claims where reward_snapshot->>'title'='Preserved reward A'), 'claim-shared-survey-key', 'failed survey deletion rolls back the trigger key update');
select ok((select survey_id='30000000-0000-4000-8000-000000000001' and response_id is not null from public.campaign_claims where reward_snapshot->>'title'='Preserved reward A'), 'failed survey deletion preserves the claim-to-response relationship');
drop table sec01_survey_delete_guard;

delete from public.surveys where id='30000000-0000-4000-8000-000000000001';
delete from public.surveys where id='30000000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.campaign_claims where campaign_id='60000000-0000-4000-8000-000000000001'), 3, 'deleting both surveys preserves every campaign claim');
select is((select count(*)::integer from public.campaign_claims where submission_key is null and survey_id is null), 2, 'survey deletion clears colliding operational keys before setting survey_id null');
select is((select count(*)::integer from public.campaign_claims where survey_id is null and response_id is null and reward_snapshot->>'title' in ('Preserved reward A', 'Preserved reward B')), 2, 'survey deletion sets both claim foreign keys to null');
select is(
  (
    select bool_and(
      reward_snapshot = jsonb_build_object(
        'title',
        case reward_snapshot->>'title'
          when 'Preserved reward A' then 'Preserved reward A'
          when 'Preserved reward B' then 'Preserved reward B'
        end
      )
    )
    from public.campaign_claims
    where reward_snapshot->>'title' in ('Preserved reward A', 'Preserved reward B')
  ),
  true,
  'survey deletion preserves reward snapshots unchanged'
);

select * from finish();
rollback;
