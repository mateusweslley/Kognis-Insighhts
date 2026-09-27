-- Public survey access
--
-- Contexto: o fluxo publico de pesquisas (/participar/[surveyId]) foi
-- projetado desde o inicio para funcionar sem autenticacao, e as policies
-- de RLS que restringem esse acesso ja existem e ja estao corretas:
--   - public.surveys:          "Anyone can view active public surveys"
--   - public.survey_questions: "Public can view active survey questions"
--   - public.responses:        "Visitors can answer active surveys"
--
-- O que faltava e o que esta migration resolve: GRANT e RLS sao duas
-- camadas independentes e sequenciais no Postgres. O GRANT apenas libera,
-- no nivel da TABELA, a possibilidade da role tentar a operacao. Ele nao
-- concede acesso a nenhuma linha por si so. Sem o GRANT, o Postgres nega
-- a requisicao (42501 - permission denied) antes mesmo de a policy de RLS
-- ser avaliada. Com o GRANT presente, e o RLS quem continua decidindo,
-- linha a linha, o que a role anon realmente enxerga ou consegue inserir.
--
-- Resumo do que cada GRANT abaixo habilita, condicionado ao RLS existente:
--   - surveys: leitura publica so e permitida quando a policy encontra
--     uma linha com status = 'active'.
--   - survey_questions: leitura publica so e permitida quando a pergunta
--     pertence a uma pesquisa com status = 'active'.
--   - responses: insercao publica so e permitida quando a resposta
--     referencia uma pesquisa com status = 'active'.
--
-- Nenhuma policy de RLS e alterada, criada ou removida por esta migration.
-- Nenhum outro privilegio (ALL, UPDATE, DELETE, INSERT em surveys ou
-- survey_questions, SELECT em responses) e concedido para anon.

GRANT SELECT ON public.surveys TO anon;
GRANT SELECT ON public.survey_questions TO anon;
GRANT INSERT ON public.responses TO anon;