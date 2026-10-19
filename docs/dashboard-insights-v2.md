# Kognis Insights — Especificação de Produto e Implementação
## Dashboard V2 + Central de Insights

**Projeto:** Kognis Insights  
**Objetivo:** Evoluir o MVP para uma plataforma de análise de feedbacks que ajude empresas a compreender a percepção dos clientes e identificar oportunidades de melhoria.  
**Diretriz principal:** Evoluir a implementação existente, preservando o que funciona e evitando reescritas desnecessárias.

---

# 1. Visão do produto

O Kognis Insights coleta feedbacks de clientes em pontos físicos por meio de QR Codes, NFC e links públicos. A plataforma transforma essas respostas em indicadores, padrões e informações que auxiliam a tomada de decisão.

A próxima versão deve avançar em duas frentes integradas:

- **Dashboard V2:** apresentar rapidamente a situação geral da empresa e a evolução dos indicadores.
- **Central de Insights:** ajudar o usuário a descobrir padrões nas respostas, compreender possíveis causas e decidir o que investigar ou melhorar.

O produto deve atender a três perfis sem criar interfaces separadas:

1. **Pequeno empresário:** precisa entender rapidamente como está a percepção dos clientes.
2. **Gerente:** precisa identificar problemas recorrentes e oportunidades de melhoria.
3. **Analista:** precisa investigar períodos, pesquisas, respostas e evidências.

A experiência deve começar simples e oferecer mais profundidade conforme o usuário investiga os dados.

# 2. Diretrizes obrigatórias antes de implementar

Antes de alterar qualquer arquivo, examine o repositório atual e identifique:

- A estrutura do projeto e as tecnologias efetivamente utilizadas.
- As rotas existentes de autenticação, Dashboard, Pesquisas e Respostas.
- Os componentes de Dashboard já implementados.
- O funcionamento atual dos filtros de período e da comparação com períodos anteriores.
- O modelo de dados do Supabase e as consultas utilizadas para obter respostas.
- A estrutura das respostas dinâmicas e das respostas legadas.
- O funcionamento das políticas RLS, permissões e isolamento de dados entre empresas.
- A biblioteca de gráficos instalada e como ela é utilizada.
- Os testes existentes, os comandos disponíveis e eventuais limitações conhecidas.

Não presuma que os componentes, tabelas, campos ou funções descritos nesta especificação já existem exatamente dessa forma.

**Primeiro, apresente um diagnóstico técnico e um plano de implementação.** Identifique o que pode ser reutilizado, o que precisa ser adaptado e quais mudanças exigem decisões adicionais, principalmente quando envolver banco de dados, persistência de análises ou integração com IA.

Não execute uma reescrita geral do projeto. Não substitua funcionalidades existentes apenas por preferência arquitetural.

# 3. Direção visual

Evoluir a interface atual do Kognis Insights, mantendo a identidade visual já estabelecida.

## Princípios

- Interface limpa, profissional e moderna.
- Predominância de branco, tons neutros e roxo da identidade do Kognis.
- Hierarquia visual clara, com indicadores importantes fáceis de localizar.
- Bordas discretas e sombras moderadas.
- Tipografia, espaçamentos, ícones e componentes consistentes.
- Gráficos legíveis, com legendas, unidades e períodos explícitos.
- Layout responsivo para desktop, tablet e celular.
- Estados de carregamento, ausência de dados, erros e amostras pequenas bem definidos.
- Evitar excesso de cartões, gráficos decorativos e informações concorrendo pela atenção.

Usar como referências conceituais a clareza analítica do Stripe, a profundidade de exploração do PostHog e o acabamento minimalista do Linear. Não copiar suas interfaces literalmente.

Reutilizar os componentes existentes quando fizer sentido e preservar o funcionamento atual da plataforma.

# 4. Dashboard V2

## 4.1 Cabeçalho

Manter o título:

**Dashboard**

Subtítulo:

"Tenha uma visão clara do que seus clientes estão dizendo."

Disponibilizar:

- Filtro de período: últimos 7, 30 ou 90 dias.
- Opção de comparar com o período anterior equivalente.
- Indicação clara do período analisado.
- Eventuais filtros adicionais somente se puderem ser conectados corretamente aos dados existentes.

A alteração do período deve atualizar os indicadores e os gráficos relacionados, sem misturar períodos ou apresentar comparações inválidas.

## 4.2 Indicadores principais

Exibir quatro indicadores:

### Respostas
Quantidade de respostas válidas recebidas no período selecionado.

Regras:
- Excluir duplicatas conforme as regras reais do sistema.
- Respeitar a empresa autenticada e as permissões aplicáveis.
- Mostrar a variação percentual somente quando existir uma base anterior válida.
- Não confundir respostas recebidas com clientes únicos.

### Avaliação média
Média das avaliações numéricas comparáveis recebidas no período.

Regras:
- Considerar somente respostas válidas para o cálculo.
- Identificar a escala utilizada.
- Não misturar escalas incompatíveis.
- Não inventar avaliações para perguntas textuais.
- Se houver várias perguntas de avaliação, definir e documentar qual delas compõe o indicador.
- Se não houver dados compatíveis, exibir um estado informativo em vez de zero artificial.

### Percepção positiva
Percentual de avaliações classificadas como positivas segundo uma regra explícita e compatível com a escala utilizada.

Regras:
- Definir a classificação positiva por tipo de escala.
- Exibir ou disponibilizar a regra utilizada.
- Não tratar percepção positiva como sinônimo de NPS.
- Não produzir o indicador quando os dados não permitirem uma classificação confiável.

### Pesquisas ativas
Quantidade de pesquisas atualmente ativas para a empresa.

Este indicador representa o estado atual, não necessariamente a quantidade de pesquisas ativas durante todo o período selecionado. Sua apresentação deve deixar essa diferença clara.

## 4.3 Comparações

Quando a comparação com o período anterior estiver habilitada:

- Comparar intervalos equivalentes.
- Exibir a variação absoluta ou percentual de forma compreensível.
- Definir o comportamento quando o valor anterior for zero.
- Não mostrar percentuais enganosos em situações sem base de comparação.
- Diferenciar ausência de dados de uma variação real igual a zero.

## 4.4 Gráfico de respostas

Adicionar ou evoluir um gráfico principal que mostre o volume de respostas ao longo do tempo.

Requisitos:
- Utilizar dados reais.
- Respeitar o período selecionado.
- Agregar por dia ou por intervalo apropriado ao período.
- Exibir datas e valores legíveis.
- Ter estado vazio quando não houver respostas.
- Não introduzir séries artificiais para preencher lacunas.

## 4.5 Evolução das avaliações

Quando existirem avaliações numéricas comparáveis, permitir visualizar sua evolução temporal.

Não exibir esse gráfico quando as respostas não permitirem uma comparação válida. Em pesquisas com estruturas diferentes, avaliar a compatibilidade antes de consolidar os resultados.

## 4.6 Saúde da percepção dos clientes

Manter a seção:

**Como está a percepção dos seus clientes?**

Apresentar um estado compreensível, como:

- Excelente
- Boa
- Regular
- Atenção necessária
- Aguardando dados

Os limites para cada classificação devem ser explícitos, consistentes e baseados em indicadores válidos. Não inventar limites arbitrários ou apresentar classificações como conclusões estatísticas definitivas.

A interface deve informar quando há poucos dados para sustentar uma conclusão.

## 4.7 Insights em destaque

Adicionar uma seção compacta com até três insights relevantes, quando houver análises disponíveis.

Cada item deve apresentar:
- Título.
- Categoria.
- Resumo curto.
- Quantidade de respostas relacionadas, quando disponível.
- Ação para investigar o insight na Central de Insights.

Priorizar informações úteis para a decisão, sem duplicar toda a análise da página de Insights.

# 5. Central de Insights

## 5.1 Objetivo

A Central de Insights deve ajudar o usuário a responder:

- O que os clientes estão elogiando?
- Quais problemas aparecem com frequência?
- Quais oportunidades merecem investigação?
- Que respostas sustentam essa interpretação?
- O que a empresa pode fazer a seguir?

Não deve ser apenas uma página com textos produzidos por IA. Toda interpretação precisa estar vinculada aos dados disponíveis e permitir investigação das evidências.

## 5.2 Cabeçalho

Título:

**Insights**

Subtítulo:

"Descubra padrões nas respostas e identifique oportunidades de melhoria."

Disponibilizar filtros compatíveis com os dados:
- Período.
- Pesquisa.
- Categoria de insight.
- Tema, quando houver classificação de temas disponível.

Os filtros precisam afetar efetivamente os resultados apresentados.

## 5.3 Resumo da análise

Apresentar um resumo da análise selecionada, que pode incluir:

- Quantidade de respostas analisadas.
- Período considerado.
- Quantidade de temas identificados.
- Indicadores de percepção compatíveis com os dados.

Deixar explícita a diferença entre o total de respostas recebidas e a quantidade de respostas efetivamente analisadas pela IA.

Não apresentar uma análise parcial como se representasse todas as respostas.

## 5.4 Categorias de insights

Organizar os resultados em três categorias principais:

### Pontos positivos
Padrões de elogios, experiências valorizadas e aspectos percebidos favoravelmente pelos clientes.

### Pontos de atenção
Reclamações, dificuldades, experiências negativas e problemas recorrentes.

### Oportunidades
Sugestões, necessidades não atendidas, ideias e possibilidades de melhoria que merecem investigação.

Uma mesma resposta pode conter aspectos positivos e negativos. A classificação deve refletir o conteúdo real, sem forçar cada comentário a uma única interpretação quando isso não fizer sentido.

## 5.5 Cartões de temas

Cada tema identificado deve apresentar, quando disponível:

- Título objetivo.
- Categoria.
- Resumo.
- Quantidade de respostas relacionadas.
- Quantidade total de respostas analisadas no contexto.
- Exemplos reais de evidências.
- Ação para abrir os detalhes.

Não apresentar frequências como percentuais sem definir corretamente o denominador. Se uma resposta puder mencionar vários temas, explicar que as contagens por tema podem se sobrepor.

Os cartões devem distinguir um tema frequente de um tema potencialmente importante. Um problema grave pode merecer investigação mesmo que apareça poucas vezes.

## 5.6 Detalhes de um insight

Ao selecionar um tema, abrir uma página, painel ou detalhe consistente com a arquitetura atual.

Apresentar:

1. **Título e categoria.**
2. **Resumo do que foi observado.**
3. **Frequência e tamanho da amostra**, quando calculáveis.
4. **Evidências:** respostas reais que sustentam a interpretação.
5. **Interpretação:** o que os dados sugerem, sem transformar hipótese em fato.
6. **Ações sugeridas:** passos concretos que a empresa pode avaliar.
7. **Acesso às respostas originais**, respeitando as permissões e os filtros.

Exemplo conceitual, com números ilustrativos que não devem ser utilizados como dados reais:

Tema: demora no atendimento.

Observação: vários comentários mencionam demora para receber atendimento.

Evidências: comentários reais relacionados ao tema.

Hipótese: pode existir um gargalo em determinados horários ou etapas do atendimento.

Ação sugerida: investigar os horários das reclamações e comparar o volume de atendimento com a capacidade da equipe.

A interface deve separar claramente:
- O que foi observado nos dados.
- O que é uma interpretação ou hipótese.
- O que é uma recomendação.

As ações sugeridas não devem ser apresentadas como garantias de resultado.

# 6. Papel da IA e dos cálculos determinísticos

A arquitetura deve separar os cálculos confiáveis do sistema das interpretações produzidas por IA.

## 6.1 Processamento determinístico

O sistema deve calcular diretamente:
- Quantidade de respostas.
- Médias e distribuições válidas.
- Percentuais e variações.
- Contagens por período.
- Tamanho das amostras.
- Contagens de respostas associadas a temas, quando a classificação estiver disponível e validada.

A IA não deve ser responsável por inventar ou recalcular os indicadores oficiais.

## 6.2 Processamento por IA

A IA pode ser utilizada para:
- Identificar temas recorrentes nos comentários.
- Resumir padrões.
- Classificar aspectos positivos, negativos ou oportunidades.
- Relacionar comentários a temas.
- Sugerir perguntas de investigação e ações possíveis.

As análises devem utilizar apenas respostas autorizadas e relevantes para o contexto da empresa, período e filtros selecionados.

## 6.3 Evidências verificáveis

Sempre que a IA afirmar que um tema foi mencionado em determinadas respostas, o sistema deve verificar a correspondência entre a análise e as respostas reais.

Requisitos:
- Referenciar identificadores reais de respostas.
- Validar se as respostas pertencem à empresa e ao conjunto analisado.
- Não aceitar identificadores inexistentes ou fora do escopo.
- Não fabricar citações de clientes.
- Não permitir que a IA altere os dados originais.
- Não apresentar uma resposta como evidência se ela não sustentar a interpretação.

Quando não houver evidência suficiente, informar a limitação e não apresentar a conclusão como estabelecida.

## 6.4 Confiança e incerteza

Não apresentar pontuações de confiança como probabilidades calibradas sem uma metodologia que as sustente.

Preferir linguagem proporcional à evidência, por exemplo:
- "Observado em várias respostas."
- "Sinal inicial que merece investigação."
- "Amostra insuficiente para uma conclusão consistente."

O tamanho da amostra deve ser visível e não deve ser confundido com a certeza da interpretação.

## 6.5 Custos e persistência

Não executar uma nova análise de IA a cada abertura da página sem necessidade.

Antes de implementar persistência:
- Avaliar a arquitetura existente.
- Definir quando uma análise continua válida.
- Definir como novas respostas invalidam ou atualizam os resultados.
- Considerar filtros de período e pesquisa.
- Evitar chamadas redundantes.
- Tratar falhas de IA sem indisponibilizar o Dashboard e os indicadores determinísticos.

Se for necessário adicionar tabelas, funções, filas ou serviços, apresentar primeiro a proposta técnica, os custos operacionais e os impactos sobre o banco. Não criar estruturas novas sem justificar sua necessidade.

# 7. Estados da interface

Todas as páginas devem tratar adequadamente as seguintes situações:

### Empresa sem respostas
Orientar o usuário a criar uma pesquisa e compartilhá-la por QR Code, NFC ou link. Não exibir dados fictícios.

### Poucas respostas
Apresentar os dados que já podem ser calculados, mas informar que a amostra ainda é limitada para conclusões mais amplas.

### Dados suficientes
Exibir os indicadores e as análises que realmente possam ser sustentados pelos dados.

### Análise em processamento
Mostrar um estado de processamento compreensível, sem bloquear funcionalidades independentes da IA.

### Falha na análise
Informar que a análise não pôde ser concluída e oferecer uma forma apropriada de tentar novamente. Preservar os indicadores que continuam disponíveis.

### Erro ao carregar dados
Apresentar uma mensagem útil e permitir recuperação quando possível. Um erro em um gráfico ou na Central de Insights não deve derrubar toda a plataforma.

### Dados incompatíveis
Explicar quando um indicador não pode ser calculado por incompatibilidade de escala, tipo de pergunta ou ausência de informações.

# 8. Navegação e experiência integrada

A experiência desejada é:

**Dashboard → Insights → Detalhe do insight → Respostas originais**

O Dashboard oferece a visão geral. A Central de Insights permite investigar padrões. O detalhe explica a interpretação e mostra suas evidências. As respostas originais permitem conferir o contexto.

Preservar as rotas e a navegação existentes sempre que possível. Não criar módulos duplicados ou reorganizar todo o menu sem necessidade.

Pesquisas, Respostas, Campanhas/Links e Configurações devem continuar funcionando como antes.

# 9. Requisitos técnicos e de segurança

- Preservar autenticação e autorização existentes.
- Respeitar integralmente as políticas RLS do Supabase.
- Garantir isolamento entre empresas.
- Não expor `service_role`, chaves privadas ou segredos no cliente.
- Não enfraquecer permissões para facilitar consultas.
- Validar entradas e saídas da IA.
- Tratar falhas e limites dos serviços externos.
- Evitar consultas desnecessárias e carregamento excessivo de respostas.
- Não modificar dados históricos sem necessidade e sem migração controlada.
- Manter compatibilidade com as estruturas de respostas existentes.
- Preservar o funcionamento de pesquisas públicas e do envio de respostas.
- Não adicionar dependências sem avaliar necessidade, manutenção e custo.
- Utilizar a biblioteca de gráficos já instalada, se ela atender aos requisitos.
- Manter a lógica de cálculo testável e separada dos componentes visuais.

# 10. Compatibilidade com os dados atuais

O projeto possui respostas dinâmicas e também um formato legado com campos como avaliação e comentário. A implementação precisa inspecionar o modelo real antes de definir consultas ou regras.

Não assumir que toda resposta contém nota, comentário, nome ou e-mail.

Os indicadores e as análises devem considerar os tipos de pergunta efetivamente respondidos. Respostas textuais não podem ser convertidas artificialmente em notas numéricas.

Preservar a compatibilidade com pesquisas existentes, sem exigir que o usuário recrie suas pesquisas para utilizar a nova versão.

# 11. Escopo da primeira entrega

Priorizar uma V2 consistente e funcional.

## Dashboard V2
- Cabeçalho e filtros funcionais.
- Quatro indicadores com regras documentadas.
- Comparação de períodos quando válida.
- Gráfico de volume de respostas.
- Evolução das avaliações quando aplicável.
- Estado de percepção com regras explícitas.
- Até três insights em destaque.
- Estados de carregamento, erro e ausência de dados.

## Central de Insights
- Cabeçalho e filtros funcionais.
- Resumo baseado nos dados reais.
- Categorias de pontos positivos, pontos de atenção e oportunidades.
- Temas com contagens e evidências verificáveis.
- Detalhes do insight com observações, hipóteses e ações sugeridas.
- Navegação até as respostas originais.
- Estados de amostra insuficiente, processamento, ausência de dados e erro.
- Estratégia controlada de persistência ou cache, se necessária e aprovada após a avaliação técnica.

## Fora do escopo inicial, salvo justificativa aprovada
- Reescrever a arquitetura do produto.
- Criar um sistema completo de gestão de tarefas e responsáveis.
- Introduzir previsão de vendas ou indicadores sem dados que os sustentem.
- Criar análises estatísticas avançadas sem necessidade validada.
- Adicionar múltiplas integrações de IA simultaneamente.
- Implementar NPS sem definir corretamente sua coleta e cálculo.
- Criar tabelas, RPCs ou serviços novos apenas para acomodar uma solução preferida pela IA.

# 12. Critérios de aceite

A implementação só deve ser considerada concluída quando:

1. Os indicadores são calculados a partir de dados reais.
2. Os filtros alteram os resultados de forma consistente.
3. As comparações não apresentam variações enganosas.
4. Pesquisas sem avaliações numéricas não exibem médias artificiais.
5. A Central de Insights apresenta evidências rastreáveis.
6. Os resumos e as recomendações não são confundidos com fatos comprovados.
7. A IA não pode acessar respostas de outras empresas.
8. Os erros da IA não impedem o uso dos indicadores determinísticos.
9. Os estados de ausência de dados e amostras pequenas são claros.
10. A experiência funciona em telas menores.
11. As funcionalidades existentes continuam operacionais.
12. Os testes relevantes são executados e seus resultados são relatados com honestidade.

# 13. Processo de implementação

Executar o trabalho em etapas:

**Etapa 1 — Auditoria**
Mapear a arquitetura existente, componentes reutilizáveis, modelo de dados, permissões, consultas, dependências e testes.

**Etapa 2 — Plano técnico**
Apresentar os arquivos que serão alterados, as alterações previstas, as regras dos indicadores e eventuais mudanças no banco ou na integração de IA.

**Etapa 3 — Validação de decisões estruturais**
Antes de implementar mudanças significativas de banco, persistência, processamento ou custos de IA, explicar as opções e recomendar uma solução compatível com o projeto.

**Etapa 4 — Implementação incremental**
Evoluir o Dashboard e construir a Central de Insights reutilizando os componentes e serviços existentes. Evitar alterações não relacionadas ao escopo.

**Etapa 5 — Testes**
Executar os testes existentes e adicionar testes para cálculos, filtros, compatibilidade dos dados, evidências e permissões relevantes.

**Etapa 6 — Relatório**
Informar:
- Arquivos criados e alterados.
- Funcionalidades implementadas.
- Decisões arquiteturais.
- Alterações de banco necessárias.
- Variáveis de ambiente ou serviços adicionais, se houver.
- Testes executados e seus resultados reais.
- Pendências, riscos e próximos passos.

Não declarar uma funcionalidade concluída sem verificar sua implementação. Não declarar testes aprovados se não tiverem sido executados.

# Resultado esperado

Uma evolução coerente do Kognis Insights: um Dashboard que resume a situação da empresa e uma Central de Insights que transforma respostas reais em padrões investigáveis, com evidências, contexto e sugestões de ações.

O produto deve ajudar o empresário a compreender o que os clientes estão dizendo sem esconder incertezas, fabricar indicadores ou comprometer a segurança dos dados.

A prioridade é entregar valor real com uma arquitetura sustentável, mantendo a simplicidade do MVP e preparando o produto para crescer.
