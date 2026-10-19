-- Public survey access
--
-- Contexto: o fluxo publico de pesquisas (/participar/[surveyId]) funciona
-- sem autenticacao. As policies de leitura publica continuam restritas a
-- pesquisas ativas. Respostas publicas devem ser enviadas pela RPC
-- submit_public_survey_response; este script nao concede INSERT direto em
-- public.responses para anon.
--
-- As policies de RLS versionadas incluem:
--   - public.surveys:          "Anyone can view active public surveys"
--   - public.survey_quest  ions: "Public can view active survey questions"
--
-- GRANT e RLS sao camadas independentes no Postgres. Este script concede
-- somente SELECT publico nas tabelas necessarias ao formulario; ele nao
-- altera policies nem revoga grants que possam existir de execucoes anteriores
-- ou de outras ACLs. A verificacao/revogacao efetiva de INSERT em responses
-- deve ser feita por migration separada e revisada.
--
-- Resumo dos GRANTs abaixo, condicionados ao RLS existente:
--   - surveys: leitura publica so e permitida quando a policy encontra
--     uma linha com status = 'active'.
--   - survey_questions: leitura publica so e permitida quando a pergunta
--     pertence a uma pesquisa com status = 'active'.
--
-- Nenhuma policy de RLS e alterada, criada ou removida por esta migration.
-- Nenhum outro privilegio (ALL, UPDATE, DELETE, INSERT em surveys ou
-- survey_questions, INSERT/SELECT em responses) e concedido para anon.

GRANT SELECT ON public.surveys TO anon;
GRANT SELECT ON public.survey_questions TO anon;
