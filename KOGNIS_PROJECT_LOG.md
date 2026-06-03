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

## Versionamento Git

Status: configurado.

Padrao definido:
- `main` para versao estavel.
- `develop` para desenvolvimento diario.
- Commits no formato `[SPRINT] Descricao objetiva da entrega`.

Cuidados:
- `.env.local`, `.env`, `.next`, `node_modules`, `.vercel`, `dist`, `build`, `.vscode` e caches locais ficam fora do versionamento.
