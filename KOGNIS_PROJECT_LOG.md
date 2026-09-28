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

## Sprint 7.5A - Sinais de Prototipo

Status: implementada e pendente de validacao manual final no navegador.

Objetivo:
- Remover sinais de produto em construcao.
- Melhorar a percepcao de maturidade do sistema sem criar funcionalidades novas.

Entregas:
- Landing Page passou a diferenciar visitante e usuario autenticado.
- Visitante ve `Entrar` e `Criar conta`.
- Usuario autenticado ve apenas `Abrir painel`.
- Campo `Empresa` foi removido do cadastro.
- Empresa continua sendo criada exclusivamente no onboarding.
- Landing removeu referencias a roadmap interno e modulo futuro.
- Dashboard removeu texto sobre proximas sprints.
- Configuracoes removeu referencia a sprint futura.
- Exclusao de perguntas ganhou confirmacao antes de executar a acao.
- Textos visiveis tocados nesta sprint foram revisados para reduzir sensacao de prototipo.

Banco de dados:
- Nenhuma tabela foi criada.
- Nenhuma coluna foi alterada.
- Nenhuma policy RLS foi alterada.
- Nenhuma migration nova e necessaria.

Regras de negocio:
- Cadastro cria apenas a conta do usuario.
- Cadastro da empresa permanece no onboarding.
- Landing nao mostra `Entrar` ou `Criar conta` para usuario autenticado.
- Exclusao de pergunta so acontece apos confirmacao do usuario.
- Nenhuma metrica, dashboard analitico, campanha, template ou fluxo novo foi criado.

Criterios de teste:
- Abrir `/` sem sessao e confirmar botoes `Entrar` e `Criar conta`.
- Abrir `/` autenticado e confirmar apenas `Abrir painel`.
- Abrir `/cadastro` e confirmar que nao existe campo `Empresa`.
- Abrir `/dashboard` e confirmar que nao ha texto sobre proximas sprints.
- Abrir `/configuracoes` e confirmar que nao ha texto sobre sprint futura.
- Abrir construtor de perguntas e confirmar que `Excluir` pede confirmacao.
- Cancelar confirmacao e confirmar que a pergunta permanece.
- Confirmar exclusao e validar que o fluxo existente continua funcionando.

Validacoes executadas:
- `npx tsc --noEmit --incremental false`.
- `npx eslint "src/**/*.{ts,tsx}" --no-cache`.
- `npm run lint` foi tentado, mas o cache local do Next em `.next/cache/eslint` retornou `EPERM`.
- `npm run build` foi tentado, mas falhou por bloqueio de acesso ao Google Fonts usado por `next/font`.

Pontos de atencao:
- A Sprint 7.5A nao tratou redesign, dashboard analitico, branding, upload de logo, recuperacao de senha, perfil, avatar ou multiusuario.
- Algumas mensagens tecnicas internas de erro do Supabase ainda mencionam aplicacao de SQL; elas nao foram alteradas por nao fazerem parte do fluxo normal do usuario final.

Fora de escopo:
- Dashboard analitico.
- Landing Page comercial definitiva.
- Branding.
- Nova copy comercial.
- Templates.
- Agency Mode.
- Campanhas.
- Distribuicao.
- IA.
- Upload de logo.
- Recuperacao de senha.
- Perfil de usuario.
- Avatar.
- Multiusuario.
- Novas tabelas.
- Refatoracao estrutural.

Decisao arquitetural:
- A sprint manteve a arquitetura existente e aplicou apenas ajustes de interface e microcopy.

Motivo:
- O objetivo era remover sinais de prototipo sem aumentar o escopo do MVP.

Alternativas consideradas:
- Redesenhar landing.
- Criar perfil/avatar.
- Implementar recuperacao de senha.

Escolha:
- Corrigir apenas inconsistencias visiveis e manter temas maiores para sprints futuras.

Sugestao de commit:
- `[S7.5A] Removidos sinais de prototipo da interface`

## Sprint 7.5B - Comunicação e Consistência

Status: implementada e pendente de validação manual final no navegador.

Objetivo:
- Melhorar a comunicação do produto.
- Padronizar nomenclaturas visíveis ao usuário.
- Eliminar pequenas inconsistências de texto sem criar funcionalidades novas.

Entregas:
- Corrigida acentuação de textos visíveis em Pesquisas, Perguntas, Respostas, QR Code, Configurações de empresa e página pública.
- Status de pesquisa em rascunho passou de `Em preparacao` para `Em preparação`.
- Ação de pesquisa arquivada foi padronizada para linguagem de encerramento: botão `Encerrar`, mensagem `Pesquisa encerrada` e status `Encerrada`.
- Dashboard passou a exibir o contador de pesquisas encerradas como `Encerradas`.
- QR Code passou a exibir aviso contextual quando a pesquisa não está ativa: `Esta pesquisa não está recebendo respostas públicas no momento.`
- Nome do arquivo CSV passou a usar slug do título da pesquisa, no formato `respostas-nome-da-pesquisa.csv`.
- Conteúdo, colunas e estrutura do CSV não foram alterados.

Banco de dados:
- Nenhuma tabela foi criada.
- Nenhuma coluna foi alterada.
- Nenhuma policy RLS foi alterada.
- Nenhuma migration nova é necessária.

Regras de negócio:
- Pesquisas `active` continuam recebendo respostas públicas.
- Pesquisas `draft` e `archived` continuam bloqueadas para respostas públicas.
- QR Code e link público continuam disponíveis para cópia e download em todos os status.
- Arquivamento técnico continua usando `status = archived`; apenas a comunicação de interface usa `Encerrada`.
- Nenhum fluxo de dashboard, analytics, navegação, campanha, perfil ou banco foi alterado.

Critérios de teste:
- Abrir `/pesquisas` e confirmar textos com acentuação correta.
- Criar ou editar pesquisa e confirmar labels `Título`, `Descrição` e `Salvar alterações`.
- Confirmar que pesquisa em rascunho mostra status `Em preparação`.
- Confirmar que o botão de encerramento aparece como `Encerrar` e mantém o comportamento existente.
- Abrir QR Code de pesquisa em preparação ou encerrada e confirmar o aviso contextual.
- Abrir QR Code de pesquisa ativa e confirmar que o aviso não aparece.
- Exportar CSV em `/respostas/[surveyId]` e confirmar nome amigável baseado no título da pesquisa.
- Confirmar que o conteúdo do CSV não mudou.

Validações executadas:
- Typecheck e lint devem ser executados após esta atualização.

Pontos de atenção:
- A Sprint 7.5B não implementa toast global, novo sistema de feedback, redesign, novas rotas, navegação, dashboard analítico ou alterações de banco.
- O nome do PNG do QR Code continua usando o identificador da pesquisa, pois o escopo aprovado tratava apenas o nome do CSV.

Fora de escopo:
- Toast global.
- Sonner.
- Novo sistema de feedback visual.
- Refatoração de estados vazios.
- Revisão mobile ampla.
- Navegação.
- Novas rotas.
- Modal próprio.
- Dashboard.
- Analytics.
- Templates.
- Branding.
- Landing comercial.
- Agency Mode.
- Distribuição.
- Upload de logo.
- Perfil.
- Avatar.
- Multiusuário.
- Banco de dados.
- RLS.

Decisão arquitetural:
- Manter a arquitetura existente e tratar a sprint como ajuste de comunicação.

Motivo:
- O objetivo da sprint era aumentar percepção de acabamento sem expandir o MVP.

Alternativas consideradas:
- Criar sistema global de toast.
- Reestruturar status de campanhas e pesquisas.
- Alterar a lógica de QR Code para bloquear links de pesquisas não ativas.

Escolha:
- Corrigir apenas microcopy, nomenclatura e feedback contextual, preservando comportamento e regras de negócio.

Sugestao de commit:
- `[S7.5B] Ajustada comunicação e consistência da interface`

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

## Sprint R1.2 — Product Experience Fixes

Data: 2026-06-16

Objetivo:
- Eliminar inconsistências visuais remanescentes da migração R1/R1.1.
- Reduzir sensação de CRUD nas áreas operacionais.
- Orientar melhor o usuário após criar ou configurar pesquisas.

Entregas:
- Modal de detalhes em `/respostas/[surveyId]` migrado para tokens semânticos light-first.
- Cards internos de respostas atualizados para `bg-surface`, `bg-surface-muted`, `border-border` e `text-text-primary`.
- Campos de campanhas migrados para primitives `Textarea` e `Select`.
- Dropdowns de campanhas removidos do visual legado escuro.
- Cards de pesquisas reorganizados com CTA principal `Gerenciar pesquisa`.
- Ações secundárias de pesquisa agrupadas em menu compacto.
- Painel de próximos passos adicionado após salvar pesquisa.
- Orientação de continuidade adicionada ao construtor de perguntas.
- Textos visíveis dos arquivos afetados normalizados com acentuação correta.

Arquivos alterados:
- `src/components/responses/survey-responses-panel.tsx`
- `src/components/campaigns/campaign-manager.tsx`
- `src/components/surveys/survey-manager.tsx`
- `src/components/surveys/question-builder.tsx`
- `KOGNIS_PROJECT_LOG.md`

Critérios de validação:
- `/respostas/[surveyId]` não deve exibir modal escuro legado.
- `/campanhas` deve exibir textarea, select e opções com contraste adequado.
- `/pesquisas` deve apresentar menos ações repetidas por card em mobile.
- Após criar pesquisa, o usuário deve visualizar próximos passos claros.
- Após configurar perguntas, o usuário deve ter caminho claro para preview e continuidade.
- Nenhuma regra de negócio, Auth, Supabase, RLS ou banco foi alterado.

Validações executadas:
- `npx eslint "src/**/*.{ts,tsx}" --no-cache`
- `npx tsc --noEmit --incremental false`

Resultado:
- Lint passou.
- Typecheck passou.
- Varredura nos arquivos afetados não encontrou `text-white`, `bg-kognis-cyber`, `border-white/10`, `bg-white/[...]`, `text-red-100` ou `kognis-teal`.

Pontos de atenção:
- Esta sprint não inicia R2 nem altera Application Shell.
- A solução de menu compacto em pesquisas usa comportamento nativo com `details`.
- Build completo não foi solicitado nesta sprint; as validações obrigatórias aprovadas foram lint e typecheck.

Próximos passos recomendados:
- Iniciar R2 — Application Shell somente após validação visual manual da R1.2.
- Na R2, tratar sidebar, header, navegação premium, containers principais e layout base.

Sugestão de commit:
- `[R1.2] Ajustada experiência operacional pós-fundação visual`

## Sprint R1.3 — Mobile Action Polish

Data: 2026-06-16

Objetivo:
- Refinar a experiência mobile das áreas operacionais antes da R2.
- Reduzir altura visual e repetição de botões no gerenciamento de perguntas.
- Reforçar a hierarquia entre ação principal e ações secundárias.

Entregas:
- Ações de cada pergunta foram compactadas no construtor.
- A ação `Editar` permanece visível como ação direta.
- Ações secundárias de pergunta foram agrupadas em menu compacto:
  - mover para cima;
  - mover para baixo;
  - excluir.
- Cards de perguntas ficaram mais densos em mobile, com menos altura e menos botões empilhados.
- Header do construtor de perguntas foi ajustado para ações mais curtas em telas pequenas.
- Cards de pesquisas receberam ajuste leve de densidade no mobile.
- CTA principal de pesquisa foi encurtado para `Gerenciar` no mobile e mantém `Gerenciar pesquisa` em telas maiores.

Arquivos alterados:
- `src/components/surveys/question-builder.tsx`
- `src/components/surveys/survey-manager.tsx`
- `KOGNIS_PROJECT_LOG.md`

Critérios de validação:
- Em `/pesquisas`, abrir o construtor de perguntas em mobile.
- Confirmar que cada pergunta não exibe mais `Subir`, `Descer`, `Editar` e `Excluir` empilhados.
- Confirmar que `Editar` continua acessível.
- Confirmar que mover para cima, mover para baixo e excluir continuam acessíveis pelo menu compacto.
- Confirmar que os cards de pesquisa ficam menos altos em mobile.
- Confirmar que não há overflow horizontal em larguras próximas de 388px, 390px, 414px e 768px.

Validações executadas:
- `npx eslint "src/**/*.{ts,tsx}" --no-cache`
- `npx tsc --noEmit --incremental false`

Resultado:
- Lint passou.
- Typecheck passou.

Fora de escopo:
- Nenhuma alteração em banco, Supabase, Auth, RLS, rotas ou regras de negócio.
- Nenhuma alteração de sidebar, header, dashboard, analytics, landing ou Application Shell.

Próximos passos recomendados:
- Validar visualmente em mobile real ou DevTools nas larguras 388px, 390px, 414px e 768px.
- Após aprovação da R1.3, iniciar planejamento/execução da R2 — Application Shell.

Sugestão de commit:
- `[R1.3] Refinada experiência mobile das ações operacionais`

## Sprint R2 — Application Shell

Data: 2026-06-17

Objetivo:
- Criar uma nova moldura visual premium para a área autenticada.
- Aproximar o produto da referência Lovable em ritmo visual, hierarquia, espaçamento e navegação.
- Preservar regras de negócio, banco, Auth, Supabase, RLS, rotas e funcionalidades existentes.

Entregas:
- Novo `AppSidebar` light-first com marca, empresa, navegação principal e ação de logout.
- Novo `AppTopbar` com contexto do produto, empresa atual, menu mobile e logout.
- `AppShellClient` refatorado para usar a nova estrutura visual autenticada.
- `PageContainer` criado para padronizar largura, padding e espaçamento.
- `PageHeader` criado para padronizar título, descrição, eyebrow e ações de página.
- `PageSection` criado como seção visual reutilizável.
- `ShellActionGroup` criado para agrupar ações de shell/página.
- Wrappers antigos `Header` e `Sidebar` foram mantidos, mas agora apontam para os componentes novos.
- Marca `BrandMark` alinhada aos tokens semânticos da R1.
- Navegação normalizada com `Configurações` em acentuação correta.

Páginas migradas:
- `/dashboard`
- `/pesquisas`
- `/respostas`
- `/respostas/[surveyId]`
- `/campanhas`
- `/configuracoes`
- `/pesquisas/[surveyId]/preview`

Arquivos criados:
- `src/components/layout/app-sidebar.tsx`
- `src/components/layout/app-topbar.tsx`
- `src/components/layout/page-container.tsx`
- `src/components/layout/page-header.tsx`
- `src/components/layout/page-section.tsx`
- `src/components/layout/shell-action-group.tsx`

Arquivos alterados:
- `src/components/layout/app-shell-client.tsx`
- `src/components/layout/header.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/logout-button.tsx`
- `src/components/marketing/brand-mark.tsx`
- `src/constants/navigation.ts`
- `src/app/dashboard/page.tsx`
- `src/app/pesquisas/page.tsx`
- `src/app/respostas/page.tsx`
- `src/app/respostas/[surveyId]/page.tsx`
- `src/app/campanhas/page.tsx`
- `src/app/configuracoes/page.tsx`
- `src/app/pesquisas/[surveyId]/preview/page.tsx`
- `src/components/dashboard/dashboard-overview.tsx`
- `src/components/responses/responses-panel.tsx`
- `src/components/responses/survey-responses-panel.tsx`
- `src/components/campaigns/campaign-manager.tsx`
- `src/components/surveys/survey-manager.tsx`
- `KOGNIS_PROJECT_LOG.md`

Validações executadas:
- `npx eslint "src/**/*.{ts,tsx}" --no-cache`
- `npx tsc --noEmit --incremental false`
- `npm run build`

Resultado das validações:
- Lint passou.
- Typecheck passou.
- Varredura nas áreas migradas não encontrou uso crítico de `bg-kognis-cyber`, `text-kognis-teal`, `border-kognis-teal`, `text-white`, `bg-white/[...]` ou `border-white/...`.
- Build não concluiu por limitação local de permissão/cache em `.next`:
  - `EPERM: operation not permitted, open '.next/cache/webpack/server-production/2.pack_'`
  - `EPERM: operation not permitted, open '.next/trace'`

Documentos oficiais:
- `docs/FRONTEND_AUDIT_R0_5.md` existe e foi consultado.
- `docs/RELAYOUT_VISION.md` existe, mas está vazio no workspace.
- `docs/RELAYOUT_EXECUTION_PLAN.md` existe, mas está vazio no workspace.
- `docs/KOGNIS_DESIGN_LANGUAGE_V1.md` existe, mas está vazio no workspace.
- `docs/KOGNIS_VISUAL_SPEC_V1.md` existe, mas está vazio no workspace.
- `docs/KOGNIS_VISUAL_DIRECTION_V1.md` existe, mas está vazio no workspace.
- `docs/KOGNIS_INTERACTION_SPEC_V1.md` não existe no workspace.

Fora de escopo:
- Nenhum dashboard novo foi implementado.
- Nenhum gráfico, analytics, insight, IA, métrica nova ou consulta nova foi criado.
- Nenhuma landing, login, cadastro ou página pública `/participar/[surveyId]` foi alterada por escopo da R2.
- Nenhuma regra de negócio, banco, Auth, Supabase ou RLS foi alterado.

Decisões técnicas:
- A R2 foi implementada por refatoração centralizada do `AppShellClient`, preservando as rotas e fluxos existentes.
- `Header` e `Sidebar` antigos foram mantidos como wrappers para reduzir risco de quebra caso algum import antigo ainda exista.
- Os cabeçalhos das rotas obrigatórias passaram a usar `PageHeader`.
- As rotas obrigatórias passaram a usar `PageContainer`.

Decisões visuais:
- Sidebar saiu do tema escuro legado e passou para base `bg-surface`, `border-border`, `text-text-*` e ativo em `brand`.
- Topbar ficou light-first, sem busca ou notificações falsas.
- A empresa atual é exibida de forma discreta, sem avatar fake ou multiusuário.
- Campanhas permanece na navegação, mas com menor centralidade que Dashboard, Pesquisas e Respostas.

Próximos passos recomendados:
- Validar visualmente a R2 em desktop, 768px, 414px, 390px e 388px.
- Após aprovação, iniciar R3 — Customer Intelligence Experience.

Sugestão de commit:
- `[R2] Implementado application shell visual`

## Campanhas & Recompensas — Sprint 1 (Fundação de Campanhas e Recompensas)

Status: concluída (`3c69822`).

Entregas:
- Migration `supabase/2026_campaigns_foundation.sql` evoluindo `public.campaigns` e criando `public.campaign_surveys`, `public.campaign_rewards` e `public.campaign_claims`.
- RLS por `company_id` / `owner_id = auth.uid()` e triggers de integridade no banco.
- Contratos e helpers puros em `src/types/campaign.ts`, `src/lib/campaign-utils.ts`, `src/lib/campaigns.ts`, `src/lib/campaign-surveys.ts`, `src/lib/campaign-rewards.ts` e `src/lib/campaign-claims.ts`.

## Campanhas & Recompensas — Sprint 2 (Submission Gateway + Emissão de Recompensas)

Status: concluída.

Entregas:
- Criados contratos de submissão em `src/types/submission.ts`.
- Criados utilitários puros de elegibilidade e emissão em `src/lib/campaign-issuance-utils.ts`.
- Criada migration `supabase/2026_submission_gateway.sql` com RPC `public.submit_public_survey_response` (`SECURITY DEFINER`), proteção de concorrência (`FOR UPDATE`), idempotência por `submission_key`, e subtransação `EXCEPTION` para preservar a resposta pública mesmo em caso de falha na emissão de recompensa.
- Criado gateway cliente `src/lib/submission-gateway.ts` com sanitização de payload público e fallback compatível durante transição.
- Criado componente `src/components/responses/submission-completion-card.tsx` e integrado a `DynamicPublicResponseForm` e `PublicResponseForm`.
- Criada suíte de testes `src/lib/submission-gateway.test.ts` (16 testes).

## Campanhas & Recompensas — Sprint 3 (Administração de Campanhas e Recompensas)

Status: implementada e validada.

Objetivo:
- Permitir que a empresa autenticada configure, gerencie, visualize em preview e acompanhe operacionalmente campanhas, recompensas, regras de emissão e benefícios emitidos (`campaign_claims`) em `/campanhas`, sem novas migrations SQL e preservando total compatibilidade com as Sprints 1 e 2.

Entregas (S3.2 → S3.13):
- **S3.2 — Informações básicas, período e regras**:
  - Evoluído `src/types/campaign.ts` com `CampaignDisplayStatus`, `SanitizedCampaignClaimView`, `campaignDisplayStatusLabels` e `identityRequirementDescriptions`.
  - Criado `src/lib/campaign-admin-utils.ts` com validações puras de nome, descrição, tipo (`reward_on_response`), status (`draft`, `active`, `paused`, `archived`), janela temporal (`starts_at <= ends_at`), `max_claims_total`, `claim_validity_days`, `identity_requirement` (`none | email | phone`) e `completion_message`.
  - Expiração tratada como estado visual derivado (`expired` quando `status === 'active'` e `ends_at <= now()`), nunca persistido no banco.
- **S3.3 — Pesquisa vinculada**:
  - Sincronização dupla entre `campaign_surveys` (fonte prioritária N:N) e `campaigns.survey_id` (compatibilidade legada).
  - Leitura administrativa em `getCampaignsByCompany` priorizando `campaign_surveys` com fallback para `campaigns.survey_id`.
  - Bloqueio preventivo na UI e na validação pura contra duas campanhas ativas vinculadas à mesma pesquisa.
- **S3.4 — Configuração de recompensa**:
  - Edição e persistência 1:1 em `campaign_rewards` (`upsert` por `campaign_id` / remoção quando desabilitada).
  - Suporte a `percentage` (1–100), `fixed_amount` (> 0), `gift` e `custom`.
  - Modos de código `unique` (`fixed_code = null`, formato `KOGNIS-XXXXXX` no gateway) e `fixed` (`fixed_code` obrigatório e normalizado em maiúsculas).
- **S3.5 — Regras básicas de emissão**:
  - Configuração de `max_claims_total`, `claim_validity_days` e `identity_requirement` com explicações claras para o operador.
- **S3.6 — Mensagem de conclusão**:
  - Configuração de `completion_message` com fallback automático para `"Sua participação foi registrada com sucesso."`.
- **S3.7 — Preview administrativo da campanha**:
  - Simulação visual em `/campanhas` (tanto dentro do formulário quanto por card de campanha salva) reutilizando `SubmissionCompletionCard` e `buildCampaignPreviewPayload`, sem chamar o Submission Gateway e sem gravar `responses` ou `campaign_claims`.
- **S3.8 — Painel de detalhes operacionais**:
  - Visão consolidada por campanha com blocos de Resumo, Recompensa, Regras e Operação (`claims_count` / `max_claims_total` e situação operacional).
- **S3.9 — Lista administrativa segura de claims**:
  - Carregamento sob demanda e sanitização via `sanitizeClaimsForAdminView`, exibindo código, status (incluindo expiração derivada), data de emissão, validade, pesquisa e rótulo seguro de identificação, sem jamais expor `identity_hash`, `device_hash`, `claim_token` ou `submission_key`.
- **S3.10 — Controles de ciclo de vida**:
  - Ações contextuais por estado: `Draft` (editar, ativar, arquivar), `Active` (editar, pausar, arquivar), `Paused` (editar, reativar, arquivar) e `Archived` (modo somente leitura).
- **S3.11 — Testes automatizados**:
  - Criado `src/lib/campaign-admin-utils.test.ts` cobrindo os 15 cenários obrigatórios + preview administrativo.

Validações executadas:
- `npx tsc --noEmit --incremental false`
- `npx eslint "src/**/*.{ts,tsx}" --no-cache`
- `npx vitest run`

