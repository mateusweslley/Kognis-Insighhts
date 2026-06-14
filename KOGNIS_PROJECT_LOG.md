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

## Sprint 4 - Modulo de Pesquisas

Status: implementada e pronta para validacao manual.

Objetivo:
- Permitir que a empresa autenticada crie, liste, edite e arquive pesquisas.

Entregas:
- Criada tela funcional em `/pesquisas` com listagem por empresa.
- Adicionado estado vazio com acao para criar a primeira pesquisa.
- Implementado formulario de criacao com titulo, descricao e status.
- Implementada edicao de titulo, descricao e status.
- Implementado arquivamento alterando `status` para `archived`, sem delete fisico.
- Botao e icone de adicionar do dashboard passam a levar para `/pesquisas`.

Tabela criada:
- `public.surveys`, com `company_id`, `title`, `description`, `status`, `created_at` e `updated_at`.

Regras de seguranca:
- RLS ativa em `public.surveys`.
- Select, insert e update permitidos apenas quando a pesquisa pertence a uma empresa cujo `owner_id` e o `auth.uid()`.
- Nao ha policy de delete para pesquisas; arquivamento e feito por update de status.
- Nenhuma service role key foi adicionada ao front-end.

Criterios de teste:
- Criar uma pesquisa e ver na listagem.
- Editar titulo, descricao e status.
- Arquivar uma pesquisa.
- Recarregar e confirmar persistencia dos dados.
- Entrar com uma segunda conta e confirmar que ela nao ve pesquisas da primeira.

Validacoes executadas:
- `npx tsc --noEmit`
- `npm run lint`

Pontos de atencao:
- O SQL de `supabase/surveys.sql` precisa ser aplicado no Supabase antes do teste funcional completo.
- `npm run build` foi executado, mas o ambiente bloqueou o acesso ao Google Fonts usado por `next/font`.

## Sprint 4.1 - Ajuste de UX do Dashboard

Status: implementada e pronta para validacao manual.

Objetivo:
- Fazer o dashboard reconhecer quando a empresa ja possui pesquisas e adaptar o conteudo exibido.

Entregas:
- Dashboard passa a buscar pesquisas da empresa logada.
- Usuario sem pesquisas continua vendo o estado vazio com `Criar primeira pesquisa`.
- Usuario com pesquisas ve CTA `Ver pesquisas`, resumo por status e ate 3 pesquisas recentes.
- Mantido aviso de que metricas reais dependem de respostas futuras.
- Placeholders especificos foram trocados por exemplos genericos.

Criterios de teste:
- Usuario sem pesquisa ve `Criar primeira pesquisa`.
- Usuario com pesquisa nao ve mais `Criar primeira pesquisa`.
- Usuario com pesquisa ve total, ativas, rascunhos e arquivadas.
- Botao do dashboard navega para `/pesquisas`.
- Recarregar o dashboard mantem o estado correto.

Validacoes executadas:
- `npx tsc --noEmit`
- `npm run lint`

Pontos de atencao:
- `npm run build` foi executado, mas o ambiente local bloqueou o acesso ao Google Fonts e a escrita em `.next/trace`.

## Sprint 4.2 - Responsividade, Navegacao e Refinamento de UX

Status: implementada e pronta para validacao manual.

Objetivo:
- Refinar a experiencia da aplicacao antes da Sprint 5, corrigindo navegacao, responsividade e elementos sem acao.

Correcoes realizadas:
- Menu lateral passa a abrir e fechar em telas menores, com overlay, clique fora para fechar e animacao suave.
- Logo da Kognis passa a navegar para `/dashboard`.
- Botao `Landing` foi substituido por `Inicio`, apontando para `/dashboard`.
- Campo de busca sem funcionalidade foi removido para evitar falsa interacao.
- Botao de notificacoes sem acao foi removido.
- Estados vazios nao exibem mais CTA quando nao ha acao real.
- Botoes e cards de pesquisas foram ajustados para melhor comportamento em mobile.
- Revisados placeholders e textos visiveis para remover dados ficticios especificos.

Criterios de validacao:
- Sidebar abre e fecha em mobile e tablet.
- Clique fora da sidebar fecha o menu.
- Logo e botao `Inicio` navegam para `/dashboard`.
- Nao ha busca falsa nem botoes sem acao.
- Dashboard, Pesquisas, Configuracoes e Onboarding permanecem responsivos.
- Nao ha dados ficticios especificos visiveis para o usuario final.

Validacoes executadas:
- `npx tsc --noEmit`
- `npm run lint`

Pontos de atencao:
- Nao havia servidor local respondendo em `localhost:3000` para validacao visual no navegador.
- `npm run build` foi executado, mas o ambiente local bloqueou o acesso ao Google Fonts usado por `next/font`.

## Sprint 5 - Respostas Publicas e Exportacao CSV

Status: aprovada e pronta para merge em `main`.

Objetivo:
- Permitir que pesquisas ativas recebam respostas anonimas por link publico e que a empresa visualize/exporte essas respostas.

Entregas:
- Criado SQL da tabela `public.responses`.
- Criada rota publica `/participar/[surveyId]`.
- Criado formulario publico com nome, e-mail, nota e comentario.
- Respostas sao salvas em `responses.answers` como JSON.
- Tela `/respostas` foi transformada em painel real com total por pesquisa, ultimas respostas e exportacao CSV.
- Pesquisas exibem link publico para participacao.
- Dashboard recebeu contador simples de respostas recebidas.

Tabela criada:
- `public.responses`, com `survey_id`, `answers` e `created_at`.

Regras de seguranca:
- RLS ativa em `public.responses`.
- Visitantes anonimos podem inserir resposta apenas em pesquisas ativas.
- Usuarios autenticados podem visualizar apenas respostas de pesquisas da propria empresa.
- Nao foram criadas policies publicas de update ou delete.
- Foi adicionada policy de leitura publica apenas para pesquisas ativas, necessaria para a rota publica validar e exibir pesquisas respondiveis.

Criterios de teste:
- Pesquisa ativa abre em `/participar/[surveyId]`.
- Visitante anonimo consegue enviar resposta.
- Pesquisa em rascunho ou arquivada nao aceita resposta.
- Dono da empresa ve respostas em `/respostas`.
- Exportacao CSV baixa os campos `id`, `survey_id`, `name`, `email`, `rating`, `comment` e `created_at`.
- Outro usuario nao visualiza respostas de empresa alheia.

Validacoes executadas:
- `npx tsc --noEmit`
- `npm run lint`

Pontos de atencao:
- O SQL de `supabase/responses.sql` precisa ser aplicado no Supabase antes do teste funcional completo.
- `npm run build` foi executado, mas o ambiente local bloqueou o acesso ao Google Fonts usado por `next/font`.

Fora de escopo:
- Campanhas.
- QR Code.
- IA.
- Cobranca.
- Multiusuario.

## Sprint 6.1 - Modulo de Campanhas

Status: implementada e pendente de validacao manual com Supabase.

Objetivo:
- Permitir que a empresa crie, liste, edite e arquive campanhas, com vinculo opcional a pesquisas existentes.

Entregas:
- Criado SQL da tabela `public.campaigns`.
- Criada camada de dados para campanhas.
- Criados tipos de campanha.
- Tela `/campanhas` deixou de ser placeholder e passou a permitir criacao, edicao, listagem e arquivamento.
- Campanhas podem ser vinculadas a pesquisas da propria empresa.
- Dashboard recebeu contador simples de campanhas.

Tabela criada:
- `public.campaigns`, com `company_id`, `survey_id`, `name`, `description`, `status`, `created_at` e `updated_at`.

Regras de seguranca:
- RLS ativa em `public.campaigns`.
- Usuarios autenticados podem criar, listar e editar apenas campanhas da propria empresa.
- Vinculo com pesquisa e aceito apenas quando a pesquisa tambem pertence a empresa do usuario.
- Nao ha delete fisico; arquivamento e feito por status `archived`.

Criterios de teste:
- Criar campanha sem pesquisa vinculada.
- Criar campanha vinculada a uma pesquisa.
- Editar nome, descricao, pesquisa e status.
- Arquivar campanha.
- Confirmar que outro usuario nao ve campanhas de empresa alheia.
- Confirmar contador de campanhas no dashboard.

Validacoes executadas:
- `npx tsc --noEmit`
- `npm run lint`

Pontos de atencao:
- O SQL de `supabase/campaigns.sql` precisa ser aplicado no Supabase antes do teste funcional completo.
- `npm run build` foi executado, mas o ambiente local bloqueou o acesso ao Google Fonts usado por `next/font`.

Fora de escopo:
- QR Code.
- Download PNG.
- Analytics.
- Dashboard avancado.
- IA, cobranca, multiusuario, CRM e WhatsApp.

## Sprint 6.2 - QR Code e Link Publico das Pesquisas

Status: implementada e pendente de validacao manual completa no navegador.

Objetivo:
- Permitir que uma empresa distribua pesquisas por QR Code e link publico, mantendo a pesquisa como entidade principal do MVP.

Entregas:
- Criado componente de QR Code para pesquisas.
- Adicionada acao "QR Code" na listagem de pesquisas.
- QR Code aponta para `/participar/[surveyId]`.
- Link publico e exibido para copia manual.
- Botao "Copiar link" copia a URL publica para a area de transferencia.
- Botao "Baixar PNG" gera arquivo PNG do QR Code.
- Status das pesquisas receberam rotulos mais claros para o usuario final:
  - `active`: Recebendo respostas.
  - `draft`: Em preparacao.
  - `archived`: Encerrada.
- Pagina publica de participacao recebeu rodape simples "Powered by Kognis Insights".

Banco de dados:
- Nenhuma tabela, coluna, constraint, trigger ou policy RLS foi alterada nesta sprint.
- O QR Code usa o identificador publico da pesquisa e reaproveita o fluxo existente de `/participar/[surveyId]`.

Regras de seguranca:
- A regra de acesso publico continua na pagina de participacao e nas policies ja existentes.
- Pesquisas `active` continuam aceitando respostas.
- Pesquisas `draft` e `archived` continuam bloqueadas para resposta.
- Campanhas nao controlam acesso ao QR Code nem ao link publico.

Criterios de teste:
- Abrir `/pesquisas` autenticado.
- Clicar em "QR Code" em uma pesquisa.
- Conferir se o QR aponta para `/participar/[surveyId]`.
- Copiar o link e abrir em outra aba.
- Baixar o PNG e confirmar que o arquivo foi gerado.
- Confirmar que pesquisa ativa aceita resposta.
- Confirmar que pesquisa em preparacao ou encerrada mostra pesquisa indisponivel.
- Validar layout em desktop e celular.

Validacoes executadas:
- `npm run lint`
- `npx tsc --noEmit --incremental false`
- `npm run build` foi tentado, mas falhou pelo bloqueio de acesso ao Google Fonts usado por `next/font`.

Pontos de atencao:
- A Sprint 6.1 ainda possui arquivos nao commitados no workspace.
- `npm run build` pode continuar falhando neste ambiente por bloqueio de acesso ao Google Fonts usado por `next/font`.

Fora de escopo:
- QR personalizado.
- Logo dentro do QR.
- Rastreamento de escaneamento.
- Analytics, UTM, IA, Stripe e assinaturas.
- Campanha controlando acesso a pesquisa.
- Dashboard avancado.

Decisao arquitetural:
- O QR Code pertence a pesquisa.

Motivo:
- A pesquisa e a entidade principal do MVP e ja possui pagina publica de resposta.

Alternativas consideradas:
- Vincular QR Code a campanhas.
- Criar uma pagina separada para geracao de QR Code.

Escolha:
- Manter o QR Code na listagem de pesquisas e apontar diretamente para `/participar/[surveyId]`.

## Sprint 7.1 - Construtor de Pesquisas

Status: implementada e pendente de validacao manual completa no navegador com Supabase atualizado.

Objetivo:
- Criar a primeira versao do Construtor de Pesquisas do Kognis.
- Permitir que empresas criem e organizem perguntas personalizadas por pesquisa.
- Manter a pagina publica atual, o QR Code, as respostas e a exportacao CSV sem alteracao funcional.

Entregas:
- Criada tabela `public.survey_questions` em `supabase/survey_questions.sql`.
- Criados tipos de perguntas em `src/types/survey-question.ts`.
- Criada camada de dados em `src/lib/survey-questions.ts`.
- Criados templates nativos em `src/lib/survey-question-templates.ts`.
- Criado componente `src/components/surveys/question-builder.tsx`.
- Tela de pesquisas passa a perguntar "O que voce deseja descobrir?" ao criar nova pesquisa.
- Templates iniciais:
  - Conhecer meu cliente.
  - Avaliar uma compra.
  - Avaliar um produto.
  - Comecar do zero.
- Ao criar uma pesquisa com template, as perguntas sugeridas sao salvas automaticamente.
- Pesquisas existentes ganharam acao "Perguntas".
- Editor permite adicionar, editar, excluir e reordenar perguntas com botoes Subir/Descer.
- Editor permite marcar "Resposta obrigatoria".
- Tipos implementados na Sprint 7.1:
  - `short_text`.
  - `long_text`.
  - `single_choice`.
  - `rating`.

Banco de dados:
- Nova tabela: `public.survey_questions`.
- Campos:
  - `id uuid primary key default gen_random_uuid()`.
  - `survey_id uuid not null references public.surveys(id) on delete cascade`.
  - `type text not null`.
  - `title text not null`.
  - `description text`.
  - `required boolean default false`.
  - `position integer not null`.
  - `options jsonb default '[]'::jsonb`.
  - `created_at timestamptz default now()`.
  - `updated_at timestamptz default now()`.
- Constraints:
  - Tipos permitidos: `short_text`, `long_text`, `single_choice`, `rating`.
  - Titulo com minimo de 2 caracteres.
  - `position >= 1`.
  - `options` deve ser array JSON.
- Trigger:
  - `survey_questions_set_updated_at`, usando `public.set_updated_at()`.

Regras de seguranca:
- RLS ativa em `public.survey_questions`.
- Usuarios autenticados podem listar, criar, editar e excluir perguntas apenas quando a pesquisa pertence a uma empresa cujo `owner_id` e o `auth.uid()`.
- A relacao de seguranca segue o caminho:
  - `survey_questions.survey_id`.
  - `surveys.company_id`.
  - `companies.owner_id`.

Criterios de teste:
- Criar pesquisa usando "Conhecer meu cliente" e confirmar perguntas sugeridas.
- Criar pesquisa usando "Avaliar uma compra" e confirmar perguntas sugeridas.
- Criar pesquisa usando "Avaliar um produto" e confirmar perguntas sugeridas.
- Criar pesquisa usando "Comecar do zero" e confirmar que inicia sem perguntas.
- Abrir "Perguntas" em uma pesquisa existente.
- Adicionar pergunta de texto curto.
- Adicionar pergunta de texto longo.
- Adicionar pergunta de escolha unica com pelo menos duas opcoes.
- Adicionar pergunta de nota de 1 a 5.
- Editar pergunta existente.
- Excluir pergunta.
- Mover pergunta para cima e para baixo.
- Marcar e desmarcar "Resposta obrigatoria".
- Confirmar que `/participar/[surveyId]` continua exibindo o formulario fixo atual.
- Confirmar que QR Code continua apontando para `/participar/[surveyId]`.
- Confirmar que respostas atuais e CSV continuam funcionando.

Validacoes executadas:
- `npx tsc --noEmit --incremental false`.
- `npm run build` foi tentado, mas falhou antes da compilacao por bloqueio de rede ao baixar Google Fonts via `next/font`.

Bugs encontrados:
- O ambiente local bloqueia o acesso a `fonts.googleapis.com`, impedindo `npm run build`.
- O TypeScript tentou criar `tsconfig.tsbuildinfo` durante `npx tsc --noEmit`; a validacao foi refeita com `--incremental false`.

Pontos de atencao:
- O SQL de `supabase/survey_questions.sql` precisa ser aplicado no Supabase antes do teste funcional completo.
- A Sprint 7.1 nao renderiza perguntas personalizadas na pagina publica.
- A criacao por template depende da nova tabela existir no Supabase.
- O workspace possuia alteracoes nao commitadas anteriores a esta sprint; elas nao foram revertidas.

Fora de escopo:
- Pagina publica dinamica.
- Renderizacao dos novos tipos na resposta publica.
- Multipla escolha.
- Dropdown.
- NPS.
- Upload de arquivos.
- Logica condicional.
- IA.
- Dashboard inteligente.
- Analytics.
- Drag-and-drop.
- Campanhas avancadas.

Decisao arquitetural:
- As perguntas pertencem diretamente a pesquisa.

Motivo:
- A pesquisa continua sendo a entidade principal do MVP.
- A Sprint 7.1 cria apenas estrutura, experiencia de criacao e persistencia das perguntas.

Alternativas consideradas:
- Criar um novo conceito de formulario separado da pesquisa.
- Renderizar perguntas dinamicas ja nesta sprint.
- Incluir mais tipos de pergunta na V1.

Escolha:
- Manter o vocabulario em "Pesquisa", "Pergunta", "Resposta", "Opcoes" e "Obrigatoria".
- Criar uma V1 pequena com quatro tipos de pergunta.
- Deixar a pagina publica dinamica para a Sprint 7.2.

Sugestao de commit:
- `[SPRINT 7.1] Implementa construtor de pesquisas`

## Sprint 7.2 - Pesquisa Publica Dinamica

Status: implementada e pendente de validacao manual completa no navegador com Supabase atualizado.

Objetivo:
- Fazer `/participar/[surveyId]` renderizar perguntas cadastradas em `survey_questions`.
- Salvar respostas dinamicas usando `question_id` como chave.
- Manter compatibilidade com pesquisas antigas que ainda nao possuem perguntas cadastradas.

Entregas:
- Criado formulario publico dinamico para perguntas de pesquisa.
- Pagina publica agora busca perguntas da pesquisa ativa.
- Perguntas sao exibidas ordenadas por `position`.
- Pesquisas sem perguntas continuam usando o formulario legado.
- Respostas dinamicas sao salvas em `responses.answers` no formato:
  - `mode: "dynamic"`.
  - `answers: { [question_id]: valor }`.
- Tipos renderizados:
  - `short_text` como input de texto.
  - `long_text` como textarea.
  - `single_choice` como radio buttons.
  - `rating` como escala de 1 a 5.
- Perguntas obrigatorias bloqueiam envio quando vazias.
- `single_choice` aceita apenas opcoes cadastradas.
- `rating` aceita apenas numeros inteiros de 1 a 5.
- Editor de perguntas ganhou botao "Ver como o cliente vera".
- Exportacao CSV foi ajustada para respostas legadas e dinamicas.
- Tela de respostas passou a exibir resumo seguro para respostas legadas e dinamicas.

Banco de dados:
- Nenhuma nova tabela foi criada nesta sprint.
- `supabase/survey_questions.sql` foi atualizado com policy publica de leitura.
- Nova policy:
  - `"Public can view active survey questions"`.
  - Permite `select` para `anon, authenticated`.
  - Retorna apenas perguntas vinculadas a pesquisas com `status = 'active'`.

Regras de seguranca:
- A pagina publica nao depende de usuario autenticado.
- Perguntas de pesquisas `draft` e `archived` nao sao expostas publicamente.
- Criacao, edicao e exclusao de perguntas continuam restritas ao dono da empresa.
- Respostas continuam sendo inseridas apenas para pesquisas ativas pelas policies existentes de `responses`.

Criterios de teste:
- Pesquisa antiga sem perguntas deve continuar usando formulario legado.
- Pesquisa com perguntas deve renderizar formulario dinamico.
- Perguntas aparecem na ordem de `position`.
- Pergunta obrigatoria vazia bloqueia envio.
- Texto curto salva string.
- Texto longo salva string.
- Escolha unica salva uma opcao cadastrada.
- Nota salva numero de 1 a 5.
- Resposta dinamica salva usando `question_id`.
- QR Code continua abrindo `/participar/[surveyId]`.
- Preview abre `/participar/[surveyId]` em nova aba.
- Pesquisa `draft` continua bloqueada.
- Pesquisa `archived` continua bloqueada.
- Exportacao CSV nao quebra com respostas legadas nem dinamicas.

Validacoes executadas:
- `npx tsc --noEmit --incremental false`.
- `npx eslint "src/**/*.{ts,tsx}" --no-cache`.
- `npm run lint` foi tentado, mas o cache local do Next em `.next/cache/eslint` retornou `EPERM`.
- `npm run build` foi tentado, mas falhou por bloqueio de acesso ao Google Fonts usado por `next/font`.

Pontos de atencao:
- O SQL atualizado de `supabase/survey_questions.sql` precisa ser aplicado no Supabase.
- O workspace possui alteracoes nao commitadas de sprints anteriores; elas nao foram revertidas.
- `npm run build` pode falhar neste ambiente por bloqueio ao Google Fonts usado por `next/font`.

Fora de escopo:
- Dashboard dinamico.
- IA.
- NPS.
- Multipla escolha.
- Dropdown.
- Upload de arquivos.
- Logica condicional.
- Campanhas.
- Analytics.
- Segmentacao.
- Migracao automatica de pesquisas antigas.

Decisao arquitetural:
- Respostas dinamicas usam `question_id` como chave real.

Motivo:
- O titulo da pergunta pode mudar, mas o `question_id` preserva a referencia tecnica da resposta.

Alternativas consideradas:
- Usar o titulo da pergunta como chave.
- Migrar pesquisas antigas para o novo formato.
- Criar uma nova tabela de respostas por pergunta.

Escolha:
- Salvar o JSON dinamico dentro de `responses.answers`, mantendo compatibilidade com respostas legadas.

Sugestao de commit:
- `[S7.2] Implementada pesquisa publica dinamica`

## Sprint 7.3 - Visualizacao Operacional de Respostas

Status: implementada e pendente de validacao manual completa no navegador com Supabase atualizado.

Objetivo:
- Permitir que empresas visualizem claramente as respostas recebidas dentro da plataforma.
- Responder, de forma operacional:
  - Quem respondeu.
  - Quando respondeu.
  - O que respondeu.

Entregas:
- Criada camada de normalizacao de respostas.
- Respostas legadas e dinamicas passam a ser transformadas em um formato comum.
- `/respostas` passa a listar pesquisas com contagem de respostas e acao "Ver respostas".
- Criada rota `/respostas/[surveyId]`.
- A rota da pesquisa carrega apenas respostas daquela pesquisa.
- Lista operacional mostra data, respondente, resumo e acao "Ver detalhes".
- Detalhe da resposta exibe todos os campos normalizados.
- Respondente anonimo recebe identificacao operacional como `Resposta #1`.
- Criada exportacao CSV por pesquisa.
- CSV por pesquisa usa a camada de normalizacao.
- A estrutura fica preparada para paginacao futura.

Banco de dados:
- Nenhuma nova tabela foi criada.
- Nenhuma coluna foi alterada.
- Nenhuma policy RLS foi alterada nesta sprint.

Regras de seguranca:
- `/respostas` e `/respostas/[surveyId]` exigem usuario autenticado.
- A pesquisa exibida em `/respostas/[surveyId]` precisa pertencer a empresa logada.
- As respostas continuam protegidas pelas policies existentes de `responses`.
- Nao ha exposicao de respostas de outras empresas.

Criterios de teste:
- `/respostas` lista pesquisas da empresa logada.
- Cada pesquisa mostra quantidade de respostas.
- Botao "Ver respostas" abre `/respostas/[surveyId]`.
- Pesquisa sem respostas mostra estado vazio.
- Pesquisa com respostas mostra lista operacional.
- Respostas legadas aparecem sem quebrar.
- Respostas dinamicas aparecem sem quebrar.
- "Ver detalhes" abre todos os campos da resposta.
- CSV por pesquisa baixa apenas respostas da pesquisa atual.
- Usuario A nao acessa respostas do Usuario B.

Validacoes executadas:
- `npx tsc --noEmit --incremental false`.
- `npx eslint "src/**/*.{ts,tsx}" --no-cache`.
- `npm run lint` foi tentado, mas o cache local do Next em `.next/cache/eslint` retornou `EPERM`.
- `npm run build` foi tentado, mas falhou por bloqueio de acesso ao Google Fonts usado por `next/font`.

Pontos de atencao:
- O workspace possui alteracoes nao commitadas de sprints anteriores; elas nao foram revertidas.
- A validacao manual no navegador depende do Supabase atualizado e de dados de teste.
- A listagem usa contagem simples por pesquisa e esta pronta para evoluir para paginacao/aggregate no banco.

Fora de escopo:
- Dashboard.
- Graficos.
- Percentuais.
- IA.
- Analytics.
- Comparacao entre pesquisas.
- Insights automaticos.
- Filtros avancados.
- Segmentacao.

Decisao arquitetural:
- Toda exibicao operacional de respostas deve consumir uma resposta normalizada.

Motivo:
- Evitar duplicacao de logica entre lista, detalhe, CSV e futuro dashboard.
- Manter compatibilidade entre respostas legadas e dinamicas.

Alternativas consideradas:
- Criar renderizadores separados para respostas legadas e dinamicas.
- Transformar respostas dinamicas diretamente no componente de tela.
- Criar uma rota individual para cada resposta.

Escolha:
- Criar `src/lib/response-normalizer.ts` e usar modal de detalhe dentro de `/respostas/[surveyId]`.

Sugestao de commit:
- `[S7.3] Implementada visualizacao operacional de respostas`

## Sprint 7.4 - Consolidacao Operacional

Status: implementada e pendente de validacao manual completa no navegador.

Objetivo:
- Melhorar o uso diario do Kognis antes de iniciar dashboards e analytics.
- Consolidar busca de pesquisas, CSV orientado para negocio e preview administrativo.

Entregas:
- Adicionado campo "Buscar pesquisa..." em `/respostas`.
- Busca filtra pesquisas por titulo e descricao em tempo real.
- CSV por pesquisa passou a ser orientado para negocio.
- CSV normalizado remove `question_id`, `survey_id`, `response_id` e identificadores internos.
- Colunas do CSV seguem a ordem das perguntas por `position`.
- Perguntas sem resposta continuam aparecendo como colunas com celulas vazias.
- Criada rota administrativa `/pesquisas/[surveyId]/preview`.
- Preview administrativo exige usuario autenticado e empresa vinculada.
- Preview usa os mesmos componentes de formulario publico em modo sem envio.
- Preview nao salva respostas e nao cria registros em `responses`.
- Botao "Ver como o cliente vera" passou a abrir o preview administrativo.
- Camada de busca de respostas por pesquisa foi preparada para futura paginacao com `limit`, `offset` e `cursor`.

Banco de dados:
- Nenhuma tabela foi criada.
- Nenhuma coluna foi alterada.
- Nenhuma policy RLS foi alterada nesta sprint.
- Nenhuma migration nova e necessaria.

Regras de negocio:
- Preview e exclusivamente administrativo.
- Preview nao permite resposta real.
- Pesquisas `draft`, `active` e `archived` podem ser visualizadas pela empresa no preview.
- Consumidor continua respondendo apenas pela rota publica `/participar/[surveyId]`.
- Pesquisa `active` continua respondendo publicamente.
- Pesquisa `draft` continua bloqueada para consumidor.
- Pesquisa `archived` continua indisponivel ao publico.
- CSV padrao e orientado para negocio; exportacao tecnica fica fora do escopo.

Criterios de teste:
- Buscar pesquisa por titulo em `/respostas`.
- Buscar pesquisa por descricao em `/respostas`.
- Confirmar que cards sao filtrados em tempo real.
- Abrir `/pesquisas/[surveyId]/preview` logado.
- Confirmar que preview mostra pesquisa em rascunho.
- Confirmar que preview mostra pesquisa ativa.
- Confirmar que preview mostra pesquisa arquivada.
- Confirmar que preview nao exibe botao de envio real.
- Confirmar que preview nao cria respostas.
- Exportar CSV em `/respostas/[surveyId]`.
- Confirmar que CSV nao possui IDs tecnicos.
- Confirmar que CSV respeita `position`.
- Confirmar que campo nao respondido sai como celula vazia.

Validacoes executadas:
- `npx tsc --noEmit --incremental false`.
- `npx eslint "src/**/*.{ts,tsx}" --no-cache`.
- `npm run lint` foi tentado, mas o cache local do Next em `.next/cache/eslint` retornou `EPERM`.
- `npm run build` foi tentado, mas falhou por bloqueio de acesso ao Google Fonts usado por `next/font`.

Pontos de atencao:
- O workspace possui alteracoes nao commitadas de sprints anteriores; elas nao foram revertidas.
- A validacao manual no navegador depende de dados reais de pesquisas e respostas.
- Drag and Drop permaneceu fora desta sprint e deve ficar no backlog.

Fora de escopo:
- Dashboard.
- Analytics.
- IA.
- Insights automaticos.
- NPS.
- Campanhas avancadas.
- Segmentacao.
- Exportacao tecnica.
- Busca dentro de respostas individuais.
- Snapshot historico de perguntas.
- Drag and Drop.
- Paginacao visual.

Decisao arquitetural:
- Preview administrativo foi implementado em rota separada: `/pesquisas/[surveyId]/preview`.

Motivo:
- Separar claramente regras administrativas das regras publicas de `/participar/[surveyId]`.
- Evitar que preview gere respostas falsas ou interfira em metricas futuras.

Alternativas consideradas:
- Usar `/participar/[surveyId]?preview=true`.
- Reaproveitar a rota publica com condicionais por query string.

Escolha:
- Criar rota administrativa protegida e reutilizar os componentes de formulario em modo `isPreview`.

Sugestao de commit:
- `[S7.4] Consolidada operacao de respostas e preview`

## Versionamento Git

Status: configurado.

Padrao definido:
- `main` para versao estavel.
- `develop` para desenvolvimento diario.
- Commits no formato `[SPRINT] Descricao objetiva da entrega`.

Regra de fluxo:
- Toda sprint principal usa a branch de trabalho `develop`.
- Sub-sprints, como Sprint 4.1, 4.2 e 4.3, permanecem em `develop` e nao geram merge para `main`.
- O merge `develop` -> `main` acontece apenas quando a sprint principal estiver validada.
- Antes de iniciar uma nova sprint principal, validar a sprint anterior, atualizar a documentacao, realizar merge para `main` e criar o commit final da sprint.
- Ao iniciar uma nova sprint principal, registrar no log o objetivo e as entregas previstas.
- `main` nunca deve receber codigo nao testado, funcionalidades parciais, features experimentais ou correcoes temporarias.

Cuidados:
- `.env.local`, `.env`, `.next`, `node_modules`, `.vercel`, `dist`, `build`, `.vscode` e caches locais ficam fora do versionamento.
