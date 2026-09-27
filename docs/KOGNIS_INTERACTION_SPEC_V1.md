# KOGNIS_INTERACTION_SPEC_V1

## Objetivo

Definir os princípios oficiais de interação, navegação e experiência do usuário do Kognis Insights.

Este documento complementa:

* KOGNIS_VISUAL_SPEC_V1
* KOGNIS_VISUAL_DIRECTION_V1
* KOGNIS_DESIGN_LANGUAGE_V1

Enquanto os demais definem aparência visual, este documento define comportamento.

O objetivo é garantir consistência de experiência durante toda a evolução do produto.

---

# Princípio Central

O Kognis não é uma ferramenta de formulários.

O Kognis é uma plataforma de inteligência sobre clientes.

Toda interação deve reforçar esta percepção.

O usuário não deve sentir que está configurando formulários.

O usuário deve sentir que está coletando conhecimento sobre seus clientes.

---

# Filosofia de Produto

O Kognis deve transmitir:

* clareza;
* confiança;
* simplicidade;
* inteligência;
* profissionalismo.

O Kognis não deve transmitir:

* complexidade excessiva;
* aparência técnica;
* aparência de sistema interno;
* aparência de ERP;
* aparência de ferramenta de desenvolvedor.

---

# Hierarquia de Experiência

Toda tela deve responder rapidamente:

1. Onde estou?
2. O que estou vendo?
3. O que posso fazer agora?
4. Qual o próximo passo?

Nenhuma tela deve exigir aprendizado prévio para responder essas perguntas.

---

# Navegação

## Sidebar

A sidebar é a navegação principal.

Itens principais:

1. Dashboard
2. Pesquisas
3. Respostas

Itens secundários:

4. Campanhas
5. Configurações

Regras:

* Dashboard deve ser percebido como ponto de partida.
* Pesquisas é o centro operacional.
* Respostas é onde o valor aparece.
* Campanhas é organizacional.
* Configurações é suporte.

---

## Breadcrumbs

Devem ser usados apenas quando agregarem contexto.

Evitar breadcrumbs excessivos.

Preferir títulos claros.

---

# Page Header

Toda página autenticada deve possuir:

* título;
* descrição curta;
* ações relacionadas.

Exemplo:

Título:
Pesquisas

Descrição:
Crie, organize e compartilhe pesquisas com seus clientes.

---

# Fluxos

## Regra Geral

Toda ação importante deve possuir um próximo passo evidente.

Exemplo:

Criar pesquisa
↓
Configurar perguntas
↓
Visualizar
↓
Gerar QR Code
↓
Compartilhar

O sistema deve orientar o usuário naturalmente.

---

## Pesquisa

Fluxo oficial:

Criar pesquisa
↓
Configurar perguntas
↓
Visualizar pesquisa
↓
Gerar QR Code
↓
Receber respostas
↓
Analisar resultados

---

## Respostas

A área de respostas é operacional.

Ela responde:

* quem respondeu;
* quando respondeu;
* o que respondeu.

Ela não responde:

* o que aprendemos;
* tendências;
* insights.

Isso pertence ao Dashboard.

---

## Dashboard

O Dashboard responde:

* o que aprendemos;
* comportamento dos clientes;
* tendências;
* oportunidades.

O Dashboard não é local para CRUD.

---

# Botões

## Hierarquia

Primário

* ação principal da tela.

Secundário

* ação complementar.

Terciário

* ações menos frequentes.

Perigo

* exclusão;
* destruição;
* encerramento.

---

## Quantidade

Evitar mais de:

* 1 ação primária;
* 2 ações secundárias visíveis;

por bloco.

Ações adicionais devem ir para menu contextual.

---

# Cards

Cards devem priorizar:

1. informação;
2. contexto;
3. ação.

Nunca:

1. ação;
2. ação;
3. ação;
4. informação.

Evitar aparência de CRUD.

---

# Modais

Utilizar modais apenas para:

* confirmação;
* edição rápida;
* visualização simples.

Não utilizar modais para fluxos longos.

Quando um fluxo crescer, migrar para página dedicada.

---

# Feedback

Toda ação deve gerar feedback claro.

Exemplos:

Pesquisa criada.

Pergunta removida.

QR Code copiado.

Resposta exportada.

Evitar mensagens genéricas.

---

# Estados Vazios

Estados vazios devem orientar.

Nunca apenas informar.

Exemplo ruim:

Nenhuma pesquisa encontrada.

Exemplo correto:

Você ainda não criou pesquisas.
Crie sua primeira pesquisa para começar a coletar respostas.

---

# Mobile First

Toda funcionalidade deve ser utilizável em:

* 388px;
* 390px;
* 414px.

Regras:

* evitar empilhamento excessivo de botões;
* evitar tabelas largas;
* evitar menus longos;
* priorizar ações principais.

---

# Formulários

Princípios:

* poucos campos por bloco;
* labels claros;
* validação simples;
* mensagens objetivas.

Evitar linguagem técnica.

---

# Inteligência Progressiva

O produto deve evoluir nesta sequência:

Operação
↓
Leitura
↓
Entendimento
↓
Insight

Não antecipar analytics complexos antes de consolidar operação.

---

# Dashboard Futuro

O Dashboard deve responder:

Quem são meus clientes?

O que eles gostam?

O que mudou?

Onde existe oportunidade?

Nunca deve parecer um painel genérico de métricas.

---

# Decisão Oficial

Em conflitos entre:

Visual bonito
vs
Fluxo claro

Priorizar:

Fluxo claro.

Em conflitos entre:

Mais funcionalidades
vs
Experiência melhor

Priorizar:

Experiência melhor.

Em conflitos entre:

Complexidade
vs
Simplicidade

Priorizar:

Simplicidade.

---

# Versão

Versão:
V1

Status:
Ativo

Última atualização:
Relayout R2
