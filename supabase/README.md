# Scripts SQL do Supabase

Este diretório reúne scripts SQL incrementais, não um conjunto de migrations gerenciado pelo Supabase CLI. A sequência abaixo foi inferida pela leitura das dependências declaradas nos próprios scripts. Ela representa uma ordem para um banco DEV novo, mas não prova que o repositório reproduz sozinho todo o projeto Supabase nem descreve o estado remoto de HML.

## Ordem sugerida para banco DEV vazio

Execute os scripts numerados uma única vez, na ordem indicada:

| Ordem | Script | Objetivo e dependências principais |
|---|---|---|
| 001 | `001_companies.sql` | Cria `public.companies`, `public.set_updated_at()`, trigger e RLS. Depende do Supabase Auth: `auth.users`, `auth.uid()` e role `authenticated`. |
| 002 | `002_surveys.sql` | Cria `public.surveys`, trigger e policies. Depende de `companies`, `set_updated_at()` e Auth/RLS. |
| 003 | `003_survey_questions.sql` | Cria `public.survey_questions`, trigger e policies. Depende de `surveys`, `companies`, `set_updated_at()` e Auth/RLS. |
| 004 | `004_responses.sql` | Cria `public.responses` e policies de leitura/resposta pública. Depende de `surveys`, `companies`, Auth e roles `anon`/`authenticated`. |
| 005 | `005_campaigns.sql` | Cria `public.campaigns`, trigger e policies. Depende de `companies`, `surveys`, `set_updated_at()` e Auth/RLS. |
| 006 | `006_metrics_baseline.sql` | Adiciona `surveys.objective` e `survey_questions.topic`, com constraints. Depende das tabelas 002 e 003. |
| 007 | `007_survey_objectives.sql` | Adiciona `surveys.objective_note` e amplia a constraint de `objective`. Depende da coluna `objective` da etapa 006. |
| 008 | `008_question_types.sql` | Amplia a constraint de `survey_questions.type`. Depende da tabela 003. |
| 009 | `009_campaigns_foundation.sql` | Evolui `campaigns`; cria `campaign_surveys`, `campaign_rewards`, `campaign_claims`, funções, triggers, RLS e grants; copia vínculos legados de `campaigns.survey_id`. Depende das tabelas 001–005 e de `set_updated_at()`. Inclui backfill e não é apenas DDL. |
| 010 | `010_dashboard_builder.sql` | Cria dashboards, widgets e templates, com triggers, RLS e grants. Depende de `companies`, `surveys`, `survey_questions`, `set_updated_at()` e Auth. |
| 011 | `011_submission_gateway.sql` | Adiciona idempotência de resposta e índices de campanha, atualiza trigger e define RPC `submit_public_survey_response`. Depende de `responses`, `campaign_claims` e objetos da etapa 009; usa `pgcrypto` (`gen_random_bytes`) e grants para `anon`/`authenticated`. |
| 012 | `012_submission_validation.sql` | Restringe a RPC de submissão, troca os índices de idempotência e cria trigger antes da exclusão de pesquisa. Depende das tabelas e RPC das etapas 002–004, 009 e 011. Índices únicos podem falhar caso os dados existentes violem a nova unicidade. |
| 013 | `013_public_survey_grants.sql` | Concede `SELECT` para `anon` em `surveys` e `survey_questions`. Depende das tabelas e das policies públicas definidas nas etapas 002 e 003. Não remove grants antigos nem altera policies. |
| 014 | `014_primary_survey_question.sql` | Adiciona a configuração opcional da pergunta principal em `surveys`; usa FK composta para vincular pergunta e pesquisa e triggers para exigir tipo `rating`, impedir reclassificação e limpar a configuração ao excluir a pergunta. Depende de `surveys`, `survey_questions` e do tipo `rating` disponibilizado na etapa 008. |
| 015 | `015_sec02_responses_least_privilege.sql` | Restringe os privilégios diretos em `responses`, mantém `SELECT` para `authenticated`, remove a policy de INSERT público e preserva a submissão pelo RPC. Depende de `responses`, da policy criada em 004 e da RPC criada/validada em 011–012. Deve ser a última etapa desta sequência. Foi informada como aplicada e validada no DEV; não a reaplique nesse ambiente. |

## Testes SQL

`tests/2026_submission_validation.test.sql` é um teste de aceitação pgTAP para a etapa 012, não uma etapa de instalação. O nome do arquivo de teste não demonstra a existência de uma migration anterior chamada `2026_submission_validation.sql`. O teste espera pgTAP já disponível, insere dados em `auth.users` e nas tabelas da aplicação e executa asserções dentro de uma transação com rollback. Execute apenas em banco de teste descartável e após preparar as dependências da suíte; não foi executado nesta tarefa.

`tests/2026_primary_survey_question.test.sql` verifica a configuração explícita, o pertencimento à mesma pesquisa, o tipo permitido, remoção e exclusão da pergunta. Execute apenas em banco de teste descartável após aplicar 001–014; o teste não faz parte das etapas de instalação.

## Pré-requisitos e lacunas

- Os scripts pressupõem um projeto Supabase com schema e serviços de Auth, roles `anon` e `authenticated`, funções `auth.uid()`/`auth.users`, e grants base que permitam criar objetos. A configuração/provisionamento desses componentes não está versionada aqui.
- `pgcrypto` é solicitado nos scripts que usam UUIDs/criptografia. O repositório não fixa a configuração do schema da extensão; a RPC também inclui `extensions` em seu `search_path`. Confirme a disponibilidade de `gen_random_uuid()` e `gen_random_bytes()` no projeto DEV.
- pgTAP e a configuração de execução dos testes não estão provisionados por estes arquivos.
- Não há configuração Supabase, diretório convencional `supabase/migrations/` nem histórico/ledger de migrations neste conjunto. Também não existe inventário declarativo completo de extensões, parâmetros, grants padrão, Auth, storage, secrets ou configurações de projeto.
- Os scripts locais não definem views nem tipos/enums próprios. Não foi possível provar, apenas pelo repositório, que não há dependências externas adicionais nos ambientes.
- `011_submission_gateway.sql` define a RPC e `012_submission_validation.sql` substitui sua implementação. A ordem 011 → 012 é necessária. `009_campaigns_foundation.sql` e 011 também definem `campaigns_enforce_active()`; o gateway substitui a versão da fundação.
- `004_responses.sql` cria policy de INSERT público em `responses`, mas `013_public_survey_grants.sql` não concede `INSERT` a `anon`. Policy RLS e privilégio de tabela são camadas independentes. A submissão pública é feita pela RPC nas etapas 011–012; a etapa 015 remove a policy de INSERT e revoga privilégios diretos das roles clientes. O grant 013 não revoga privilégios preexistentes.

## Diferenças históricas e aplicação em banco existente

- O antigo `_public_survey_grants.sql` concedia `SELECT` em `surveys` e `survey_questions` e também `INSERT` em `responses` para `anon`. O atual `013_public_survey_grants.sql` concede somente os dois `SELECT`; essa diferença é intencional no conteúdo versionado, e a restrição de escrita direta fica explícita em 015.
- Não foi encontrado um arquivo SQL antigo `2026_submission_validation.sql` entre os scripts removidos do histórico de trabalho. `012_submission_validation.sql` é a etapa que substitui a implementação da RPC e estabelece validações SEC-01; o nome `2026_submission_validation.test.sql` identifica o teste, não uma migration predecessora.
- `014_primary_survey_question.sql` e `015_sec02_responses_least_privilege.sql` são etapas adicionadas à sequência; não possuem correspondência entre os scripts antigos listados na tabela abaixo.
- A numeração documenta a ordem proposta para uma instalação limpa a partir desses arquivos e dos pré-requisitos Supabase descritos aqui. Ela não prova que HML ou qualquer outro banco tenha recebido essas etapas. Este conjunto não é um histórico gerenciado pelo Supabase CLI e não mantém ledger de aplicação.
- Para um banco existente, não execute a sequência inteira por causa da numeração. Primeiro compare o schema, dados, constraints, índices, funções, policies e ACLs reais com cada etapa. Scripts podem falhar, substituir objetos ou afetar dados; em especial, 009 inclui backfill, 012 cria índices únicos sujeitos à consistência dos dados e 015 pressupõe a RPC e a policy alvo existentes. No DEV, 015 já foi informada como aplicada e validada; não a reaplique sem necessidade confirmada.

## Cuidados para reconstrução

1. Use um projeto Supabase DEV vazio, descartável e isolado; não use HML ou PROD.
2. Revise os pré-requisitos e a configuração do projeto Supabase antes de aplicar qualquer script.
3. Execute manualmente a sequência numerada e registre o resultado de cada etapa. Estes arquivos não fornecem um runner nem uma tabela de controle que impeça reexecução.
4. Os scripts iniciais usam `CREATE TABLE IF NOT EXISTS`, mas isso não reconcilia um schema divergente. Há `DROP`/recriação de constraints, índices e policies, comandos sem guarda contra ausência, operações de backfill e grants aditivos. Portanto, não trate todos como universalmente idempotentes.
5. **Não execute indiscriminadamente os scripts em um banco já utilizado.** Scripts incrementais podem falhar, substituir funções/constraints ou alterar dados; confirme previamente quais alterações já foram aplicadas. Em particular, validação cria índices únicos e o script de grants não revoga ACLs.
6. A sequência ainda não comprova uma reconstrução integral. Compare objetos e configurações do projeto alvo com os pré-requisitos acima antes de afirmar que DEV foi reproduzido.

## Histórico de nomes

Os nomes numerados abaixo registram a sequência atual, mas nem todos são renomeações equivalentes: 001–011 correspondem aos scripts antigos listados; 012 é uma etapa nova de validação SEC-01; 013 substitui o antigo script de grants com conteúdo diferente; 014 e 015 são etapas posteriores. Referências ativas na aplicação e caminhos registrados no log do projeto foram atualizados. Os comentários de cabeçalho dentro dos scripts que ainda citam nomes anteriores foram preservados para manter o conteúdo SQL intacto. A tabela mostra as correspondências históricas confirmadas:

| Nome anterior | Nome atual |
|---|---|
| `companies.sql` | `001_companies.sql` |
| `surveys.sql` | `002_surveys.sql` |
| `survey_questions.sql` | `003_survey_questions.sql` |
| `responses.sql` | `004_responses.sql` |
| `campaigns.sql` | `005_campaigns.sql` |
| `2026_metrics_baseline.sql` | `006_metrics_baseline.sql` |
| `2026_survey_objectives.sql` | `007_survey_objectives.sql` |
| `2026_question_types.sql` | `008_question_types.sql` |
| `2026_campaigns_foundation.sql` | `009_campaigns_foundation.sql` |
| `2026_dashboard_builder.sql` | `010_dashboard_builder.sql` |
| `2026_submission_gateway.sql` | `011_submission_gateway.sql` |
| `_public_survey_grants.sql` | `013_public_survey_grants.sql` (conteúdo alterado: sem INSERT em `responses`) |
