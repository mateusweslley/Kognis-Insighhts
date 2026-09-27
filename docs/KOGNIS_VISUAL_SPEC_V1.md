# KOGNIS_VISUAL_SPEC_V1

## Status

Versão: V1

Fase: R0.6 — Visual Specification

Objetivo:

Definir a identidade visual oficial da plataforma Kognis antes do início do relayout estrutural.

---

# 1. Filosofia Visual

O Kognis não deve parecer:

* ERP
* Sistema governamental
* Painel administrativo genérico
* Dashboard corporativo pesado

O Kognis deve parecer:

* Plataforma SaaS moderna
* Inteligência de negócio
* Simples de usar
* Limpo
* Profissional
* Confiável
* Dados transformados em decisões

Referências:

* Stripe
* Linear
* Notion
* Attio
* Vercel
* Arc Browser
* Resend

---

# 2. Estratégia De Tema

Tema principal:

Light First

O tema claro é a experiência principal do produto.

Dark Mode pode existir futuramente, mas não faz parte do escopo atual.

---

# 3. Paleta Oficial

## Brand

```css
--brand-primary: #7C3AED;
--brand-hover: #6D28D9;
--brand-soft: #EDE9FE;
--brand-subtle: #F5F3FF;
--brand-foreground: #FFFFFF;
```

## Background

```css
--background: #FAFAFC;
--surface: #FFFFFF;
--surface-muted: #F4F4F8;
--surface-elevated: #FFFFFF;
```

## Texto

```css
--text-primary: #111827;
--text-secondary: #4B5563;
--text-muted: #6B7280;
--text-disabled: #9CA3AF;
```

## Bordas

```css
--border: #E5E7EB;
--border-strong: #D1D5DB;
```

## Estados

### Success

```css
#10B981
```

### Warning

```css
#F59E0B
```

### Danger

```css
#EF4444
```

### Info

```css
#3B82F6
```

---

# 4. Tipografia

## Fonte Oficial

```text
Geist
```

Fallback:

```text
Inter
system-ui
sans-serif
```

---

## Escala Tipográfica

### Display

```css
48px
font-weight: 700;
```

Uso:

* Landing Page
* Hero Sections

### Page Title

```css
32px
font-weight: 700;
```

Uso:

* Dashboard
* Pesquisas
* Campanhas
* Configurações

### Section Title

```css
24px
font-weight: 600;
```

### Card Title

```css
18px
font-weight: 600;
```

### Body

```css
16px
font-weight: 400;
```

### Small

```css
14px
font-weight: 400;
```

### Caption

```css
12px
font-weight: 400;
```

---

# 5. Espaçamentos

Escala oficial:

```css
xs  = 4px;
sm  = 8px;
md  = 16px;
lg  = 24px;
xl  = 32px;
2xl = 48px;
3xl = 64px;
```

Regra:

Preferir mais respiro visual.

Evitar interfaces densas.

---

# 6. Radius

## Small

```css
12px
```

Uso:

* Inputs
* Selects

## Medium

```css
16px
```

Uso:

* Cards

## Large

```css
20px
```

Uso:

* Containers
* Seções

## Pill

```css
999px
```

Uso:

* Badges
* Status
* Chips

---

# 7. Shadows

## Subtle

```css
0 1px 2px rgba(0, 0, 0, 0.05);
```

Uso:

* Inputs

## Card

```css
0 4px 12px rgba(0, 0, 0, 0.06);
```

Uso:

* Cards

## Floating

```css
0 12px 32px rgba(0, 0, 0, 0.10);
```

Uso:

* Modais
* Dropdowns
* Menus

Regra:

Evitar sombras agressivas.

---

# 8. Layout Principal

## Sidebar

Expandida:

```css
280px
```

Recolhida:

```css
72px
```

Estrutura:

```text
Logo

Navegação

Espaço flexível

Perfil do usuário
```

---

## Header

Altura:

```css
72px
```

Conteúdo:

```text
Título
Descrição
Ações
```

---

## Container

Largura máxima:

```css
1280px
```

Padding:

Desktop:

```css
24px
```

Mobile:

```css
16px
```

---

# 9. Botões

## Primary

Características:

* Fundo roxo
* Texto branco

Uso:

* Ações principais

---

## Secondary

Características:

* Fundo branco
* Borda visível
* Texto escuro

Uso:

* Ações secundárias

---

## Ghost

Características:

* Sem fundo
* Hover suave

Uso:

* Ações auxiliares

---

## Danger

Características:

* Fundo vermelho

Uso:

* Exclusões
* Ações destrutivas

---

# 10. Cards

Todo card deve possuir:

```text
Título
Descrição opcional
Conteúdo
Ações opcionais
```

Evitar:

* Bordas pesadas
* Fundos coloridos

Preferir:

* Fundo branco
* Sombra leve
* Muito espaço interno

---

# 11. Métricas

Estrutura padrão:

```text
Valor

Descrição

Variação opcional
```

Exemplo:

```text
12.543

Respostas coletadas

+12% vs mês anterior
```

---

# 12. Tabelas

Diretrizes:

* Não parecer ERP
* Linhas leves
* Hover suave
* Espaçamento amplo
* Boa leitura mobile

---

# 13. Estados Vazios

Toda tela deve possuir:

```text
Ícone
Título
Descrição
CTA
```

Exemplo:

```text
Nenhuma pesquisa criada

Crie sua primeira pesquisa para começar a coletar dados.

[ Criar Pesquisa ]
```

---

# 14. Componentes Oficiais

A partir da R1/R2 o sistema deverá possuir:

```text
PageShell
PageHeader
MetricCard
InsightCard
StatusBadge
FeedbackBanner
SearchInput
EmptyState
SectionContainer
```

---

# 15. Regras De UX

Nunca usar:

* Mais de duas cores principais na mesma tela
* Cards excessivamente pequenos
* Texto cinza claro sobre fundo branco
* Informações sem hierarquia visual

Sempre priorizar:

* Legibilidade
* Espaço
* Hierarquia
* Clareza
* Velocidade de compreensão

---

# 16. Critério De Sucesso

Ao abrir o Kognis pela primeira vez, o usuário deve pensar:

> "Isso parece uma plataforma moderna de inteligência para negócios."

E não:

> "Isso parece apenas um sistema de formulários com QR Code."
