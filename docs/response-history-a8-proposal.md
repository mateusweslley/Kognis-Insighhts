# A8 — Política histórica e proposta de versões imutáveis

## Estado e escopo

**Proposta técnica pronta, aguardando decisão ou aprovação. A8 não está resolvido.**

Inspeção local em 2026-10-21, branch `hml`, HEAD
`40cb5b15d8043f26965e84edc1a9265d86595641`. Baseline executado antes das edições:
506 testes aprovados em 31 arquivos. Não houve acesso ao Supabase DEV/produção,
migration executada, escrita no banco, alteração do fluxo público, commit ou push.
As migrations descritas abaixo são evidência do contrato no repositório; sua
aplicação no ambiente real não foi verificada.

Esta entrega acrescenta este documento, um diagnóstico puro e testes. Não muda
fórmulas, leitores, payloads, configuração de publicação ou interface de A1–A7.
O diagnóstico NÃO é chamado pelos consumidores do produto. Portanto as lacunas
descritas continuam no produto e não passam a ser sinalizadas na UI por esta entrega.

## Evidências do armazenamento e da escrita

| Elemento | Evidência local | O que não é preservado |
| --- | --- | --- |
| Pergunta | `supabase/003_survey_questions.sql`: `id`, `survey_id`, `title`, `description`, `type`, `required`, `position`, `options`, timestamps; tipos ampliados em migrations posteriores; `topic` na aplicação | Versão anterior de texto, tipo, tópico, obrigatoriedade, posição e opções |
| Opções | `src/types/survey-question.ts`: `SurveyQuestionOption = string`; formulário `dynamic-public-response-form.tsx` usa a string como valor da opção | Não há ID próprio de opção nem vínculo entre um rótulo antigo e um novo |
| Escala | Tipos `rating` e `rating_10`; formulário e `012_submission_validation.sql` validam inteiros 1–5 e 0–10, respectivamente; `number` é genérico | Não há escala por resposta, polaridade, propósito semântico ou versão de escala |
| Resposta | `004_responses.sql`: `id`, `survey_id`, `answers jsonb`, `created_at`; gateway acrescenta chave de submissão | Nenhuma FK para versão de pesquisa/pergunta, snapshot de perguntas ou seleção principal vigente |
| Resposta dinâmica | `{mode:"dynamic", answers:{[questionId]: string ou number}}`; `submission-gateway.ts` encaminha o payload para a RPC | Não armazena título, tipo, opções, escala ou versão; IDs no JSON não são FKs para perguntas |
| Resposta legada | `{name,email?,rating,comment?}`; contrato fixo 1–5 no formulário e RPC | Não comprova equivalência com uma pergunta dinâmica ou seleção principal |
| Escrita autoritativa | `012_submission_validation.sql`, `submit_public_survey_response`: consulta `q.id,q.type,q.required,q.options` atuais e grava `p_answers` em `responses` | A validação no instante de submissão não registra os metadados que validou; a migration também não revalida respostas antigas |
| Edição/exclusão | `survey-questions.ts`: `updateQuestion`, `deleteQuestion`, `reorderQuestions` fazem update/delete das linhas atuais | Nenhum registro anterior é arquivado por esses caminhos |
| Publicação | `survey-manager.tsx` salva `surveys.status` junto aos demais atributos | Não há operação de publicação que fixe versão imutável, nem versão enviada pelo formulário |
| Principal | `014_primary_survey_question.sql`: `surveys.primary_question_id`, FK para pergunta da mesma pesquisa, tipo `rating`, proteção de tipo enquanto principal, limpeza na exclusão | Não há histórico de seleção; remover a seleção permite depois mudar o tipo; não protege texto/opções de todas as perguntas |
| Timestamps | `set_updated_at` sobrescreve a última atualização | Não contêm valores anteriores; igualdade/ordem de timestamps não prova metadados ou configurações originais |
| Outros snapshots | `campaign_claims.reward_snapshot` guarda recompensa; `dashboard-kpi-snapshot.ts` é envelope de KPIs retornado pela API | Nenhum deles guarda a configuração original das perguntas |

Não foi encontrada infraestrutura de histórico de perguntas nas migrations e
serviços examinados. Isso não demonstra ausência de backups/logs externos:
esses recursos não foram consultados e não podem ser presumidos disponíveis.

## Recuperabilidade comprovável

1. **Recuperável em escopo limitado:** valores brutos persistidos; UUIDs de
   pergunta presentes no JSON; interpretação da nota legada conforme o contrato
   fixo 1–5, quando o payload é válido. Isso não recupera o texto original da
   pesquisa nem associa notas legadas à pergunta principal.
2. **Parcialmente recuperável:** resposta dinâmica conserva ID e valor literal.
   Uma escolha guarda a string selecionada, mas não demonstra a lista original,
   sua posição, o significado da pergunta ou se um rótulo atual é renomeação.
   A existência de uma pergunta atual com o mesmo ID não completa a prova.
3. **Não recuperável pelas fontes locais existentes:** metadados antigos
   sobrescritos/excluídos e principal vigente no instante da resposta. Duas
   configurações diferentes podem produzir exatamente o mesmo JSON. Não há
   algoritmo confiável que escolha a correta sem evidência externa vinculada.

Não classificar valor dinâmico como inválido historicamente só porque não está
na lista/faixa atual: um `9` poderia ter sido `rating_10` ou `number`; uma string
ausente da lista atual poderia ter sido uma opção removida. Tampouco classificar
todo registro antigo como comprovadamente alterado: a ausência de histórico
significa **interpretação desconhecida**, não prova de edição.

## Consumidores afetados

| Superfície | Caminho | Dependência atual e impacto |
| --- | --- | --- |
| KPIs consolidados e comparação de períodos | `dashboard-kpi-source.server.ts` → `metrics/dashboard-kpis.ts` → `metrics/extract.ts` | Carrega perguntas e principal atuais; validade/denominadores e seleção histórica podem mudar |
| Builder, gráficos, tendências e tópicos | `dashboard-metric-loader.ts` → `extractResponseData` → `dashboard-metric-resolver.ts` | Escolhas precisam pertencer às opções atuais; tipo/tópico atuais definem média, distribuição, NPS e volume válido |
| Insight individual | `app/respostas/[surveyId]/page.tsx` → `calculateSurveyInsight` | A7 usa principal atual para notas dinâmicas; mantém legado separado. Trocar principal muda média dos registros antigos |
| Outras agregações | `metrics/dashboard-metrics.ts`: `getSurveyMetrics`, `extractPools`, `getPeriodMetrics` | Tipos/opções/tópicos atuais; não constituem fonte histórica alternativa |
| Lista e detalhe individual | `response-normalizer.ts`: `normalizeResponses` | Usa título/tipo/posição atuais; pergunta ausente preserva valor com ID como rótulo, sem recuperar semântica |
| CSV individual | `exportNormalizedResponsesToCsv` | Cabeçalhos atuais e agrupamento por rótulo; ainda preserva o valor de opção removida. Rótulos repetidos também podem colidir; versionamento deve adotar chave por versão/ID |
| CSV genérico | `response-utils.ts`: `exportResponsesToCsv` | `question_titles` fornecidos pelo chamador ou ID; não há proveniência histórica desses rótulos |
| Feed | `feedback-metadata.ts` → `feedback-feed.ts`: `extractTextFeedback` | Só perguntas atualmente textuais conhecidas; título atual também controla exclusão de identificação. Texto antigo pode desaparecer ou ser reclassificado |
| Detalhe do feedback | `responses.ts`: `getCompanyFeedbackResponse` → normalização | Busca autorizada preservada, mas metadados são atuais |
| Contadores A3 | `company-response-counts.ts` | Contam registros brutos por pesquisa, sem interpretar opções; não requerem reconstrução semântica para esse conceito de contagem |

Paginação completa (A1–A6) comprova cobertura dos registros, não fidelidade dos
metadados. Em particular, uma exclusão por validade atual pode afetar o volume
analítico mesmo que todos os registros tenham sido lidos.

## Política proposta (depende de aprovação para adoção no produto)

Separar leitura bruta, interpretação comprovada e visualização pela configuração
atual. A interpretação histórica deve usar somente uma versão autoritativa
imutável explicitamente vinculada à resposta. Não usar o horário como vínculo
heurístico, nem aceitar snapshots enviados livremente pelo navegador como prova.

Estados necessários na futura camada compartilhada:

- `verified_history`: versão íntegra, vinculada à mesma pesquisa e empresa.
- `legacy_contract_only`: significado limitado ao payload legado fixo.
- `unknown_history`: valor existente, sem versão/proveniência confiável.
- `invalid_payload`: defeito estrutural demonstrável, independentemente da configuração atual.
- `no_answer`: ausência de valor, distinta de falha de origem e de histórico desconhecido.
- `error`: consulta, completude, vínculo ou autorização não puderam ser confirmados.

Uma avaliação só será inválida semanticamente **depois** da resolução da versão
correta; a validade atual pode ser exposta como diagnóstico separado, nunca como
substituta dessa prova. O contrato e tratamento de ratings legados de A7 continuam
explícitos e separados do consolidado, que hoje não os inclui.

| Alteração | Comportamento proposto |
| --- | --- |
| Texto/descrição/tópico | Nova versão guarda novos metadados; respostas antigas mantêm os originais |
| Renomeação de opção | Versão antiga mantém rótulo; manter ID lógico apenas se a equivalência semântica for deliberadamente confirmada; mudança de significado exige novo ID |
| Remoção de opção | Retirar apenas da nova versão; a antiga e suas contagens permanecem disponíveis |
| Adição de opção | Novo ID na nova versão; não criar essa alternativa retroativamente |
| Reordenação | Ordem gravada em cada versão; identidade e valor antigos permanecem |
| Tipo | Nova versão; sem converter valores antigos pelo novo tipo |
| Escala/polaridade | Escala e propósito explícitos por versão; separar séries incompatíveis, sem normalização inventada |
| Pergunta principal | Seleção gravada na versão. Métrica histórica usa a seleção daquela resposta; seleção atual não muda passado silenciosamente |

Para períodos com dados desconhecidos, não apresentar uma média/distribuição como
histórico completo: retornar estado explícito de cobertura desconhecida, contagem
de registros afetados e motivo. A visão de amostra comprovada, se aprovada, deve
mostrar numerador, denominador e exclusões. Não substituir desconhecidos por zero.
Volume bruto pode continuar separado da contagem de respostas semanticamente
válidas. Comparações devem bloquear ou sinalizar incompatibilidade entre versões.

Na lista/detalhe/CSV, preservar valores brutos e IDs mesmo sem semântica histórica,
com marcador de proveniência e sem atribuir título/tipo atual como original.
Colunas devem ser identificadas por versão/pergunta, não apenas pelo texto.
No feed, metadados desconhecidos também impedem provar que um texto não é dado
identificador: não expandir sua exposição automaticamente; revisão de privacidade
e exibição explícita de cobertura fazem parte do aceite.

## Alternativas avaliadas

| Alternativa | Correção histórica | Complexidade/custo | Compatibilidade e adoção |
| --- | --- | --- | --- |
| Versão imutável da pesquisa por publicação, FK por resposta | Forte para respostas vinculadas; inclui opções e principal juntos | Complexidade média/alta na publicação; armazena uma configuração por versão; leitura por lotes de versões | Recomendada. Schema novo e mudança de publicação/RPC/formulário; dados antigos continuam desconhecidos |
| Snapshot autoritativo completo por resposta | Forte se representa exatamente a configuração exibida e validada, não simplesmente a atual no instante de envio | Menos joins, alto custo repetido de armazenamento; ainda exige protocolo de versão contra formulário desatualizado | Nova coluna/payload, validação e limites de tamanho; não recupera passado |
| Histórico de eventos/diffs | Forte somente com captura completa, ordenação e vínculo transacional desde o início | Alto custo de reconstrução, auditoria e leitura; nenhuma infraestrutura apropriada encontrada | Útil como complemento; eventos não existentes não podem ser reconstruídos |
| IDs estáveis isoladamente | Não preservam título, escala ou principal | Baixo custo; IDs de opções exigiriam contrato novo | Necessários dentro de versões, insuficientes sozinhos |
| Bloquear edições após respostas | Evita parte das perdas futuras se imposto no banco; não resolve formulário concorrente ou passado perdido | Menor custo inicial, limita produto | Alternativa transitória que também exige decisão de produto e proteção persistente; não implementada |

Recomendação: **versões imutáveis por publicação**, com IDs lógicos de perguntas
e opções dentro de cada versão, seleção principal e definição semântica/escala
explícitas. Não pressupor que toda nota principal mede o mesmo conceito entre
versões. Agregar somente séries cuja compatibilidade tenha sido definida.

## Desenho persistente a revisar (não é migration)

- `survey_versions`: ID de versão, `survey_id`, vínculo da empresa, metadados
  completos da pesquisa, perguntas, IDs lógicos/IDs de versão, opções com IDs e
  rótulos, tipo, limites, polaridade, propósito, principal, versão do formato,
  proveniência e instante de publicação. Pode conter documento JSON validado ou
  tabelas filhas imutáveis; validar unicidade e referências no banco.
- `surveys.published_version_id`: ponteiro para versão publicada da mesma pesquisa.
  Edições passam a preparar rascunho, sem modificar a versão publicada.
- `responses.survey_version_id`: nullable para legado, FK composta que impeça
  associação a outra pesquisa; verificar também o vínculo de empresa. Não
  preencher linhas antigas com a versão atual. Definir restrições para impedir
  apagar/alterar versões referenciadas, inclusive via cascade.
- A nova RPC recebe o ID da versão exibida; consulta e valida exclusivamente essa
  versão autoritativa e grava seu ID junto à resposta. O cliente não fornece a
  configuração confiável. Opções novas usam IDs, preservando o rótulo na versão;
  não reinterpretar silenciosamente strings legadas como IDs.
- Publicação e submissão precisam compartilhar protocolo transacional/locks.
  Proposta conservadora: envio de versão desativada é rejeitado com pedido de
  atualização do formulário. Não associar resposta de formulário antigo à nova
  versão; repetição idempotente de envio já aceito devolve a versão original.
- Uma versão de contrato/RPC nova preserva compatibilidade explícita. Clientes
  sem ID de versão não podem ser rotulados como históricos verificados. Decidir
  entre janela transitória `unknown_history` e atualização obrigatória do cliente;
  esta decisão precisa preceder o rollout.
- RLS: autorização por empresa da pesquisa, não por ID de versão recebido do
  cliente; público acessa somente configuração publicada autorizada. Histórico
  de versões não deve ficar público indiscriminadamente. Não introduzir service
  role nos leitores para contornar RLS. Revisar políticas atuais que permitem
  consultar perguntas de pesquisas ativas para manter o escopo público esperado.
- Leitores completos carregam respostas e as versões referenciadas com paginação
  determinística e contagem verificável. Resolver em um módulo de domínio comum;
  não fazer uma consulta por resposta. Versão ausente/corrompida/fora de escopo
  produz estado explícito, sem fallback silencioso para perguntas atuais.

## Transição e aceite antes de executar mudanças

1. Aprovar política, versão por publicação e comportamento para formulários
   desatualizados, seleção principal histórica, exportação e métricas com lacunas.
2. Elaborar migrations e plano de rollback em revisão separada; testar constraints,
   RLS, integridade referencial e concorrência em DEV descartável autorizado.
3. Adicionar versões/ponteiros de modo compatível, sem reescrever respostas.
   Um snapshot inicial representa **somente o estado atual capturado**, com essa
   proveniência; nunca uma versão retroativa de todas as respostas anteriores.
4. Implementar rascunho/publicação, formulário e RPC de forma coordenada; provar
   submissão concorrente, idempotência e rejeição de referência cruzada.
5. Integrar resolução e estados em todos os consumidores da tabela acima. Na
   coexistência, explicitar a cobertura de versões e as limitações do legado;
   validar contratos de API/CSV antes de alterá-los.
6. Só importar histórico antigo de backups/auditoria externa com prova de origem,
   conteúdo íntegro e vínculo exato à resposta. Timestamp isolado ou decisão
   manual de que duas opções “parecem iguais” não é backfill confiável. Caso não
   haja fonte suficiente, manter estado desconhecido indefinidamente.
7. Validar volume, limites de API, memória, custo dos joins/lotes, RLS real e
   concorrência em ambiente autorizado antes de declarar validação operacional.

Aceite obrigatório: alterações nas oito categorias não mudam interpretação de
respostas vinculadas; desconhecidos são visíveis em todas as superfícies; nenhuma
métrica parcial é rotulada completa; isolamento comprovado; versões imutáveis e
vínculos são impostos no banco; leitores completos e regressão A1–A7 aprovados.
Fixtures de versões futuras não comprovam que essa infraestrutura existe hoje.

## Parte segura implementada e testes

`src/lib/response-history-audit.ts` recebe um conjunto já autorizado e completo,
sem fazer I/O. Não recebe perguntas atuais como prova. Distingue
`legacy_contract_only`, `unknown_history`, `no_answer`, `invalid_payload`; uma
falha de origem, duplicata ou registro fora da pesquisa devolve erro sem entradas
parciais. O diagnóstico não copia valores pessoais e não muda os dados recebidos.
Seu estado `assessed` significa somente diagnóstico executado, não histórico
resolvido nem autorização para apresentar KPIs completos. Não oferece suporte a
snapshots hipotéticos ou JSON arbitrário de cliente como fonte confiável.

`response-history-audit.test.ts` tem testes de diagnóstico seguro e de
**caracterização dos problemas atuais**. As expectativas de perda/reinterpretação
demonstram risco existente, não correção desse risco. Não foram removidos nem
enfraquecidos testes anteriores.

| Cenário solicitado | Evidência executável nesta entrega | O que permanece bloqueado |
| --- | --- | --- |
| Original disponível | Contrato legado fixo e fixture com metadados originais conhecidos apenas no teste | Resolver original dinâmico a partir de fonte persistente inexistente |
| Texto editado | Fixture mostra CSV/lista usando novo texto; diagnóstico mantém desconhecido | Exibição histórica com texto original |
| Renomeação/remoção | Extração exclui string antiga; CSV mantém valor bruto; diagnóstico não o chama historicamente inválido | Distribuição histórica fiel com opções antigas |
| Adição/reordenação | Valor bruto continua igual; configuração original não é inferida | Reconstruir lista/ordem originais sem versão |
| Tipo/escala | Mesmo JSON entra/sai de métricas segundo tipo atual; diagnóstico desconhecido | Interpretar pela escala original comprovada |
| Principal | Mesma amostra muda de média ao trocar seleção atual | Seleção histórica por versão e comparabilidade |
| Histórico ausente/incompleto | Estado desconhecido separado de vazio, payload estruturalmente inválido e erro | Estados expostos nos consumidores do produto |
| Legado | Contrato 1–5 reconhecido, sem associação dinâmica fabricada | Confirmar outras fontes legadas fora do repositório |
| Isolamento | Guarda de pesquisa e leitor simulado excluem pesquisa estrangeira | RLS real por empresa e versões futuras |
| Paginação/duplicatas | 1.201 respostas, limite simulado 73, 17 páginas; sem duplicação; falha intermediária não gera diagnóstico parcial | Concorrência real/snapshot transacional |
| A1–A7 | Regressão completa executada separadamente | Não equivale a certificação de produção |

Comandos de validação locais, sem instalação de dependências:

```text
node node_modules/vitest/vitest.mjs run src/lib/response-history-audit.test.ts src/lib/responses-completeness.test.ts src/lib/metrics/survey-satisfaction.test.ts src/lib/feedback-feed.test.ts src/lib/response-csv.test.ts --cache false --maxWorkers 2 --minWorkers 1
node node_modules/vitest/vitest.mjs run --cache false --maxWorkers 2 --minWorkers 1
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx --no-cache
git diff --check
```

Resultados finais executados:

| Verificação | Resultado |
| --- | --- |
| Baseline antes das edições | 506 aprovados, 31 arquivos |
| Direcionados (comando acima) | 124 aprovados, 5 arquivos |
| Novos testes de A8 | 40 aprovados |
| Suíte completa final | 546 aprovados, 32 arquivos; zero falhas |
| TypeScript | Exit 0 |
| ESLint | Exit 0 |
| `git diff --check` | Exit 0 |
| Preservação | SHA-256 dos 23 arquivos locais preexistentes registrados permaneceu igual, incluindo `package-lock.json` |

Apenas os três novos arquivos de A8 foram acrescentados. Não foram
executados testes SQL/pgTAP, migrations, seeds, submissões reais ou testes de
browser. Buscas iniciais por caminhos inferidos ausentes e curingas do PowerShell
falharam; a investigação prosseguiu pelos arquivos encontrados com `rg`.

## Decisão pendente

O pedido de A8, seção 4, exige apresentar proposta antes de alterar schema ou
publicação. A aprovação deve cobrir: versões imutáveis por publicação, principal
vigente por versão, rejeição de formulário desatualizado e tratamento visível de
dados sem histórico. Alterações de contratos externos e plano de rollout também
precisam ser revisados. Esta entrega não solicita executar migrations nem assume
essa autorização. A proteção futura não recuperará automaticamente o passado.
