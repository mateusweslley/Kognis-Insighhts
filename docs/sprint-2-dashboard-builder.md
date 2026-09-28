# Documento Técnico — Sprint 2

## Kognis Insights — Dashboard Configurável e Templates

**Status:** Proposta técnica para implementação
**Objetivo:** transformar o Dashboard do Kognis em uma camada configurável sobre o Metrics Engine, preparando o produto para dashboards personalizados, templates verticais e futuro marketplace.

---

# 1. Visão da arquitetura

A Sprint 2 deve estabelecer esta separação:

```text
                         RESPOSTAS
                             │
                             ▼
                    ┌─────────────────┐
                    │  Metrics Engine │
                    │                 │
                    │ calcula métricas│
                    └────────┬────────┘
                             │
                             ▼
                       Metric Result
                             │
                             ▼
                    ┌─────────────────┐
                    │ Dashboard       │
                    │ Widget          │
                    └────────┬────────┘
                             │
                             ▼
                    Visualization
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
            KPI           Gráfico         Tabela
```

A regra arquitetural principal é:

> **O Metrics Engine calcula. O Widget interpreta. O Dashboard organiza. O Template empacota.**

O Dashboard **não deve implementar cálculos próprios**.

---

# 2. Objetivos da Sprint 2

### Obrigatórios

Implementar:

* criação de dashboards;
* edição de dashboards;
* exclusão de dashboards;
* listagem de dashboards;
* criação de widgets;
* edição de widgets;
* exclusão de widgets;
* reordenação de widgets;
* associação de widget com pesquisa/pergunta;
* escolha da métrica;
* escolha da visualização;
* primeiros renderizadores;
* templates internos;
* persistência no Supabase;
* RLS;
* testes.

### Fora do escopo desta Sprint

Não implementar:

* marketplace;
* pagamentos;
* templates de terceiros;
* drag-and-drop avançado;
* redimensionamento livre;
* compartilhamento público de dashboards;
* colaboração em tempo real;
* IA gerando dashboards;
* integrações externas;
* dezenas de visualizações.

A arquitetura deve **permitir** essas evoluções, mas não implementá-las agora.

---

# 3. Conceitos

## 3.1 Dashboard

É o painel criado pelo usuário/empresa.

Exemplo:

> Dashboard de Satisfação

Um dashboard possui vários widgets.

```text
Dashboard
 ├── Widget 1
 ├── Widget 2
 ├── Widget 3
 └── Widget 4
```

---

# 4. Modelo `Dashboard`

Criar:

```ts
type Dashboard = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  template_id: string | null;
  created_at: string;
  updated_at: string;
};
```

### Regras

* `company_id` obrigatório.
* `name` obrigatório.
* `description` opcional.
* `template_id` pode ser `null`.
* Dashboard pertence a uma empresa.
* Usuário só pode acessar dashboards da empresa à qual possui acesso conforme as regras atuais do projeto.

---

# 5. Modelo `DashboardWidget`

Um widget representa **uma análise configurada**.

```ts
type DashboardWidget = {
  id: string;
  dashboard_id: string;

  title: string;

  survey_id: string | null;
  question_id: string | null;

  metric: DashboardMetric;
  visualization: DashboardVisualization;

  config: Record<string, unknown>;

  position: number;
  width: number;
  height: number;

  created_at: string;
  updated_at: string;
};
```

---

# 6. Métricas iniciais

Criar um contrato fechado inicialmente:

```ts
type DashboardMetric =
  | "response_count"
  | "average"
  | "distribution"
  | "trend"
  | "nps"
  | "top_topics";
```

### `response_count`

Quantidade de respostas.

### `average`

Média numérica/rating.

### `distribution`

Distribuição das respostas.

### `trend`

Evolução ao longo do tempo.

### `nps`

Cálculo específico de NPS.

### `top_topics`

Agrupamento por tópicos.

---

# 7. Visualizações iniciais

```ts
type DashboardVisualization =
  | "kpi"
  | "bar"
  | "pie"
  | "line"
  | "table";
```

A visualização **não deve determinar a métrica**.

Exemplo válido:

```text
distribution → pie
distribution → bar
distribution → table
```

Também:

```text
average → kpi
average → bar
average → line
```

Isso é proposital.

---

# 8. Separação entre métrica e visualização

Não implementar:

```ts
type Widget = "pie_distribution";
```

Implementar:

```text
metric = distribution
visualization = pie
```

Assim o mesmo resultado do Metrics Engine pode ser apresentado de diferentes formas.

---

# 9. Configuração do Widget

O campo:

```ts
config: Record<string, unknown>
```

será utilizado para configurações específicas da apresentação.

Exemplo:

```json
{
  "showLegend": true,
  "showPercentages": true,
  "period": "30d"
}
```

Não colocar em `config` informações estruturais que merecem coluna própria.

Por exemplo:

```text
survey_id
question_id
metric
visualization
```

devem permanecer como campos próprios.

---

# 10. Layout

Cada widget terá inicialmente:

```ts
position: number;
width: number;
height: number;
```

Nesta Sprint:

* `position` controla a ordem;
* `width` e `height` permitem preparar o layout;
* não implementar redimensionamento livre;
* não implementar drag-and-drop.

A interface pode inicialmente trabalhar com tamanhos pré-definidos.

Exemplo:

```text
width = 1
height = 1
```

ou:

```text
width = 2
height = 1
```

---

# 11. Banco de dados

Criar três entidades.

## `dashboards`

```sql
id
company_id
name
description
template_id
created_at
updated_at
```

---

## `dashboard_widgets`

```sql
id
dashboard_id
title
survey_id
question_id
metric
visualization
config
position
width
height
created_at
updated_at
```

---

## `dashboard_templates`

```sql
id
name
description
category
type
config
is_active
created_at
updated_at
```

---

# 12. Templates

O template representa uma **receita de dashboard**.

Exemplo:

```text
Template NPS
│
├── KPI → NPS
├── KPI → Promotores
├── KPI → Neutros
├── KPI → Detratores
├── Line → Evolução NPS
├── Bar → Distribuição
└── Table → Comentários
```

O template não precisa representar um dashboard criado pelo usuário.

Ele serve para dizer:

> "Ao escolher esse modelo, crie este conjunto inicial de widgets."

---

# 13. Templates iniciais

Criar quatro templates internos:

### 1. NPS

Categoria:

`customer_experience`

Componentes:

* NPS atual;
* promotores;
* neutros;
* detratores;
* evolução;
* distribuição;
* comentários.

---

### 2. Satisfação

Componentes:

* satisfação média;
* distribuição das notas;
* evolução;
* respostas;
* comentários.

---

### 3. Conhecer clientes

Componentes voltados a:

* perfil;
* preferências;
* comportamento;
* intenção de compra;
* satisfação.

---

### 4. Personalizado

Dashboard vazio.

Usuário adiciona seus próprios widgets.

---

# 14. Fluxo de criação

Ao entrar em Dashboard:

```text
Criar dashboard
```

Mostrar:

```text
Começar com um modelo

[ NPS ]
[ Satisfação ]
[ Conhecer clientes ]
[ Personalizado ]
```

Se escolher Personalizado:

```text
Dashboard vazio
```

Se escolher NPS:

```text
Dashboard
+ widgets definidos pelo template
```

---

# 15. Fluxo de criação de Widget

O usuário deverá passar por:

### Etapa 1 — Fonte

```text
Pesquisa
[ Pesquisa de satisfação ▼ ]
```

### Etapa 2 — Pergunta

```text
Pergunta
[ Como você avalia nosso atendimento? ▼ ]
```

### Etapa 3 — Métrica

```text
Métrica
[ Média ▼ ]
```

### Etapa 4 — Visualização

```text
Visualização
[ KPI ▼ ]
```

### Etapa 5 — Configuração

```text
Título
[ Satisfação média ]
```

### Resultado

```text
[Adicionar ao dashboard]
```

---

# 16. Compatibilidade entre pergunta, métrica e visualização

O frontend deve evitar combinações inválidas.

Exemplo:

Uma pergunta `short_text` não deve oferecer:

```text
Média
```

Uma pergunta `rating` pode oferecer:

```text
Média
Distribuição
Tendência
```

Uma `single_choice` pode oferecer:

```text
Distribuição
```

Uma pergunta com `topic` pode alimentar:

```text
top_topics
```

Essa regra deve ficar centralizada em uma função/serviço, não espalhada pelos componentes.

Exemplo:

```ts
getAvailableMetrics(question)
```

---

# 17. Metrics Engine

O Engine existente permanece como camada pura.

Não adicionar:

```text
React
Supabase
Dashboard
Chart
```

ao Metrics Engine.

O fluxo será:

```text
Supabase
   ↓
dashboard-metrics
   ↓
Metrics Engine
   ↓
MetricResult
   ↓
Dashboard Widget
   ↓
Renderer
```

---

# 18. Renderer

Criar uma camada responsável por apresentar os resultados.

Exemplo conceitual:

```text
WidgetRenderer
│
├── KpiRenderer
├── BarChartRenderer
├── PieChartRenderer
├── LineChartRenderer
└── TableRenderer
```

O renderer recebe o resultado da métrica.

Ele não deve recalcular os dados.

---

# 19. Exemplo completo

Usuário configura:

```text
Pesquisa:
Pesquisa de satisfação

Pergunta:
Você compraria novamente?

Métrica:
distribution

Visualização:
pie
```

Fluxo:

```text
Respostas
    ↓
Metrics Engine
    ↓
{
  labels: ["Sim", "Não", "Talvez"],
  values: [72, 12, 16]
}
    ↓
Pie Renderer
    ↓
Gráfico
```

---

# 20. RLS

As tabelas precisam respeitar isolamento por empresa.

Regra fundamental:

> Uma empresa não pode ler, criar, editar ou excluir dashboards pertencentes a outra empresa.

A mesma regra deve ser aplicada aos widgets através da relação com `dashboards`.

Templates internos podem possuir política diferente, pois serão recursos globais do Kognis.

**Não alterar RLS existente de surveys/responses sem necessidade.**

---

# 21. CRUD

Implementar camada própria:

```text
src/lib/dashboards.ts
```

Responsabilidades:

```ts
getDashboards()
getDashboard()
createDashboard()
updateDashboard()
deleteDashboard()
```

E:

```text
src/lib/dashboard-widgets.ts
```

Com:

```ts
getDashboardWidgets()
createDashboardWidget()
updateDashboardWidget()
deleteDashboardWidget()
reorderDashboardWidgets()
```

---

# 22. Templates

Criar:

```text
src/lib/dashboard-templates.ts
```

Responsabilidades:

```ts
getDashboardTemplates()
getDashboardTemplate()
createDashboardFromTemplate()
```

A criação a partir de template deve:

1. criar o Dashboard;
2. interpretar a configuração do template;
3. criar os widgets;
4. associar os widgets ao dashboard.

---

# 23. UI inicial

Criar uma página:

```text
/dashboard
```

ou adaptar a existente somente quando necessário.

A tela deverá apresentar:

```text
Dashboard
────────────────────────────

[ + Novo dashboard ]

Meus dashboards

┌──────────────────┐
│ Satisfação       │
│ 6 análises       │
│ [Abrir]          │
└──────────────────┘

┌──────────────────┐
│ NPS              │
│ 7 análises       │
│ [Abrir]          │
└──────────────────┘
```

Não alterar desnecessariamente outras áreas existentes.

---

# 24. Tela do Dashboard

Estrutura inicial:

```text
┌─────────────────────────────────────────────┐
│ Dashboard de Satisfação                     │
│                                             │
│                         [+ Adicionar análise]│
├─────────────────────────────────────────────┤
│                                             │
│  ┌────────────┐ ┌────────────────────────┐  │
│  │ NPS        │ │ Satisfação             │  │
│  │    72      │ │ █████████████          │  │
│  └────────────┘ └────────────────────────┘  │
│                                             │
│  ┌─────────────────────────────────────────┐ │
│  │ Evolução                                │ │
│  │             ╱╲                         │ │
│  │       ╱╲___╱  ╲                         │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

# 25. Primeira versão do gerenciamento de widgets

Cada widget deverá possuir:

```text
⋮
```

Com:

* Editar;
* Mover para cima;
* Mover para baixo;
* Excluir.

**Drag-and-drop fica para uma sprint posterior.**

---

# 26. Preparação para futuro Marketplace

Não implementar marketplace agora.

Mas `dashboard_templates` deve permitir evolução futura para:

```text
owner_type:
- kognis
- company
- creator
```

e futuramente:

```text
visibility:
- private
- shared
- marketplace
```

Também deixar espaço para:

```text
price
category
version
```

Porém **não criar lógica de pagamento nesta Sprint**.

---

# 27. Preparação para templates de agência

A arquitetura deverá permitir futuramente:

```text
Agência
   │
   ├── Template Restaurante
   ├── Template Academia
   └── Template Varejo
             │
             ▼
        Cliente A
        Cliente B
        Cliente C
```

Isso será possível sem alterar a estrutura fundamental de Dashboard/Widget.

---

# 28. Testes obrigatórios

Adicionar testes para:

### Dashboard

* criar;
* buscar;
* atualizar;
* excluir;
* isolamento por empresa.

### Widget

* criar;
* atualizar;
* excluir;
* ordenar;
* associação correta com pesquisa/pergunta.

### Compatibilidade

Testar:

```text
rating → average
rating → distribution
rating → trend

single_choice → distribution

short_text → média inválida

topic → top_topics
```

### Templates

Testar:

```text
template → dashboard
dashboard → widgets
```

---

# 29. Critérios de aceite

A Sprint 2 só será considerada concluída quando:

### Dashboard

* [ ] usuário consegue criar dashboard;
* [ ] dashboard aparece na listagem;
* [ ] dashboard pode ser aberto;
* [ ] dashboard pode ser editado;
* [ ] dashboard pode ser excluído.

### Widgets

* [ ] usuário consegue adicionar análise;
* [ ] consegue escolher pesquisa;
* [ ] consegue escolher pergunta;
* [ ] consegue escolher métrica;
* [ ] consegue escolher visualização;
* [ ] widget é persistido;
* [ ] widget aparece após reload;
* [ ] widget pode ser editado;
* [ ] widget pode ser excluído;
* [ ] widgets podem ser reordenados.

### Visualizações

* [ ] KPI;
* [ ] barra;
* [ ] pizza;
* [ ] linha;
* [ ] tabela.

### Templates

* [ ] NPS;
* [ ] Satisfação;
* [ ] Conhecer clientes;
* [ ] Personalizado.

### Segurança

* [ ] RLS validada;
* [ ] empresa A não acessa dashboard da empresa B.

### Qualidade

* [ ] `tsc` sem erros;
* [ ] ESLint sem erros;
* [ ] Vitest passando;
* [ ] nenhuma regressão nas pesquisas;
* [ ] nenhuma alteração desnecessária em respostas públicas;
* [ ] nenhuma alteração desnecessária em autenticação.

---

# 30. Ordem de implementação

Eu **não deixaria o Codex implementar tudo de uma vez**.

A ordem será:

```text
FASE 1
Contratos TypeScript
        ↓
FASE 2
Migration + RLS
        ↓
FASE 3
CRUD Dashboard
        ↓
FASE 4
CRUD Widget
        ↓
FASE 5
Dashboard MVP
        ↓
FASE 6
Renderers
        ↓
FASE 7
Templates
        ↓
FASE 8
Testes
        ↓
FASE 9
Validação completa
```

Isso reduz bastante a chance de ele criar uma arquitetura diferente da planejada.

---

# 31. Regra de ouro da Sprint 2

**Não transformar o dashboard em um segundo Metrics Engine.**

Se um cálculo já existe em:

```text
src/lib/metrics/
```

o Dashboard deve reutilizá-lo.

Não criar:

```text
calculateAverage()
calculateDistribution()
calculateTrend()
```

novamente dentro de:

```text
dashboard.tsx
widget.tsx
chart.tsx
```

A única responsabilidade do Dashboard é **orquestrar e apresentar**.

---

# 32. Visão futura

A arquitetura resultante deverá permitir chegar naturalmente a:

```text
                    KOGNIS INSIGHTS
                           │
          ┌────────────────┼────────────────┐
          │                │                │
       Pesquisas        Metrics          Dashboards
          │              Engine              │
          │                │                 │
          │                │          ┌──────┴──────┐
          │                │          │             │
          │                │       Livres       Templates
          │                │                         │
          │                │                    ┌────┴────┐
          │                │                    │         │
          │                │                 Kognis   Parceiros
          │                │                              │
          └────────────────┴──────────────────────────────┘
                                             │
                                      Marketplace
```
