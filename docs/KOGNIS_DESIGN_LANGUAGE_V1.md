# Kognis Design Language V1

## Objetivo

Este documento define a linguagem visual oficial do Kognis Insights.

Seu propósito é garantir consistência visual, previsibilidade e escalabilidade durante a evolução do produto.

Toda nova tela, componente ou funcionalidade deve seguir estas diretrizes.

Em caso de conflito entre preferência pessoal e este documento, este documento prevalece.

---

# Identidade da Marca

## O que o Kognis deve transmitir

O Kognis é uma plataforma de inteligência para negócios presenciais.

A identidade visual deve transmitir:

* Inteligência
* Clareza
* Confiança
* Sofisticação
* Modernidade
* Precisão
* Organização

---

## O que o Kognis não deve transmitir

Evitar aparência de:

* ERP tradicional
* CRM genérico
* Sistema legado
* Dashboard administrativo comum
* Template SaaS reutilizado
* Produto excessivamente tecnológico ou complexo

---

# Personalidade Visual

Se o Kognis fosse uma pessoa:

Seria alguém:

* Inteligente
* Organizado
* Consultivo
* Objetivo
* Confiável

Não seria:

* Chamativo
* Exagerado
* Barulhento
* Excessivamente corporativo

---

# Filosofia de Interface

## Menos operação

Menos foco em:

* cadastros
* formulários
* configurações

---

## Mais entendimento

Mais foco em:

* contexto
* sinais
* descobertas
* tomada de decisão

---

## Regra Principal

A interface deve ajudar o usuário a entender algo.

Não apenas visualizar dados.

---

# Sistema de Cores

## Cor Principal da Marca

Brand Purple

Função:

* identidade visual
* CTAs principais
* elementos de destaque
* navegação ativa

---

## Hierarquia de Cores

### Brand

Roxo principal

Uso:

* botões primários
* links importantes
* estados ativos
* destaques

---

### Neutral

Cinzas e grafites

Uso:

* texto
* bordas
* superfícies
* containers

---

### Feedback

Verde

Apenas:

* sucesso
* confirmação

---

Amarelo

Apenas:

* atenção
* aviso

---

Vermelho

Apenas:

* erro
* exclusão
* falha

---

## Regra

Feedback nunca deve competir com a identidade visual.

A identidade do produto é roxa.

---

# Tokens de Cor

## Background

```txt
--background
```

Plano de fundo principal.

---

```txt
--background-muted
```

Áreas secundárias.

---

## Surface

```txt
--surface
```

Cards e containers.

---

```txt
--surface-elevated
```

Modais e áreas destacadas.

---

## Text

```txt
--text-primary
```

Texto principal.

---

```txt
--text-secondary
```

Texto auxiliar.

---

```txt
--text-muted
```

Legendas.

---

## Border

```txt
--border
```

Borda padrão.

---

```txt
--border-strong
```

Borda de destaque.

---

## Brand

```txt
--brand
```

---

```txt
--brand-soft
```

---

```txt
--brand-foreground
```

---

## States

```txt
--success
```

```txt
--warning
```

```txt
--danger
```

```txt
--info
```

---

# Tipografia

## Direção

Tipografia simples.

Sem aparência corporativa pesada.

Sem aparência futurista exagerada.

---

## Fonte Principal

Fonte Sans moderna.

Preferência:

* Geist
* Inter

Escolher apenas uma.

---

## Hierarquia

### Display

Hero e títulos principais.

---

### Page Title

Título de páginas.

---

### Section Title

Título de blocos.

---

### Card Title

Título de cards.

---

### Body

Texto padrão.

---

### Caption

Textos auxiliares.

---

# Pesos

Regular

Medium

Semibold

Evitar excesso de Bold.

---

# Espaçamento

## Filosofia

Mais espaço.

Menos densidade.

Melhor leitura.

---

## Tokens

```txt
--space-xs
```

```txt
--space-sm
```

```txt
--space-md
```

```txt
--space-lg
```

```txt
--space-xl
```

```txt
--space-2xl
```

---

## Regra

Evitar telas comprimidas.

Evitar muitos elementos por linha.

Priorizar leitura confortável.

---

# Radius

## Filosofia

Suave.

Moderno.

Premium.

---

Tokens:

```txt
--radius-sm
```

```txt
--radius-md
```

```txt
--radius-lg
```

```txt
--radius-pill
```

---

# Sombras

## Filosofia

Sutil.

Elegante.

Discreta.

---

Tokens:

```txt
--shadow-subtle
```

```txt
--shadow-card
```

```txt
--shadow-floating
```

---

Regra:

Sombras não devem chamar atenção.

Devem apenas ajudar na separação visual.

---

# Layout

## Estrutura

Toda página deve seguir:

```txt
PageShell

↓
PageHeader

↓
Sections

↓
Cards / Conteúdo
```

---

## Containers

Largura controlada.

Boa respiração lateral.

Nada de conteúdo encostado nas bordas.

---

# Componentes Base

## Estruturais

* PageShell
* PageHeader
* SectionHeader
* ActionPanel

---

## Dados

* MetricCard
* InsightCard
* DataListItem
* EmptyState

---

## Formulários

* FormField
* Input
* Select
* Textarea

---

## Feedback

* StatusBadge
* FeedbackBanner

---

## Overlay

* ModalShell

---

## Público

* PublicSurveyShell

---

# Dashboard

## O que evitar

Não criar:

* parede de números
* excesso de gráficos
* excesso de widgets

---

## O que priorizar

* contexto
* tendências
* sinais
* interpretação

---

## Regra

Toda métrica deve responder:

"O que isso significa para o negócio?"

---

# Estados Vazios

Estados vazios fazem parte da experiência.

Nunca exibir:

```txt
0 resultados
```

Preferir:

Explicação.

Próxima ação.

Benefício esperado.

---

# Copywriting

## Linguagem

Clara.

Objetiva.

Humana.

---

## Evitar

* termos técnicos desnecessários
* linguagem excessivamente corporativa
* textos longos

---

## Preferir

Mostrar valor.

Mostrar resultado.

Mostrar impacto.

---

# Responsividade

Toda nova implementação deve funcionar em:

* Desktop
* Tablet
* Mobile

Sem exceções.

---

# Referências Oficiais

As referências utilizadas durante a construção desta linguagem visual são:

* Landing Kognis (Lovable)
* Synora Dashboard
* Shoplytix Dashboard
* Treasury SaaS
* IYWI SaaS
* Stripe
* Linear
* Notion
* Vercel

Importante:

As referências servem para extrair princípios.

Não devem ser copiadas literalmente.

---

# Regra Final

Consistência é mais importante que criatividade.

Uma experiência consistente em todo o produto gera mais valor do que telas isoladas visualmente impressionantes.

Toda decisão visual futura deve fortalecer a identidade do Kognis como uma plataforma de inteligência para negócios presenciais.
