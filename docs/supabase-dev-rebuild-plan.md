# Plano técnico para reconstruir o Supabase DEV

Data da auditoria: 18/10/2026. Escopo: arquivos do repositório, sem conexão a Supabase, leitura de `.env.local`, execução de SQL ou execução de testes.

## Resumo executivo

Os 15 scripts numerados formam uma sequência proposta para criar os objetos da aplicação em um banco Supabase DEV recém-criado e descartável. Eles não constituem, sozinhos, uma especificação reproduzível de todo o projeto Supabase: pressupõem Auth, roles e funções do Supabase, privilégios padrão e decisões de configuração que não estão versionadas. Não há `supabase/config.toml`, migrations CLI, setup de extensões/testes ou inventário das configurações de Auth.

A ordem proposta 001–015 respeita as dependências locais identificadas. A etapa 014 persiste a pergunta principal de avaliação por pesquisa; depende de `surveys`, `survey_questions` e do tipo `rating`. A etapa 015 aplica SEC-02, revoga os privilégios diretos das roles clientes em `responses`, remove a policy pública de INSERT e mantém a submissão pela RPC validada. O usuário informou que 015 foi aplicada e validada funcionalmente em DEV. Isso não comprova a configuração de outro projeto, inclusive HML, nem valida grants efetivos, `pgcrypto`, Auth ou o sucesso de cada script no PostgreSQL da versão escolhida. O teste SEC-01 continua dependendo de pgTAP e de um executor, ausentes da configuração do repositório.

**HML não deve ser usado para reconstruir DEV.** A reconstrução descrita aqui é exclusivamente para um projeto DEV novo e descartável. O estado atual de HML não foi inspecionado e não deve ser inferido dos arquivos locais nem da validação SEC-02 em DEV. Uma futura preparação de HML exige inventário próprio do banco, comparação com cada etapa e plano incremental aprovado; não se deve reaplicar a sequência completa a um banco existente. Se uma etapa falhar durante uma reconstrução DEV descartável, pare e registre o estado; a recuperação pode exigir recriar esse projeto isolado após aprovação, em vez de reexecutar scripts parcialmente idempotentes.

## Evidências do repositório

- `supabase/README.md` relaciona os scripts 001–015 e os testes SQL em `supabase/tests/`.
- Os 15 scripts usam tabelas, funções, triggers, índices, RLS, policies e grants. Não definem tipos/enums, views, buckets de Storage, Edge Functions ou configuração de serviços Supabase.
- `package.json` oferece `npm test` via Vitest. `vitest.config.ts` inclui somente `src/**/*.test.ts`; o SQL pgTAP não será executado por `npm test`. Não há Supabase CLI, driver `pg`, pgTAP, runner SQL ou script de migração declarado no `package.json`.
- `.env.example` documenta somente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. O código da aplicação lê essas duas variáveis, cria clientes Supabase browser/server e usa Auth por email/senha, `getUser`, `signUp`, `signInWithPassword`, reenvio de confirmação e a RPC `submit_public_survey_response`.
- O redirect após cadastro/reenviar confirmação é derivado de `window.location.origin` e termina em `/dashboard`; a aplicação não especifica redirect fixo por ambiente. O middleware protege páginas da aplicação.
- Busca estática em `src/` não encontrou uso de Storage, canais Realtime, invocação de Edge Functions ou segredos Supabase adicionais. Isso não substitui inspeção de configuração do projeto ou do ambiente de deploy.
- A busca nos SQL encontrou dependência explícita de `auth.users`, `auth.uid()`, roles `anon` e `authenticated`, schema `public`, extensão `pgcrypto` e, para a RPC, schema `extensions` no `search_path`. `012` também usa `pg_catalog` e `pg_temp` no `search_path` de uma função.

## Pré-requisitos do banco e do projeto

### Plataforma/roles e schemas

Criar um projeto Supabase PostgreSQL novo que tenha os objetos e serviços de plataforma requeridos pelos scripts: schema `auth`, tabela `auth.users`, função `auth.uid()`, roles `anon` e `authenticated`, além de role administrativa com permissões para instalar extensão, criar objetos, alterar grants e gravar os dados de teste em `auth.users`. Os scripts não criam essas roles ou objetos.

Os objetos próprios são criados em `public`. O projeto precisa expor o schema `public` pela Data API para os clientes Supabase usados pela aplicação, além de ter os grants necessários para cada role. A existência de uma policy não concede privilégio de tabela: grant e RLS são verificações separadas.

### `pgcrypto`, UUIDs e bytes aleatórios

Os scripts `001`, `002`, `004`, `005`, `009`, `010` e `011` pedem `CREATE EXTENSION IF NOT EXISTS pgcrypto` sem cláusula `WITH SCHEMA`. Assim, **o repositório não fixa o schema no qual `pgcrypto` ficará instalado**; o resultado depende do estado/configuração do projeto e de uma instalação anterior. A documentação do Supabase diz que a maioria das extensões fica em `extensions`, mas isso não prova a localização efetiva de `pgcrypto` neste futuro projeto. A RPC em `011` e `012` fixa `search_path = public, extensions, pg_temp` e chama `gen_random_bytes()` sem qualificação de schema.

`gen_random_uuid()` é usado como default de IDs. A documentação PostgreSQL atual também oferece `gen_random_uuid()` como função core; em versões/documentação que também listam a função pgcrypto, a implementação da extensão é descrita como wrapper obsoleto para a função core. Portanto, encontrar essa função não comprova, por si só, que pgcrypto está instalado.

`gen_random_bytes(6)` e `gen_random_bytes(16)` são usados pelo gerador de códigos e token da RPC. O PostgreSQL documenta `gen_random_bytes(integer)` como função da extensão pgcrypto. Antes de executar `011`, confirmar no projeto DEV:

1. versão PostgreSQL e suporte/disponibilidade de `pgcrypto`;
2. se a extensão está instalada e qual o schema registrado em `pg_extension`;
3. resolução de `gen_random_uuid()` e `gen_random_bytes(integer)` pelos `search_path` usados;
4. permissões para criar a extensão, ou provisioná-la previamente pelo procedimento aprovado do Supabase;
5. disponibilidade do schema `extensions` citado pela RPC.

Não adicionar SQL de diagnóstico ao conjunto nesta tarefa. A confirmação futura deve ser uma checagem read-only no projeto DEV antes de aplicar a sequência. Referências: [extensões no Supabase](https://supabase.com/docs/guides/database/extensions) e [pgcrypto no PostgreSQL 16](https://www.postgresql.org/docs/16/pgcrypto.html).

### Permissões, RLS e validação por ambiente

- `001`–`005` criam policies, mas não declaram grants explícitos para as tabelas base. O funcionamento depende dos privilégios efetivos/defaults do projeto Supabase. Verificar ACLs e default privileges do projeto DEV, não inferir pelo HML.
- `009` e `010` concedem privilégios a `authenticated`; `011` revoga execução da RPC de `PUBLIC` e concede `EXECUTE` a `anon` e `authenticated`; `013` concede apenas `SELECT` a `anon` em pesquisas e perguntas.
- `004_responses.sql` cria policy de INSERT público; `013` não concede esse privilégio nem revoga ACLs preexistentes. A etapa 015 revoga os privilégios diretos de `PUBLIC`, `anon` e `authenticated`, mantém SELECT para `authenticated`, remove a policy pública de INSERT e preserva a submissão por RPC. SEC-02 foi informada como aplicada e validada funcionalmente em DEV: INSERT direto pela role cliente foi negado e a submissão via RPC continuou funcionando. Em uma reconstrução de DEV descartável, aplicar 015 por último e verificar os privilégios antes de liberar o uso público. A migration não altera memberships ou default privileges; inspecione-os no projeto alvo. Isso não confirma o estado de HML. Grants e RLS são camadas distintas: [RLS, grants e roles](https://supabase.com/docs/guides/database/postgres/row-level-security).
- `009` e `011` definem `campaigns_enforce_active()`; a versão 011 substitui a anterior e muda o trigger para INSERT/UPDATE. `011` define `submit_public_survey_response()` e `012` substitui sua implementação com validação SEC-01. A ordem é obrigatória.
- `012` cria índices únicos a partir dos dados presentes. Em DEV novo as tabelas devem estar vazias; se não estiverem, violações podem interromper a migration. A migration não revalida respostas históricas.
- `009` realiza backfill de `campaigns.survey_id` em `campaign_surveys`. Em banco vazio não haverá dados para copiar. Isso mostra que os scripts são também incrementais e não foram escritos exclusivamente como bootstrap atômico.

### Auth, URLs, secrets e serviços

O banco não determina sozinho a configuração do Auth. Para testar a aplicação, definir explicitamente no DEV:

- provedor email/senha habilitado e política de confirmação de email escolhida para DEV;
- `Site URL` e allowlist de Redirect URLs incluindo o domínio local/de preview que será usado e o caminho de callback pós-confirmação `/dashboard`;
- SMTP/templates de email apropriados se a confirmação real por email for validada; o repositório não os configura;
- URL do projeto DEV e chave pública (anon legada ou chave publicável suportada pela configuração/app) somente no ambiente local/de deploy DEV, sem copiar valores de HML nem colocar segredo de service role no cliente.

A documentação Supabase diz que o `Site URL` é fallback para confirmações/reset e que `emailRedirectTo` deve estar na lista permitida: [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [configuração Auth](https://supabase.com/docs/guides/auth/general-configuration) e [templates de email](https://supabase.com/docs/guides/auth/auth-email-templates).

Não encontrei no repositório uso de Storage, OAuth, Edge Functions, Vault ou secrets de função que exija configuração para o fluxo atual. Portanto buckets e policies de Storage não são pré-requisito demonstrado. Isso não afirma que o projeto HML esteja sem tais recursos nem que futuros requisitos não os introduzam.

## Reconstrução de DEV descartável: sequência proposta

Executar uma vez cada script, na ordem abaixo, somente após o projeto DEV isolado existir e os pré-requisitos de plataforma serem verificados. Manter um registro externo com timestamp, resultado e responsável por cada etapa; a pasta atual não tem ledger de migração.

1. `001_companies.sql` — base de empresas, `set_updated_at`, trigger e RLS; requer Auth.
2. `002_surveys.sql` — pesquisas; depende de companies e função de timestamp.
3. `003_survey_questions.sql` — perguntas; depende de surveys e função de timestamp.
4. `004_responses.sql` — respostas e policies públicas/privadas; depende de surveys/companies. Antes da exposição pública, revisar grants efetivos junto à policy de INSERT.
5. `005_campaigns.sql` — campanhas legadas; depende de companies e surveys.
6. `006_metrics_baseline.sql` — colunas `objective` e `topic`; depende de surveys e survey_questions.
7. `007_survey_objectives.sql` — coluna `objective_note` e ampliação da constraint `objective`; depende de `006`.
8. `008_question_types.sql` — amplia tipos de pergunta; depende de survey_questions.
9. `009_campaigns_foundation.sql` — tabelas N:N/recompensas/claims, constraints, backfill, triggers, RLS e grants; depende das tabelas base.
10. `010_dashboard_builder.sql` — dashboards/widgets/templates, triggers, RLS e grants; depende de companies, surveys e survey_questions.
11. `011_submission_gateway.sql` — índice de idempotência global inicial, trigger de campanhas, gerador e RPC; depende de responses e objetos de campanha; requer pgcrypto resolvível no search_path.
12. `012_submission_validation.sql` — índices de idempotência por survey, trigger de exclusão e implementação SEC-01 da RPC; depende da 011 e pode exigir unicidade dos dados.
13. `013_public_survey_grants.sql` — SELECT público de surveys e survey_questions; depende das tabelas/policies anteriores e não revoga grants.
14. `014_primary_survey_question.sql` — adiciona a configuração opcional da pergunta principal em `surveys`, com vínculo à pergunta da mesma pesquisa e validação do tipo `rating`; depende de 003 e 008.
15. `015_sec02_responses_least_privilege.sql` — revoga privilégios diretos de cliente em `responses`, concede SELECT a `authenticated`, remove a policy pública de INSERT e mantém EXECUTE da RPC para `anon` e `authenticated`; depende da tabela/policy de 004 e da RPC de 011–012. É a etapa final antes de liberar a aplicação pública.

O passo a passo acima é para um projeto DEV novo e descartável, sem objetos ou dados da aplicação. A informação de que 015 foi validada em DEV não comprova que toda a sequência 001–015 tenha sido reaplicada em outro projeto limpo nem que o bootstrap seja reproduzível de ponta a ponta.

### Banco existente e futura preparação de HML

Para qualquer banco que já contenha objetos ou dados da aplicação, comece por um inventário somente de leitura do schema, dados relevantes, ACLs, memberships, policies e histórico de alterações disponível. Compare cada etapa com o estado observado e determine individualmente se ela está pendente e se é compatível. A numeração não constitui um ledger de aplicação: não reaplique indiscriminadamente os 15 scripts em um banco existente.

O estado de HML não foi inspecionado. A validação informada de SEC-02 vale para o DEV consultado e não demonstra que 015, nem qualquer outra etapa, foi aplicada em HML. Uma futura preparação de HML requer inventário próprio, comparação com os scripts e um plano incremental revisado; não trate a sequência de bootstrap de DEV como histórico de migrations de HML.

O teste `supabase/tests/2026_submission_validation.test.sql` é validação após a etapa 012, não migration. Usa funções pgTAP `plan`, `is`, `ok`, `throws_ok` e `finish`; executa DML em `auth.users` e tabelas da aplicação, encerra com rollback e declara plano de 52 asserts. Requer extensão pgTAP instalada e executor que interprete TAP/retorne falhas. Supabase documenta `supabase test db` como executor pgTAP, com SQL sob `supabase/tests`; para esse arquivo fora do subdiretório convencional `tests/database`, indicar o caminho explicitamente e confirmar a sintaxe da versão de CLI aprovada. A CLI atual documenta suporte a `[path]` e `--db-url`; pgTAP é uma extensão habilitada separadamente. Não use `--linked` apontando para HML. Referências: [testes de banco no Supabase](https://supabase.com/docs/guides/database/testing), [pgTAP](https://supabase.com/docs/guides/database/extensions/pgtap) e [referência CLI](https://supabase.com/docs/reference/cli/supabase-orgs).

O arquivo insere diretamente em `auth.users`, então a execução deve ocorrer em banco descartável e com um executor/role autorizado. A transação/rollback protege os dados do teste quando a sessão termina normalmente, mas não substitui o isolamento do banco nem garante limpeza em toda interrupção/conexão perdida.

## Plano de execução e validação futura

### Antes de reconstruir o DEV descartável

1. Aprovar a criação de um projeto chamado/identificado inequivocamente como DEV e anotar project ref, região, versão PostgreSQL, política de backup e pessoa responsável. Confirmar visualmente que a sessão/ferramenta selecionou DEV, não HML.
2. Fazer inventário das configurações iniciais do projeto DEV: Auth, API/Data API e schemas expostos, roles, default privileges, extensões e schemas, grants de tabela e execução de funções. Guardar evidência sem expor chaves.
3. Definir e documentar URL de desenvolvimento, redirects de Auth, confirmação de email e SMTP/teste. Obter somente URL e chave pública do DEV para o ambiente de desenvolvimento. Não usar service role no navegador.
4. Considerar SEC-02 como validada no projeto DEV informado. Para outro DEV limpo, incluir a etapa 015 ao final, conferir ACLs, memberships/default privileges e EXECUTE da RPC antes de expor o formulário público.
5. Definir método de aplicação (editor administrativo ou cliente PostgreSQL aprovado), versão da ferramenta, tratamento de credenciais e registro de etapas. Testar o método em ambiente descartável. O repositório não fornece runner.
6. Confirmar requisitos de pgcrypto e pgTAP no próprio DEV. Não confundir a função core `gen_random_uuid()` com a extensão necessária para `gen_random_bytes()`.

### Aplicação controlada

1. Garantir que DEV está vazio quanto aos objetos do app e dados; salvar evidência inicial.
2. Aplicar arquivos 001–015 individualmente e em ordem, como role administrativa apropriada. Conferir mensagem de sucesso e consultar catálogo/definições após cada etapa antes de seguir; manter a aplicação pública desligada até a validação de 015.
3. Se qualquer etapa falhar, parar; não continuar nem executar tudo novamente às cegas. Registrar SQLSTATE, etapa e estado parcial sem incluir segredos. Em schema parcialmente alterado, decidir recuperação com revisão. Como não há ledger nem scripts garantidamente idempotentes, a opção mais simples para um DEV ainda descartável pode ser recriar o projeto DEV vazio, mediante aprovação; nunca resetar ou alterar HML.
4. Depois da 015, conferir tabelas/colunas, FKs, constraints, índices, funções, triggers, policies, RLS, grants, schema de pgcrypto, `search_path` das funções SECURITY DEFINER e privilégios efetivos. Confirmar INSERT direto negado às roles clientes, SELECT necessário para `authenticated` e EXECUTE da RPC para as roles públicas pretendidas.
5. Habilitar pgTAP e executar apenas `2026_submission_validation.test.sql` com CLI/runner aprovado contra DEV isolado. Guardar saída TAP e status de processo; os 52 asserts devem passar. Em caso de falha, preservar saída e banco para diagnóstico, sem repetir operações não transacionais manualmente sem entender o estado.
6. Executar os testes TypeScript da aplicação (`npm test`) separadamente e iniciar/buildar a aplicação depois de configurar as variáveis locais exclusivamente com endpoint/key DEV. Validar cadastro/login, confirmação de email, criação de empresa, pesquisa/perguntas, submissão pública pela RPC, campanhas/recompensas e dashboards. Os testes Vitest existentes cobrem lógica de app, não substituem teste SQL nem integração real.
7. Registrar versões, checksums dos 15 scripts, outputs de cada etapa, evidência de catálogos/ACLs, resultado pgTAP/Vitest e data/responsável. Não declarar reconstrução repetível até a sequência ser executada com sucesso em outro banco DEV limpo ou em ciclo controlado documentado.

## O que pode ser verificado localmente e o que exige DEV

| Localmente, sem banco | Exige projeto Supabase DEV real |
|---|---|
| Inventário de SQL, ordem declarada, referências, funções chamadas, grants escritos, configurações ausentes no repositório, escopo do Vitest e variáveis lidas. | Versão/roles/schemas reais, Auth e `auth.uid()`, criação de extensão, localização e resolução de pgcrypto, Data API e default privileges. |
| Revisão estática de FKs, constraints, policies, functions, SECURITY DEFINER e referências de search_path. Um parser/linter PostgreSQL poderia achar erros de sintaxe, mas não há um instalado/configurado no repositório e não foi adicionado. | Aplicabilidade/compatibilidade dos scripts, conflitos de constraints/índices/dados, comportamento de grants+RLS, RPC, trigger, PostgREST e sessão Auth. |
| Confirmar que `npm test` é Vitest e não inclui `.sql`; confirmar existência do arquivo pgTAP e sua contagem declarada. | Habilitar pgTAP, executar os 52 asserts, autenticação/email/redirects, integração real da aplicação, RLS e comportamento de sessão. |

## Critérios objetivos para declarar DEV pronto

Todos os critérios precisam ser evidenciados no próprio DEV:

- Projeto e endpoint identificados como DEV; nenhum comando ou credencial direcionado a HML/PROD.
- 001–015 completados na ordem em uma reconstrução limpa, com resultado e versões registrados; schema contém os objetos esperados e nenhuma etapa foi ignorada silenciosamente. A validação anterior de SEC-02 não substitui a evidência de uma execução completa e limpa.
- Extensões e funções necessárias resolvem no schema/search_path correto; funções SECURITY DEFINER e grants inspecionados.
- ACLs e policies revisadas conjuntamente; o fluxo público usa exatamente a superfície de escrita aprovada, sem caminho direto não intencional.
- Os 52 testes SEC-01 passam via pgTAP; testes TypeScript passam; checklist de integração manual da aplicação é concluído com endpoint DEV.
- Auth, confirmação, Site URL, redirect allowlist e email funcionam no domínio de desenvolvimento previsto.
- Há procedimento documentado para repetir/criar outro DEV limpo e recuperar de falhas; um segundo ciclo limpo confirma reprodutibilidade antes de declarar o bootstrap como reproduzível.

## Riscos e recuperação

- **Alvo errado:** interromper antes de executar se o project ref/URL não for DEV. HML é fora de escopo e deve permanecer inalterado.
- **Falha parcial:** parar na primeira falha; capturar etapa, erro e catálogo parcial; não reexecutar o script sem análise. Em DEV descartável e sem dados, recriação controlada é preferível a tentativa de rollback manual de alterações DDL mistas.
- **Dados/índices únicos:** os scripts 009/011/012 podem inserir backfill, remover/criar índices/constraints e substituir funções. Fazer snapshot/export do DEV se houver dados que devam ser preservados; nunca usar a sequência para atualizar HML.
- **RLS/grants:** ACL default pode ser mais ampla que o esperado. Conferir `has_table_privilege`/catálogos ou ferramenta equivalente com role administrativa e testar requests como `anon` e `authenticated`; não deduzir efetividade apenas lendo policy.
- **Teste interrompido:** pgTAP usa dados IDs fixos e assume transação; verificar se não restaram linhas de teste. Se restarem, manter DEV isolado e recuperar após inspeção, sem apagar dados de forma ampla.
- **Credenciais:** manter senha de banco, connection string e tokens fora do Git, logs e captura compartilhada; variáveis públicas só contêm URL e chave pública do projeto DEV.
- **Versão/ferramentas:** fixar versão do PostgreSQL e CLI/runner no plano operacional futuro. Mudanças de versão podem alterar extensões, defaults e comportamento.

## Lacunas/bloqueios para reprodutibilidade

1. Não há configuração Supabase provisionável no repo (config CLI, migrations/ledger, seeds/setup, projeto IaC) nem registro da versão PostgreSQL.
2. Auth/roles/schemas/grants/default privileges e API schema exposure não são reconstruídos pelos 15 scripts.
3. Extensão pgcrypto é solicitada sem schema explícito; `011`/`012` assumem `extensions` no `search_path`. Isso precisa ser confirmado ou padronizado em uma mudança futura revisada.
4. pgTAP não aparece no package/configuração do projeto e não há instrução local de habilitação/executor. O teste está sob `supabase/tests/`, enquanto exemplos Supabase costumam usar `tests/database`; usar path explícito e validar descoberta da CLI escolhida.
5. Embora SEC-02 tenha sido informada como aplicada e validada no DEV consultado, memberships, default privileges e estado de cada role continuam dependendo de inspeção no projeto alvo. Não se infere o acesso efetivo em um DEV novo nem em HML apenas pela migration local.
6. Configuração de email Auth, SMTP/templates, Site URL/redirect allowlist e valores do ambiente DEV não são reproduzidos por arquivos versionados.
7. Sem execução controlada num banco DEV descartável, não há prova de compatibilidade, sucesso das migrations, pgTAP ou funcionamento integrado.
8. Não há evidência versionada do estado real de HML ou de um ledger de aplicação por ambiente. A sequência 001–015 documenta a ordem proposta para um DEV novo, não quais alterações já existem em HML.

**Conclusão:** há uma ordem proposta de 001–015 e uma especificação parcial do schema da aplicação. SEC-02 foi informada como aplicada e validada no DEV consultado, mas isso não prova que a sequência completa reconstrói outro DEV limpo nem que HML está atualizado. O banco DEV não é reproduzível de ponta a ponta apenas a partir do repositório: permanecem dependências de plataforma, Auth, extensões, grants/default privileges e executor pgTAP. Antes de qualquer mudança em banco existente, especialmente HML, é necessário inventariar o ambiente e aprovar um plano incremental específico.
