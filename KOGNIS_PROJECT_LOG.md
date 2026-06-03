# Kognis Project Log

## Sprint 3 - Gestao da Empresa/Marca

Status: implementada e pronta para validacao manual.

Entregas:
- Criada estrutura da tabela `companies` com SQL versionado.
- Adicionadas policies de RLS para limitar acesso por `auth.uid() = owner_id`.
- Implementado onboarding obrigatorio para usuarios autenticados sem empresa.
- Implementada criacao e edicao dos dados da empresa.
- Adicionado nome da empresa no header e menu lateral quando disponivel.
- Mantida autenticacao Supabase com sessao por cookies.

Validacoes executadas:
- `npx tsc --noEmit`
- `npm run lint`

Pontos de atencao:
- O SQL de `supabase/companies.sql` precisa ser aplicado no Supabase antes do teste funcional completo.
- `npm run build` ainda falha no ambiente local por acesso bloqueado ao Google Fonts e permissao em `.next/trace`, antes de concluir a compilacao.
- Nenhuma service role key foi adicionada ao projeto.

## Sprint 4 - Modulo de Pesquisas

Status: implementada e pronta para validacao manual.

Objetivo:
- Permitir que a empresa autenticada crie, liste, edite e arquive pesquisas.

Entregas:
- Criada tela funcional em `/pesquisas` com listagem por empresa.
- Adicionado estado vazio com acao para criar a primeira pesquisa.
- Implementado formulario de criacao com titulo, descricao e status.
- Implementada edicao de titulo, descricao e status.
- Implementado arquivamento alterando `status` para `archived`, sem delete fisico.
- Botao e icone de adicionar do dashboard passam a levar para `/pesquisas`.

Tabela criada:
- `public.surveys`, com `company_id`, `title`, `description`, `status`, `created_at` e `updated_at`.

Regras de seguranca:
- RLS ativa em `public.surveys`.
- Select, insert e update permitidos apenas quando a pesquisa pertence a uma empresa cujo `owner_id` e o `auth.uid()`.
- Nao ha policy de delete para pesquisas; arquivamento e feito por update de status.
- Nenhuma service role key foi adicionada ao front-end.

Criterios de teste:
- Criar uma pesquisa e ver na listagem.
- Editar titulo, descricao e status.
- Arquivar uma pesquisa.
- Recarregar e confirmar persistencia dos dados.
- Entrar com uma segunda conta e confirmar que ela nao ve pesquisas da primeira.

Validacoes executadas:
- `npx tsc --noEmit`
- `npm run lint`

Pontos de atencao:
- O SQL de `supabase/surveys.sql` precisa ser aplicado no Supabase antes do teste funcional completo.
- `npm run build` foi executado, mas o ambiente bloqueou o acesso ao Google Fonts usado por `next/font`.

## Sprint 4.1 - Ajuste de UX do Dashboard

Status: implementada e pronta para validacao manual.

Objetivo:
- Fazer o dashboard reconhecer quando a empresa ja possui pesquisas e adaptar o conteudo exibido.

Entregas:
- Dashboard passa a buscar pesquisas da empresa logada.
- Usuario sem pesquisas continua vendo o estado vazio com `Criar primeira pesquisa`.
- Usuario com pesquisas ve CTA `Ver pesquisas`, resumo por status e ate 3 pesquisas recentes.
- Mantido aviso de que metricas reais dependem de respostas futuras.
- Placeholders especificos foram trocados por exemplos genericos.

Criterios de teste:
- Usuario sem pesquisa ve `Criar primeira pesquisa`.
- Usuario com pesquisa nao ve mais `Criar primeira pesquisa`.
- Usuario com pesquisa ve total, ativas, rascunhos e arquivadas.
- Botao do dashboard navega para `/pesquisas`.
- Recarregar o dashboard mantem o estado correto.

Validacoes executadas:
- `npx tsc --noEmit`
- `npm run lint`

Pontos de atencao:
- `npm run build` foi executado, mas o ambiente local bloqueou o acesso ao Google Fonts e a escrita em `.next/trace`.

## Sprint 4.2 - Responsividade, Navegacao e Refinamento de UX

Status: implementada e pronta para validacao manual.

Objetivo:
- Refinar a experiencia da aplicacao antes da Sprint 5, corrigindo navegacao, responsividade e elementos sem acao.

Correcoes realizadas:
- Menu lateral passa a abrir e fechar em telas menores, com overlay, clique fora para fechar e animacao suave.
- Logo da Kognis passa a navegar para `/dashboard`.
- Botao `Landing` foi substituido por `Inicio`, apontando para `/dashboard`.
- Campo de busca sem funcionalidade foi removido para evitar falsa interacao.
- Botao de notificacoes sem acao foi removido.
- Estados vazios nao exibem mais CTA quando nao ha acao real.
- Botoes e cards de pesquisas foram ajustados para melhor comportamento em mobile.
- Revisados placeholders e textos visiveis para remover dados ficticios especificos.

Criterios de validacao:
- Sidebar abre e fecha em mobile e tablet.
- Clique fora da sidebar fecha o menu.
- Logo e botao `Inicio` navegam para `/dashboard`.
- Nao ha busca falsa nem botoes sem acao.
- Dashboard, Pesquisas, Configuracoes e Onboarding permanecem responsivos.
- Nao ha dados ficticios especificos visiveis para o usuario final.

Validacoes executadas:
- `npx tsc --noEmit`
- `npm run lint`

Pontos de atencao:
- Nao havia servidor local respondendo em `localhost:3000` para validacao visual no navegador.
- `npm run build` foi executado, mas o ambiente local bloqueou o acesso ao Google Fonts usado por `next/font`.

## Versionamento Git

Status: configurado.

Padrao definido:
- `main` para versao estavel.
- `develop` para desenvolvimento diario.
- Commits no formato `[SPRINT] Descricao objetiva da entrega`.

Regra de fluxo:
- Toda sprint principal usa a branch de trabalho `develop`.
- Sub-sprints, como Sprint 4.1, 4.2 e 4.3, permanecem em `develop` e nao geram merge para `main`.
- O merge `develop` -> `main` acontece apenas quando a sprint principal estiver validada.
- Antes de iniciar uma nova sprint principal, validar a sprint anterior, atualizar a documentacao, realizar merge para `main` e criar o commit final da sprint.
- Ao iniciar uma nova sprint principal, registrar no log o objetivo e as entregas previstas.
- `main` nunca deve receber codigo nao testado, funcionalidades parciais, features experimentais ou correcoes temporarias.

Cuidados:
- `.env.local`, `.env`, `.next`, `node_modules`, `.vercel`, `dist`, `build`, `.vscode` e caches locais ficam fora do versionamento.
