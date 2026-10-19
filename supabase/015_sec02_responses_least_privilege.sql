-- SEC-02: restrict direct client access to public.responses.
-- Public submissions continue through the validated SECURITY DEFINER RPC.
-- This migration intentionally does not change default privileges, role
-- memberships, other tables, other policies, service_role grants, or ownership.

BEGIN;

-- Remove direct table privileges from PUBLIC and client roles, including
-- INSERT, UPDATE, DELETE, and TRUNCATE. RLS policies do not replace ACLs.
REVOKE ALL PRIVILEGES ON TABLE public.responses
  FROM PUBLIC, anon, authenticated;

-- Authenticated application screens read responses under the existing RLS
-- policy "Users can view own company responses".
GRANT SELECT ON TABLE public.responses TO authenticated;

-- Public writes must use submit_public_survey_response instead of table INSERT.
DROP POLICY IF EXISTS "Visitors can answer active surveys"
  ON public.responses;

-- Keep the public RPC callable by the roles used by the public forms, while
-- ensuring PUBLIC itself has no EXECUTE grant. Existing service_role and owner
-- privileges are not modified.
REVOKE EXECUTE ON FUNCTION
  public.submit_public_survey_response(uuid, jsonb, text, text)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  public.submit_public_survey_response(uuid, jsonb, text, text)
  TO anon, authenticated;

COMMIT;

-- -------------------------------------------------------------------------
-- POST-MIGRATION READ-ONLY CHECKS (run separately after approved application)
-- -------------------------------------------------------------------------
-- Expected: anon has no table privileges; authenticated has SELECT only;
-- service_role and postgres retain their pre-migration effective privileges.
--
-- SELECT role_name,
--        has_table_privilege(role_name, 'public.responses', 'SELECT') AS can_select,
--        has_table_privilege(role_name, 'public.responses', 'INSERT') AS can_insert,
--        has_table_privilege(role_name, 'public.responses', 'UPDATE') AS can_update,
--        has_table_privilege(role_name, 'public.responses', 'DELETE') AS can_delete,
--        has_table_privilege(role_name, 'public.responses', 'TRUNCATE') AS can_truncate
-- FROM (VALUES ('anon'), ('authenticated'), ('service_role'), ('postgres')) AS r(role_name);
--
-- Inspect direct PUBLIC ACL entries (expected: no rows):
-- SELECT x.privilege_type
-- FROM pg_class AS c
-- CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) AS x
-- WHERE c.oid = 'public.responses'::regclass
--   AND x.grantee = 0;
--
-- Inspect RLS and policies (expected: RLS enabled, existing company SELECT policy
-- present, public INSERT policy absent):
-- SELECT c.relrowsecurity, c.relforcerowsecurity, p.polname, p.polcmd,
--        p.polroles, pg_get_expr(p.polqual, p.polrelid) AS using_expr,
--        pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expr
-- FROM pg_class AS c
-- LEFT JOIN pg_policy AS p ON p.polrelid = c.oid
-- WHERE c.oid = 'public.responses'::regclass;
--
-- Confirm effective RPC EXECUTE (expected: anon/authenticated true; PUBLIC has no
-- direct ACL grant; service_role remains as it was before this migration):
-- SELECT has_function_privilege('anon', 'public.submit_public_survey_response(uuid,jsonb,text,text)', 'EXECUTE') AS anon_exec,
--        has_function_privilege('authenticated', 'public.submit_public_survey_response(uuid,jsonb,text,text)', 'EXECUTE') AS authenticated_exec,
--        has_function_privilege('service_role', 'public.submit_public_survey_response(uuid,jsonb,text,text)', 'EXECUTE') AS service_role_exec;
-- SELECT a.privilege_type
-- FROM pg_proc AS f
-- CROSS JOIN LATERAL aclexplode(COALESCE(f.proacl, acldefault('f', f.proowner))) AS a
-- WHERE f.oid = 'public.submit_public_survey_response(uuid,jsonb,text,text)'::regprocedure
--   AND a.grantee = 0;
--
-- FUNCTIONAL VALIDATION — only in an isolated/controlled DEV environment:
-- 1. Submit a valid public response through the RPC as anon and authenticated.
-- 2. Confirm malformed payloads are rejected and repeat submission keys remain
--    idempotent.
-- 3. Confirm direct INSERT is denied for anon and authenticated.
-- 4. Confirm authenticated SELECT returns only the user's own company's responses
--    and does not expose another company's responses.
-- Do not run fixture-writing pgTAP tests against HML, PROD, or live user data.
