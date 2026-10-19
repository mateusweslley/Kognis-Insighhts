-- pgTAP checks for 014_primary_survey_question.sql.
-- Run only in a disposable Supabase test database after applying 001-014.
begin;

select plan(10);

insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values ('11000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
        'primary-question-test@example.invalid', '', '{}'::jsonb, '{}'::jsonb);

insert into public.companies (id, owner_id, name, slug)
values ('21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001',
        'Primary question tests', 'primary-question-tests');

insert into public.surveys (id, company_id, title, status)
values
  ('31000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'Draft survey', 'draft'),
  ('31000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001', 'Archived survey', 'archived');

insert into public.survey_questions (id, survey_id, type, title, required, position, options)
values
  ('41000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'rating', 'Draft rating', true, 1, '[]'),
  ('41000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', 'short_text', 'Draft text', false, 2, '[]'),
  ('41000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000002', 'rating', 'Archived rating', true, 1, '[]');

select is(
  (select primary_question_id from public.surveys where id = '31000000-0000-4000-8000-000000000001'),
  null::uuid,
  'existing survey starts without an inferred primary question'
);

select lives_ok(
  $$ update public.surveys
     set primary_question_id = '41000000-0000-4000-8000-000000000001'
     where id = '31000000-0000-4000-8000-000000000001' $$,
  'draft survey accepts an explicitly selected rating question'
);

select is(
  (select primary_question_id from public.surveys where id = '31000000-0000-4000-8000-000000000001'),
  '41000000-0000-4000-8000-000000000001'::uuid,
  'selected question is persisted'
);

select throws_ok(
  $$ update public.surveys
     set primary_question_id = '41000000-0000-4000-8000-000000000003'
     where id = '31000000-0000-4000-8000-000000000001' $$,
  '23503',
  'insert or update on table "surveys" violates foreign key constraint "surveys_primary_question_same_survey_fkey"',
  'composite foreign key rejects a question from another survey'
);

select throws_ok(
  $$ update public.surveys
     set primary_question_id = '41000000-0000-4000-8000-000000000002'
     where id = '31000000-0000-4000-8000-000000000001' $$,
  '23514',
  'Primary question must be a rating question from the same survey',
  'trigger rejects a non-rating question'
);

select throws_ok(
  $$ update public.survey_questions set type = 'short_text'
     where id = '41000000-0000-4000-8000-000000000001' $$,
  '23514',
  'A configured primary question must remain a rating question',
  'selected question cannot be reclassified as a different type'
);

select lives_ok(
  $$ update public.surveys set primary_question_id = null
     where id = '31000000-0000-4000-8000-000000000001' $$,
  'configuration can be removed'
);

select lives_ok(
  $$ update public.surveys
     set primary_question_id = '41000000-0000-4000-8000-000000000003'
     where id = '31000000-0000-4000-8000-000000000002' $$,
  'archived survey also accepts an explicitly selected rating question'
);

select lives_ok(
  $$ delete from public.survey_questions
     where id = '41000000-0000-4000-8000-000000000003' $$,
  'deleting a configured question clears its survey configuration'
);

select is(
  (select primary_question_id from public.surveys where id = '31000000-0000-4000-8000-000000000002'),
  null::uuid,
  'deleting the question leaves the survey with no primary selection'
);

select * from finish();
rollback;
