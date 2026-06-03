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

## Versionamento Git

Status: configurado.

Padrao definido:
- `main` para versao estavel.
- `develop` para desenvolvimento diario.
- Commits no formato `[SPRINT] Descricao objetiva da entrega`.

Cuidados:
- `.env.local`, `.env`, `.next`, `node_modules`, `.vercel`, `dist`, `build`, `.vscode` e caches locais ficam fora do versionamento.
