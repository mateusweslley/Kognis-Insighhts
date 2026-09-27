# Frontend Audit R0.5

# Kognis Insights — Auditoria de Front-end Antes da Sprint R1

## Objetivo

Este documento registra a auditoria de front-end da Sprint R0.5 do ciclo de relayout do Kognis Insights.

O objetivo é mapear o estado visual e estrutural atual do front-end antes da Sprint R1 — Design Foundation.

Esta auditoria não altera código, estilos, regras de negócio, banco de dados, autenticação, RLS ou rotas.

---

# Contexto

O Kognis está migrando de uma plataforma de pesquisas por QR Code para uma plataforma de inteligência para negócios presenciais.

O MVP atual já possui fluxo funcional para:

- autenticação;
- empresa;
- pesquisas;
- perguntas;
- QR Code;
- página pública;
- respostas;
- exportação CSV;
- campanhas;
- configurações.

O objetivo do relayout não é criar funcionalidades novas.

O objetivo é alinhar percepção, linguagem visual e estrutura de interface ao novo posicionamento do produto.

---

# Documentos de Referência

Esta auditoria considera como referência oficial:

- `RELAYOUT_VISION.md`;
- `RELAYOUT_EXECUTION_PLAN.md`;
- `KOGNIS_DESIGN_LANGUAGE_V1.md`.

Observação:

No momento da auditoria, esses documentos foram fornecidos como anexos e ainda não estavam versionados no workspace em `docs/`.

Recomendação:

Antes da Sprint R1, versionar os três documentos oficiais em `docs/`.

---

# Inventário de Páginas

## Rotas Públicas

### `/`

Landing atual do produto.

Status:

- funcional;
- visual ainda ancorado em QR Code;
- deverá ser redesenhada na R5 — Landing & Marketing.

### `/login`

Tela de login.

Status:

- funcional;
- usa `AuthCard`;
- visual depende dos primitives atuais.

### `/cadastro`

Tela de criação de conta.

Status:

- funcional;
- usa `AuthCard`;
- visual depende dos primitives atuais.

### `/participar/[surveyId]`

Página pública de resposta.

Status:

- funcional;
- possui `PublicPageShell` local dentro da própria rota;
- deve evoluir para componente compartilhado `PublicSurveyShell`.

---

## Rotas Autenticadas

### `/onboarding`

Cadastro inicial da empresa.

Status:

- funcional;
- usa `CompanyForm`;
- depende de `Card`, `Input`, `Label` e formulário customizado.

### `/dashboard`

Painel principal atual.

Status:

- funcional;
- ainda apresenta resumo operacional;
- deve ser transformado em Customer Intelligence Experience na R3.

### `/pesquisas`

Gestão de pesquisas.

Status:

- funcional;
- concentra criação, edição, templates, perguntas, QR Code e ações;
- alto risco visual por acoplamento em `SurveyManager`.

### `/pesquisas/[surveyId]/preview`

Preview administrativo da pesquisa.

Status:

- funcional;
- usa formulário público em modo preview;
- visual deve ser alinhado ao novo `PublicSurveyShell`.

### `/respostas`

Listagem de pesquisas para visualização de respostas.

Status:

- funcional;
- possui busca;
- visual ainda baseado em cards operacionais.

### `/respostas/[surveyId]`

Visualização operacional das respostas da pesquisa.

Status:

- funcional;
- inclui exportação CSV;
- possui modal local para detalhes;
- deve evoluir para `ModalShell` e `DataListItem`.

### `/campanhas`

Gestão de campanhas.

Status:

- funcional;
- visual de CRUD;
- deve ser redesenhada na R4.

### `/configuracoes`

Configurações da empresa.

Status:

- funcional;
- usa `CompanyForm`;
- deve ser redesenhada na R4.

---

# Inventário de Componentes

## UI Primitives

### `Button`

Arquivo:

- `src/components/ui/button.tsx`

Classificação:

- refatorar.

Motivo:

- estrutura boa;
- usa `class-variance-authority`;
- variantes atuais carregam identidade teal e dark;
- deve receber tokens roxos e variantes compatíveis com a nova linguagem.

### `Card`

Arquivo:

- `src/components/ui/card.tsx`

Classificação:

- refatorar.

Motivo:

- componente base importante;
- visual atual é dark/glass com bordas brancas e sombra pesada;
- deve evoluir para superfícies claras, suaves e premium.

### `Input`

Arquivo:

- `src/components/ui/input.tsx`

Classificação:

- refatorar.

Motivo:

- componente útil;
- estilo atual depende de fundo escuro, texto branco e borda branca translúcida;
- precisa ser tokenizado para light-first.

### `Label`

Arquivo:

- `src/components/ui/label.tsx`

Classificação:

- reaproveitar com ajuste.

Motivo:

- simples e funcional;
- usa `text-white`;
- precisa usar token semântico de texto.

---

## Layout

### `AppShell`

Arquivo:

- `src/components/layout/app-shell.tsx`

Classificação:

- reaproveitar.

Motivo:

- estrutura pequena;
- centraliza empresa atual;
- bom ponto de entrada para o shell autenticado.

### `AppShellClient`

Arquivo:

- `src/components/layout/app-shell-client.tsx`

Classificação:

- reaproveitar/refatorar visualmente.

Motivo:

- já controla sidebar responsiva;
- comportamento deve permanecer;
- layout deve ser refinado na R2.

### `Header`

Arquivo:

- `src/components/layout/header.tsx`

Classificação:

- refatorar.

Motivo:

- estrutura aproveitável;
- visual atual é escuro, com borda branca translúcida e background `kognis-cyber`;
- deve virar header claro, limpo e mais premium.

### `Sidebar`

Arquivo:

- `src/components/layout/sidebar.tsx`

Classificação:

- refatorar.

Motivo:

- comportamento e navegação são úteis;
- visual atual depende de dark, teal e background escuro;
- deve ser redesenhada na R2.

### `LogoutButton`

Arquivo:

- `src/components/layout/logout-button.tsx`

Classificação:

- reaproveitar.

Motivo:

- comportamento isolado;
- herdará nova aparência de `Button`.

---

## Marketing e Marca

### `BrandMark`

Arquivo:

- `src/components/marketing/brand-mark.tsx`

Classificação:

- refatorar/substituir visualmente.

Motivo:

- centraliza identidade visual;
- usa `kognis-deep`, `kognis-teal` e elementos gráficos atuais;
- precisa refletir a nova identidade roxa, clara e premium.

### `LandingHero`

Arquivo:

- `src/components/marketing/landing-hero.tsx`

Classificação:

- substituir na R5.

Motivo:

- funcional;
- mas ainda posiciona o produto em torno de QR Code;
- novo posicionamento exige narrativa de inteligência.

### `AuthCard`

Arquivo:

- `src/components/marketing/auth-card.tsx`

Classificação:

- refatorar.

Motivo:

- comportamento reaproveitável;
- visual deve acompanhar novo design system.

---

## Dashboard

### `DashboardOverview`

Arquivo:

- `src/components/dashboard/dashboard-overview.tsx`

Classificação:

- substituir/refatorar fortemente na R3.

Motivo:

- hoje apresenta métricas operacionais;
- precisa evoluir para Customer Intelligence Experience;
- deve responder o que o usuário aprende sobre seus clientes.

### `EmptyState`

Arquivo:

- `src/components/dashboard/empty-state.tsx`

Classificação:

- reaproveitar/refatorar.

Motivo:

- conceito é válido;
- deve ganhar linguagem mais orientada a aprendizado e próximo passo;
- visual atual depende de teal/dark.

### `PanelPage`

Arquivo:

- `src/components/dashboard/panel-page.tsx`

Classificação:

- remover ou substituir.

Motivo:

- componente genérico de página;
- tende a ser substituído por `PageShell` e `PageHeader`;
- aparentemente não é peça central das telas atuais.

---

## Pesquisas

### `SurveyManager`

Arquivo:

- `src/components/surveys/survey-manager.tsx`

Classificação:

- refatorar.

Motivo:

- componente grande;
- mistura lista, formulário, templates, QR Code, perguntas, estados e ações;
- alto risco para relayout direto;
- deve ser dividido em subcomponentes na R4.

### `QuestionBuilder`

Arquivo:

- `src/components/surveys/question-builder.tsx`

Classificação:

- refatorar.

Motivo:

- componente grande;
- possui formulário, lista, reorder, edição e exclusão;
- usa selects/textareas hardcoded;
- deve ser dividido antes de repaint profundo.

### `SurveyQrCode`

Arquivo:

- `src/components/surveys/survey-qr-code.tsx`

Classificação:

- reaproveitar/refatorar.

Motivo:

- funcionalidade boa e isolada;
- visual deve seguir nova linguagem;
- nome do PNG ainda usa ID da pesquisa, mas isso não é escopo da R1.

---

## Respostas

### `ResponsesPanel`

Arquivo:

- `src/components/responses/responses-panel.tsx`

Classificação:

- refatorar.

Motivo:

- fluxo funcional;
- usa cards operacionais;
- deve evoluir para listagem mais orientada a entendimento.

### `SurveyResponsesPanel`

Arquivo:

- `src/components/responses/survey-responses-panel.tsx`

Classificação:

- refatorar.

Motivo:

- inclui lista, exportação CSV e modal local;
- deve extrair `DataListItem` e `ModalShell`.

### `DynamicPublicResponseForm`

Arquivo:

- `src/components/responses/dynamic-public-response-form.tsx`

Classificação:

- refatorar.

Motivo:

- funcional;
- deve herdar `FormField`, `TextareaField`, `SelectField` e `PublicSurveyShell`;
- atenção para não alterar persistência.

### `PublicResponseForm`

Arquivo:

- `src/components/responses/public-response-form.tsx`

Classificação:

- refatorar.

Motivo:

- fluxo legado;
- visual deve acompanhar a página pública;
- não deve ser removido enquanto ainda houver compatibilidade legada.

---

## Campanhas

### `CampaignManager`

Arquivo:

- `src/components/campaigns/campaign-manager.tsx`

Classificação:

- refatorar.

Motivo:

- funcional;
- visual de CRUD;
- deve ser redesenhado na R4;
- não deve ganhar protagonismo indevido.

---

## Empresa

### `CompanyForm`

Arquivo:

- `src/components/company/company-form.tsx`

Classificação:

- refatorar.

Motivo:

- funcional;
- usa select customizado hardcoded;
- deve migrar para primitives de formulário.

---

# Componentes Duplicados ou Implícitos

## Select

Ocorrências:

- `src/components/company/company-form.tsx`;
- `src/components/campaigns/campaign-manager.tsx`;
- `src/components/surveys/survey-manager.tsx`;
- `src/components/surveys/question-builder.tsx`;
- `src/components/responses/public-response-form.tsx`.

Problema:

- estilo duplicado;
- difícil migrar para light-first;
- risco alto de inconsistência.

Recomendação:

- criar `SelectField` ou `Select`.

## Textarea

Ocorrências:

- `src/components/campaigns/campaign-manager.tsx`;
- `src/components/surveys/survey-manager.tsx`;
- `src/components/surveys/question-builder.tsx`;
- `src/components/responses/public-response-form.tsx`;
- `src/components/responses/dynamic-public-response-form.tsx`.

Problema:

- estilo duplicado;
- hardcoded para tema escuro.

Recomendação:

- criar `TextareaField` ou `Textarea`.

## Feedback Inline

Ocorrências:

- pesquisas;
- campanhas;
- perguntas;
- empresa;
- autenticação;
- respostas;
- formulário público.

Problema:

- sucesso, erro e aviso são repetidos manualmente;
- usa classes visuais hardcoded.

Recomendação:

- criar `FeedbackBanner`.

## Status Badge

Ocorrências:

- pesquisas;
- campanhas;
- dashboard;
- QR Code;
- preview.

Problema:

- status é desenhado por tela;
- cores e pesos variam.

Recomendação:

- criar `StatusBadge`.

## Modal

Ocorrência:

- `SurveyResponsesPanel`.

Problema:

- modal local com layout próprio.

Recomendação:

- criar `ModalShell`.

## Public Shell

Ocorrência:

- `/participar/[surveyId]`.

Problema:

- `PublicPageShell` local dentro da rota.

Recomendação:

- criar `PublicSurveyShell`.

---

# Dívida Visual Identificada

## Alta Prioridade

- Tema global escuro.
- `className="dark"` no layout raiz.
- Teal como cor principal.
- Muitos `text-white` espalhados.
- Muitos `border-white/10`.
- Muitos backgrounds translúcidos `bg-white/[...]`.
- Uso recorrente de `bg-kognis-cyber`.
- Botões com glow teal.
- Cards dark/glass.
- Fonte remota via Google Fonts.
- Landing ainda posicionada em QR Code.

## Média Prioridade

- Formulários densos.
- Listagens com visual de CRUD.
- Page headers duplicados.
- Empty states ainda operacionais.
- Status badges inconsistentes.
- Feedback visual duplicado.
- Componentes grandes e acoplados.

## Baixa Prioridade

- Pequenos ajustes de copy remanescentes.
- Refinamentos mobile finos.
- Organização visual de ícones.

---

# Cores Utilizadas Atualmente

## Tokens Globais

Definidos em `src/app/globals.css`:

- `--background`: azul escuro;
- `--foreground`: branco;
- `--card`: azul escuro;
- `--primary`: teal;
- `--secondary`: azul escuro;
- `--muted`: azul escuro;
- `--accent`: teal;
- `--border`: azul/cinza escuro;
- `--ring`: teal.

## Tokens Tailwind Kognis

Definidos em `tailwind.config.ts`:

- `kognis.cyber`: `#07122E`;
- `kognis.deep`: `#0B1739`;
- `kognis.teal`: `#12D6C5`;
- `kognis.mist`: `#E5E7EB`.

## Diagnóstico

A identidade atual é dark blue + teal.

Essa direção conflita com a linguagem aprovada:

- base branca;
- contraste grafite/preto;
- roxo como identidade principal;
- feedback colorido apenas para estados.

---

# Classes Hardcoded Críticas

Classes recorrentes que dificultam R1:

- `text-white`;
- `border-white/10`;
- `bg-white/[0.035]`;
- `bg-white/[0.045]`;
- `bg-white/[0.055]`;
- `bg-kognis-cyber`;
- `bg-kognis-teal`;
- `text-kognis-teal`;
- `border-kognis-teal`;
- `accent-kognis-teal`;
- `shadow-[...]`;
- `backdrop-blur`;
- `bg-red-500/10`;
- `text-red-100`;
- `bg-yellow-400/10`;
- `text-yellow-100`.

Recomendação:

R1 deve substituir dependência visual por tokens semânticos antes de redesenhar telas finais.

---

# Dependências Visuais

## Dependências de UI

- Tailwind CSS;
- shadcn-style primitives;
- Radix Label;
- Lucide React;
- class-variance-authority;
- clsx;
- tailwind-merge.

## Dependências de Visualização

- Recharts instalado, ainda útil para futuras visualizações da R3.

## Dependências de Canal Visual

- `qrcode.react` usado no QR Code.

## Ponto de Atenção

`next/font/google` usa Inter remotamente.

Isso já causou falhas de build em ambiente local por bloqueio de acesso ao Google Fonts.

Recomendação:

Na R1, decidir entre:

- manter Inter com fallback e aceitar risco;
- migrar para fonte local;
- usar Geist local se os arquivos forem adicionados ao repositório.

---

# Arquivos Impactados na R1

R1 deve tocar somente a fundação visual.

## Arquivos principais

- `src/app/globals.css`;
- `tailwind.config.ts`;
- `src/app/layout.tsx`;
- `components.json`;
- `src/components/ui/button.tsx`;
- `src/components/ui/card.tsx`;
- `src/components/ui/input.tsx`;
- `src/components/ui/label.tsx`.

## Arquivos que podem ser criados

- `src/components/ui/textarea.tsx`;
- `src/components/ui/select.tsx`;
- `src/components/ui/badge.tsx`;
- `src/components/ui/feedback-banner.tsx`;
- `src/components/ui/status-badge.tsx`;
- `src/components/layout/page-shell.tsx`;
- `src/components/layout/page-header.tsx`;

## Arquivos que não devem ser redesenhados na R1

- `src/components/dashboard/dashboard-overview.tsx`;
- `src/components/marketing/landing-hero.tsx`;
- `src/components/surveys/survey-manager.tsx`;
- `src/components/surveys/question-builder.tsx`;
- `src/components/responses/survey-responses-panel.tsx`;
- `src/components/campaigns/campaign-manager.tsx`.

Esses arquivos devem ser tratados em sprints posteriores.

---

# Estimativa de Risco

## R1 — Design Foundation

Risco:

- alto.

Motivo:

- alterar tokens e primitives impacta todo o sistema.
- migração para base clara pode quebrar contraste.
- muitos componentes usam `text-white` e classes dark hardcoded.

Mitigação:

- aplicar tokens compatíveis temporariamente;
- evitar redesenho de telas finais;
- validar visual em rotas principais;
- rodar typecheck, lint e build quando possível.

## R2 — Application Shell

Risco:

- médio.

Motivo:

- Header e Sidebar são centrais, mas isolados.

Mitigação:

- preservar comportamento responsivo existente.

## R3 — Customer Intelligence Experience

Risco:

- médio/alto.

Motivo:

- risco de criar funcionalidades novas sem querer.

Mitigação:

- trabalhar apenas com dados já disponíveis.
- toda métrica deve responder à regra de ouro.

## R4 — Telas Operacionais

Risco:

- alto.

Motivo:

- componentes grandes e acoplados.

Mitigação:

- quebrar em subcomponentes antes de repaint profundo.

## R5 — Landing & Marketing

Risco:

- médio.

Motivo:

- grande impacto de percepção, baixo impacto funcional.

Mitigação:

- não copiar referências;
- usar posicionamento aprovado.

---

# Recomendação Para Iniciar R1

A Sprint R1 pode ser iniciada após aprovação desta auditoria, com as seguintes condições:

1. Versionar os documentos oficiais em `docs/`.
2. Aprovar tokens definitivos de cor, tipografia, radius, sombra e espaçamento.
3. Definir estratégia para fonte local ou manutenção controlada de `next/font/google`.
4. Definir se a migração para light-first será imediata ou em transição.
5. Limitar a R1 a foundations e primitives.
6. Não redesenhar dashboard, landing ou telas operacionais durante R1.

---

# Conclusão

O front-end atual está funcional, organizado e suficiente para o MVP.

A dívida principal não é funcional.

A dívida principal é visual e semântica.

Hoje a interface ainda depende de:

- tema escuro;
- teal como identidade;
- cards translúcidos;
- classes hardcoded;
- componentes grandes com layout interno próprio;
- narrativa centrada em QR Code e operação.

Para que o Kognis evolua como plataforma de inteligência para negócios presenciais, a R1 deve criar uma base visual semântica antes de redesenhar telas.

Recomendação final:

Iniciar R1 apenas pela fundação visual.

Não redesenhar telas finais antes de estabilizar tokens e primitives.
