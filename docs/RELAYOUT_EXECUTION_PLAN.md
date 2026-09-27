# Kognis Insights — Plano de Execução do Relayout

## Objetivo

Este documento define a estratégia de execução do relayout do Kognis Insights.

Seu objetivo é garantir que a evolução visual aconteça de forma controlada, previsível e sem comprometer a estabilidade do produto.

Este plano deve servir como referência para futuras sprints relacionadas ao Design System, UX e Interface.

---

# Premissas

O Kognis já possui um MVP funcional.

O objetivo deste ciclo não é criar funcionalidades.

O objetivo é alinhar a experiência visual ao novo posicionamento do produto.

O relayout deve preservar:

* funcionalidades existentes
* arquitetura atual
* banco de dados
* autenticação
* RLS
* regras de negócio
* integrações existentes

---

# Objetivos do Relayout

## Objetivo Principal

Transformar o Kognis de um dashboard operacional genérico em uma plataforma de inteligência para negócios presenciais.

---

## Objetivos Secundários

* Melhorar percepção de valor.
* Criar identidade visual própria.
* Aumentar consistência entre telas.
* Reduzir dívida visual.
* Criar base sólida para futuras funcionalidades.
* Melhorar experiência de navegação.
* Tornar o produto mais escalável visualmente.

---

# Regras Gerais

Durante todas as sprints deste ciclo:

Não alterar:

* Banco de dados
* Estrutura Supabase
* Auth
* RLS
* APIs
* Fluxos existentes
* Contratos de dados

Não criar:

* Funcionalidades novas
* Integrações novas
* Telas experimentais sem aprovação

Prioridade:

1. Consistência
2. Clareza
3. Performance
4. Estética

---

# Roadmap do Relayout

## R0 — Estratégia e Baseline

Status:
Planejamento

Objetivo:

Definir toda a fundação estratégica antes de alterar código.

Entregáveis:

* RELAYOUT_VISION.md
* RELAYOUT_EXECUTION_PLAN.md
* KOGNIS_DESIGN_LANGUAGE_V1.md

Critério de conclusão:

* Documentação criada.
* Paleta aprovada.
* Direção visual aprovada.
* Componentes mapeados.
* Riscos identificados.

---

## R1 — Design Foundation

Objetivo:

Criar a fundação visual do sistema.

Escopo:

* Tokens de cor
* Tipografia
* Espaçamentos
* Raios
* Sombras
* Estados
* Variáveis globais

Arquivos candidatos:

* globals.css
* tailwind.config.ts
* theme tokens

Entregáveis:

* Sistema de cores oficial
* Escala tipográfica
* Escala de espaçamento
* Escala de radii
* Escala de sombras

Critério de conclusão:

Todos os tokens definidos e centralizados.

---

## R1.5 — Component Audit

Objetivo:

Auditar os componentes atuais antes de iniciar mudanças estruturais.

Escopo:

Mapear todos os componentes do sistema.

Classificar:

* Reaproveitar
* Refatorar
* Substituir
* Remover

Componentes esperados:

* Button
* Card
* Input
* Label
* Sidebar
* Header
* Badge
* EmptyState
* Modal
* Select
* Textarea

Entregáveis:

Relatório de auditoria.

Critério de conclusão:

Todos os componentes classificados.

---

## R2 — Application Shell

Objetivo:

Reconstruir a estrutura visual global.

Escopo:

* Sidebar
* Header
* Containers
* Navegação
* Estrutura de página

Objetivo visual:

Criar uma base consistente para todas as telas.

Critério de conclusão:

Todas as páginas utilizando o mesmo shell visual.

---

## R3 — Customer Intelligence Experience

Objetivo:

Transformar a experiência principal do produto.

Observação:

Esta sprint não existe para criar gráficos bonitos.

Existe para materializar a proposta de valor do Kognis.

Pergunta principal:

"O que o usuário aprende sobre seus clientes ao abrir o sistema?"

Escopo:

* Dashboard principal
* Métricas estratégicas
* Cartões de insights
* Estados vazios inteligentes
* Hierarquia visual de dados

Regra:

Toda métrica precisa responder:

"Qual decisão de negócio isso ajuda a tomar?"

Critério de conclusão:

O dashboard deve comunicar inteligência, não apenas operação.

---

## R4 — Telas Operacionais

Objetivo:

Aplicar a nova linguagem visual nas áreas funcionais.

Escopo:

* Pesquisas
* Respostas
* Campanhas
* Onboarding
* Configurações

Importante:

Não alterar comportamento.

Somente experiência visual.

Critério de conclusão:

Consistência visual entre todas as áreas do sistema.

---

## R5 — Landing & Marketing

Objetivo:

Alinhar comunicação externa com a nova identidade.

Escopo:

* Hero principal
* Seções institucionais
* Casos de uso
* Benefícios
* Posicionamento

Objetivo:

A landing deve vender inteligência de clientes.

Não pesquisas.

Não QR Codes.

Critério de conclusão:

A narrativa da landing deve refletir a proposta de valor do produto.

---

# Processo de Aprovação

Cada sprint deverá passar pelas seguintes validações.

## Validação Técnica

Executar:

npm run lint

npx tsc --noEmit

build completo

---

## Validação Funcional

Verificar:

* Login
* Onboarding
* Criação de pesquisa
* Criação de perguntas
* QR Code
* Respostas públicas
* Exportação CSV

---

## Validação Visual

Verificar:

* Consistência
* Contraste
* Espaçamento
* Responsividade
* Hierarquia

---

# Gestão de Risco

## Alto Risco

* Troca de tema dark para light.
* Classes hardcoded.
* text-white espalhado.
* Inputs customizados.
* Cards customizados.

Mitigação:

Centralizar tokens antes de alterar páginas.

---

## Médio Risco

* Inconsistência entre telas.
* Componentes duplicados.
* Divergência de estilos.

Mitigação:

Criar componentes compartilhados.

---

## Baixo Risco

* Ajustes finos de copy.
* Ajustes visuais menores.

---

# Critério de Sucesso

O relayout será considerado bem-sucedido quando:

* O produto possuir identidade própria.
* O sistema transmitir inteligência e clareza.
* Todas as telas seguirem a mesma linguagem visual.
* O usuário perceber mais valor sem necessidade de novas funcionalidades.
* O Kognis deixar de parecer um dashboard genérico e passar a parecer uma plataforma de inteligência para negócios presenciais.

---

# Próxima Etapa

Após aprovação da R0:

Iniciar Sprint R1 — Design Foundation.

Nenhuma alteração visual significativa deve acontecer antes da conclusão da fundação do Design System.
