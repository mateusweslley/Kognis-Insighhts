# Contrato dos KPIs do Dashboard V2 — V1

Este documento formaliza as regras aprovadas para a camada pura de cálculo. A integração com consultas Supabase e com a interface do dashboard é uma etapa posterior.

## KPIs

### Respostas recebidas

Contar registros válidos e distintos por `response.id`, após filtrar `created_at` pelo intervalo selecionado. A validade é exclusivamente a já definida em `src/lib/metrics/extract.ts`: respostas dinâmicas precisam conter pelo menos um valor válido para pergunta conhecida; respostas legadas seguem as regras existentes para rating, nome, e-mail e comentário. Não deduplicar por identidade ou conteúdo. Resposta legada pode contar no volume, mas seu rating não entra na avaliação consolidada sem comprovação semântica.

Uma consulta bem-sucedida sem respostas válidas produz valor zero. Erro de consulta produz estado `error`, nunca zero.

### Avaliação média

Calcular a média aritmética das respostas válidas às perguntas principais configuradas explicitamente por pesquisa, somente quando o tipo é `rating` (escala inteira 1–5). Não selecionar pergunta automaticamente, incluir `rating_10`, tratar `number` como avaliação ou misturar escalas. Valores inválidos/nulos são excluídos pelas regras existentes. Sem pergunta principal compatível ou sem notas válidas, retornar `no_data`, sem nota artificial. Exibir escala `/5` na futura integração.

### Percepção positiva

`(quantidade de avaliações 4 ou 5 / total de avaliações válidas elegíveis) × 100`. Usa exatamente a mesma amostra e seleção da média. Não é NPS e não há regra V1 para escala 0–10. Sem avaliação elegível, retornar `no_data`.

### Pesquisas ativas

Contar pesquisas da empresa cujo status atual seja `active`, sem aplicar o filtro de período. Não calcular histórico de status nem comparar períodos, pois não há histórico de transições neste contrato.

## Períodos e comparação

`T` é um único instante de referência. Para `N ∈ {7, 30, 90}` dias, o período atual é `[T − N × 24h, T)` e o anterior é `[T − 2N × 24h, T − N × 24h)`. O limite inicial é incluído e o final excluído. Os timestamps são comparados como instantes; a V1 usa UTC para os limites e para agrupamento diário (00:00–24:00 UTC).

Variação absoluta: `atual − anterior`. Variação percentual: `((atual − anterior) / anterior) × 100`, somente se o anterior for maior que zero. Anterior igual a zero resulta em percentual `null`; se ambos forem zero, a diferença absoluta é zero e o percentual segue `null`. Valores `no_data` e `error` propagam seus estados e jamais são convertidos em zero.

Para média, a diferença absoluta está na escala de nota; para percepção positiva, é diferença em pontos percentuais; para respostas, é contagem. O percentual relativo compara os valores numéricos correspondentes. Pesquisas ativas não recebem comparação temporal.

## Amostra e saúde

Média e percepção positiva são calculadas com toda avaliação elegível, inclusive abaixo de 30. A classificação de saúde usa a média consolidada de avaliações 1–5 e só classifica com ao menos 30 avaliações válidas; abaixo disso o estado é `Aguardando mais respostas`. O tamanho informado é a quantidade de avaliações da pergunta principal, não a quantidade total de respostas recebidas. Os limites de classificação preservam o helper existente: Excelente ≥ 4,5; Boa ≥ 4; Regular ≥ 3; Atenção necessária < 3.

## Limitações e pré-requisitos para integração

- O schema e o código inspecionados não demonstram configuração persistida da pergunta principal por pesquisa. O motor aceita IDs explícitos fornecidos pelo chamador, mas a fonte dessa configuração precisa ser definida antes da integração.
- Os cálculos usam as perguntas e respostas carregadas pelo chamador. A consulta deve garantir escopo da empresa e cobertura de todo o intervalo atual e anterior.
- IDs repetidos na entrada são deduplicados, mantendo a primeira ocorrência. O banco usa ID como chave primária; linhas repetidas com conteúdo divergente indicariam inconsistência da origem.
- Não há deduplicação por e-mail, telefone ou conteúdo.
- Ratings legados não entram na avaliação consolidada por falta de comprovação de equivalência com a pergunta principal; podem continuar sendo respostas válidas para o volume.
- Pesquisas ativas são somente estado presente. Não é possível reconstruir estados históricos sem dados de transição.
- O motor puro distingue erro de consulta de zero real por flags de estado da entrada. O adaptador Supabase futuro deverá preenchê-las corretamente.
- O volume e a classificação são métricas distintas: 29 respostas válidas podem produzir KPIs calculados e saúde ainda aguardando amostra.

## Exemplos

- Ratings `5, 4, 2`: média `3,67/5`; percepção positiva `2/3 = 66,67%`.
- 29 ratings válidos: média e percepção calculáveis; classificação de saúde aguardando mais respostas.
- Atual `8`, anterior `5`: diferença `+3`, variação `+60%`.
- Atual `8`, anterior `0`: diferença `+8`, percentual sem base (`null`).
- Atual `0`, anterior `0`: diferença `0`, percentual sem base (`null`).
