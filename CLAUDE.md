# CLAUDE.md

Guia do projeto para o Claude Code. Leia antes de mexer em qualquer coisa.

---

## 1. O produto

Plataforma de ensino de **inglês** (depois outros idiomas) para **alunos
brasileiros**, cobrindo do **A1 ao C1** (CEFR).

**Não existe aula gravada com professor.** Cada lição é interativa e segue
sempre a mesma espinha:

1. **Cena em áudio** com personagens fixos, em formato de série — o aluno
   acompanha as mesmas pessoas ao longo do curso.
2. **Cards de explicação em português**, curtos e diretos.
3. **Prática em camadas**: reconhecer → montar → produzir.
4. **Produção livre corrigida por IA**.
5. **Roleplay com IA**, usando o que acabou de ser praticado.
6. **Revisão espaçada** do que foi visto.

### Regras de produto que valem para tudo

- **Conteúdo base é igual para todos, em qualquer ordem.** Lições, apostilas
  em PDF e trilhas podem ser acessadas a qualquer momento — nada de bloquear
  conteúdo por progresso. O que muda com o **plano** é quanto do catálogo
  abre (FREE: a primeira unidade de cada nível; apostila em PDF só nos
  pagos), e mesmo assim nada some da listagem: vem com `locked`.
- **O cronograma personalizado é o caminho recomendado**, não uma trava. Ele
  sugere o que estudar hoje; o aluno segue ou não.
- **Questionários e provas são nivelados pelo aluno.** Os itens têm
  dificuldade calibrada e os testes são adaptativos — dois alunos em níveis
  diferentes não recebem a mesma prova.
- **O sistema mantém um modelo do aluno**: nível por competência, conteúdo
  que ele precisa, pontos fortes e fracos, erros recorrentes e interesses.
  **Tudo que é gerado ou recomendado consulta esse modelo** e acompanha a
  evolução dele ao longo do tempo.
- **Registro falado × estrutura gramatical.** Textos e conversas sempre
  mostram a diferença entre a forma gramatical padrão e como se fala no dia
  a dia:
  - `I'm going to` × `I'm gonna`
  - `Are you coming?` × `You coming?`
  - `Do you want to...?` × `Wanna...?`

### Plano pago superior (Plus)

Ferramentas de IA exclusivas:

- **(a) Material a partir de um tema.** O aluno diz um interesse ("gosto de
  História") e a IA gera um texto sobre um **acontecimento real**, com fatos
  de **fonte verificável**, **no nível do aluno**, trabalhando **as estruturas
  que ele precisa melhorar**, com destaques gramaticais, notas de registro
  falado e exercícios.
- **(b) Material a partir de um conteúdo do aluno.** Ele cola um texto, a URL
  de uma reportagem ou a letra de uma música (depois: links de vídeo) e a IA
  gera material de estudo e exercícios no nível dele.

### Tom da interface

Português do Brasil, **direto e amigável**. Sem formalidade de manual, sem
gíria forçada, sem exclamação em excesso. Fale com o aluno como um professor
que ele gosta falaria.

---

## 2. Stack

Decidida. **Não troque nada aqui sem me perguntar antes.**

| Camada        | Escolha                                                 |
| ------------- | ------------------------------------------------------- |
| Monorepo      | pnpm workspaces + Turborepo                             |
| API           | NestJS (TypeScript strict), **monólito modular**        |
| Banco         | PostgreSQL 16 + Prisma                                  |
| Filas / jobs  | Redis + BullMQ (`@nestjs/bullmq`)                       |
| Armazenamento | S3 (MinIO no ambiente local)                            |
| Validação     | zod + nestjs-zod — schemas em `packages/shared`         |
| Web           | React + Vite + Tailwind + TanStack Query                |
| IA            | OpenAI                                                  |
| Pagamento     | Asaas (Pix, boleto, cartão, assinaturas)                |
| Testes        | Jest (unit) + Supertest (e2e), banco via docker compose |
| Logs          | pino (`nestjs-pino`), estruturado, com `requestId`      |

**Estado atual: foco é o back-end.** `apps/web` é só um placeholder; o
front-end entra depois.

### Cliente do MVP: só web

**O aluno acessa tudo pelo navegador**, no computador e no celular. O app
nativo (módulo 16) está fora do escopo. Na prática:

- A autenticação é desenhada para navegador: refresh em cookie `httpOnly`
  com CSRF double-submit, login com Google redirecionando para o front.
  Não crie um modo alternativo para app agora. Quando o app vier, o refresh
  pelo corpo da resposta entra como um modo a mais, sem mexer no da web.
- Pense em **web no celular com rede instável**: resposta idempotente
  (`clientAnswerId`), payload enxuto, mídia por URL assinada.
- Mídia em formato que toca em qualquer navegador, inclusive no Safari do
  iPhone: áudio em MP3 ou AAC, não OGG/Opus.
- Notificação (módulo 15) parte de e-mail. Web Push no iPhone só funciona
  com o site instalado como PWA, então não pode ser o único canal.
- A API continua REST com JSON, sem nada que dependa do cliente. O app
  futuro usa as mesmas rotas.

### Layout do repositório

```
apps/
  api/                  NestJS
    src/
      main.ts
      app.module.ts
      common/           config, filtros, decorators, pipes, erros
      infra/            Prisma, Redis, filas, logger, S3
      modules/          um diretório por módulo de negócio
    prisma/             schema.prisma, migrations, seed.ts
    test/               e2e (Supertest)
  web/                  React + Vite + Tailwind (placeholder)
packages/
  shared/               tipos e schemas zod compartilhados (build: tsup)
  eslint-config/        presets flat config (base, nest, react)
  tsconfig/             tsconfig base, nestjs, library, react
```

### Versões que valem uma nota

- **Prisma 6.x**, não a 7/8. Migrar depois, em PR próprio.
- **ESLint 9 flat config** (`eslint.config.mjs`). Sob pnpm, o `.eslintrc`
  não resolve plugins vindos de um pacote compartilhado.
- **`@nestjs/event-emitter` 3.x**, não a 12.x. A 12 é ESM-only: roda no Node
  24 via `require(esm)`, mas o Jest em CommonJS não consegue carregar, e os
  testes e2e quebram na importação do `app.module`.
- **`@typescript-eslint/consistent-type-imports` fica desligado na API.**
  Um provider injetado só aparece como anotação de tipo no construtor;
  trocá-lo por `import type` apaga o `design:paramtypes` e a DI do Nest
  quebra **em runtime**, sem erro de compilação.
- **`@react-pdf/renderer` 4.x é ESM puro**, mesma armadilha do
  `event-emitter`. Por isso duas coisas: ele é carregado por `import()`
  dinâmico preservado com `new Function` (o TS rebaixaria um `import()`
  normal para `require`), isolado em
  [workbook-pdf.ts](apps/api/src/modules/content-studio/services/workbook-pdf.ts);
  e os scripts de Jest rodam com `--experimental-vm-modules` via
  `cross-env`. Sem a flag, o Jest recusa qualquer `import()` dinâmico.
- **`jsdom` fica na 26.x.** A 27+ é CommonJS mas depende de pacote ESM
  puro (`@exodus/bytes`), e nem o `import()` dinâmico salva no Jest. Ele e
  o `@mozilla/readability` são carregados sob demanda em
  [article-extract.ts](apps/api/src/modules/generator/services/article-extract.ts).

---

## 3. Módulos e ordem de dependência

Construímos **um módulo por vez, nesta ordem**. Um módulo só pode depender
dos que vêm antes dele.

| #   | Módulo                          | Depende de | O que entrega                                                                                         |
| --- | ------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| 0   | `setup`                         | —          | Monorepo, docker compose, lint/format/hooks, CI, `GET /health`. ✅ pronto                             |
| 1   | `infra`                         | 0          | Prisma, S3/MinIO, BullMQ + Bull Board, eventos, logger, filtro de erro, paginação, Swagger. ✅ pronto |
| 2   | `ai`                            | 1          | Cliente OpenAI, prompts versionados, validação zod, cache, custo, isolamento de untrusted. ✅ pronto  |
| 3   | `auth` / `users` / `onboarding` | 1          | Cadastro, login (JWT + refresh rotativo), Google, roles, perfil, onboarding, LGPD. ✅ pronto          |
| 4   | `curriculum`                    | 3          | Taxonomia, personagens, unidades, lições versionadas, banco de questões, apostilas PDF. ✅ pronto     |
| 5   | `content-studio`                | 2, 4       | Rascunho por IA, QA automática, revisão humana, TTS e apostila em PDF. ✅ pronto                      |
| 6   | `learning`                      | 5          | Player da lição: tentativas, etapas, correção de resposta objetiva, XP e sequência. ✅ pronto         |
| 7   | `learner-model`                 | 6          | Nível por competência, mastery, erros recorrentes, forças e fraquezas, interesses. ✅ pronto          |
| 8   | `assessment`                    | 7          | Nivelamento adaptativo, checkpoints de unidade, `selectItems` nivelado, calibração. ✅ pronto         |
| 9   | `srs`                           | 7          | Revisão espaçada com FSRS: `ReviewCard`, sessão diária, criação por evento. ✅ pronto                 |
| 10  | `planner`                       | 8, 9       | Trilha até o nível-alvo e agenda diária — recomendação, nunca bloqueio. ✅ pronto                     |
| 11  | `billing`                       | 2, 3       | Asaas atrás de `PaymentGateway`, planos, assinatura, webhooks, créditos de IA. ✅ pronto              |
| 12  | `tutor`                         | 2, 7, 11   | Correção de produção livre e roleplay com IA, alimentando o modelo do aluno e o SRS. ✅ pronto        |
| 13  | `generator`                     | 2, 7, 11   | Plus (a) tema → fato real com fonte; (b) conteúdo colado/URL → material e exercícios. ✅ pronto       |
| 14  | `progress`                      | 7, 9, 10   | Painel do aluno, métricas do admin, agregação diária noturna. ✅ pronto                               |
| 15  | `notifications`                 | 10         | E-mail e Web Push, lembretes do planner por fuso, preferências e limite de frequência. ✅ pronto      |
| 16  | `mobile`                        | 14         | App (fora do escopo atual — web primeiro)                                                             |
| 17  | `admin`                         | 5, 11      | Painel interno: conteúdo, alunos, assinaturas, métricas                                               |
| 18  | `deploy`                        | todos      | Infra de produção, migrations, observabilidade, backup                                                |

---

## 4. Convenções

### Idioma

- **Código, nomes de tabela, colunas, endpoints, códigos de erro e commits:
  em inglês.**
- **Texto exibido ao aluno: em pt-BR.** Isso inclui mensagens de erro da API
  — o campo `code` é o identificador em inglês, o `message` é o texto pt-BR
  pronto para exibir.
- Comentários e documentação: pt-BR.

### Anatomia de um módulo

Todo módulo Nest vive em `apps/api/src/modules/<nome>/`:

```
<nome>/
  <nome>.module.ts      declaração do módulo
  controllers/          HTTP — só traduz request/response, sem regra
  services/             orquestração: I/O, transação, chamada a outros módulos
  dto/                  schemas zod de entrada e saída (createZodDto)
  domain/               REGRA DE NEGÓCIO PURA — sem Nest, sem I/O
  jobs/                 processors BullMQ
  events/               eventos emitidos e handlers
  <nome>.spec.ts        testes unitários do domain/
```

Diretório que o módulo não usa, não cria.

### `domain/` é sagrado

**Regra de negócio e algoritmo ficam em função pura em `domain/`, com teste
unitário.** Nada de Nest, Prisma, HTTP, fila, `Date.now()` ou `Math.random()`
lá dentro — o tempo e a aleatoriedade entram por parâmetro.

O ESLint impõe isso: importar `@nestjs/*`, `@prisma/*`, `bullmq`, `ioredis`,
`express`, `openai` ou `**/infra/**` dentro de `domain/` é erro.

Isso vale principalmente para o que é coração do produto: cálculo de mastery,
agendamento de revisão, seleção adaptativa de item, montagem do cronograma,
calibração de dificuldade. É tudo testável sem subir nada.

### Comunicação entre módulos

- Um módulo conversa com outro por **serviço exportado** ou por **evento**
  (`EventEmitter2`).
- **Nunca acesse a tabela de outro módulo direto pelo Prisma quando existe um
  serviço para isso.** Precisa de um dado do `learner-model`? Chame o serviço
  dele. Se o serviço não existe, crie — não faça um `findMany` atravessado.
- Evento para efeito colateral assíncrono (`attempt.submitted` →
  `learner-model` recalcula, `srs` reagenda). Serviço para leitura síncrona.
- Nome de evento: `<módulo>.<fato no passado>` — `lesson.completed`,
  `subscription.activated`.

### Trabalho pesado vai para a fila

**Toda tarefa lenta ou que chama IA roda em BullMQ.** O request HTTP nunca
bloqueia além de ~2s.

O padrão é: o controller enfileira e devolve um id; o cliente acompanha por
polling ou por evento. Filas declaradas em
[queues.ts](apps/api/src/infra/queue/queues.ts).

### Chamando IA

**Só o módulo `ai` fala com o SDK da OpenAI.** Todo mundo passa pelo
`AiService.run(prompt, context)`, que amarra num lugar só: prompt versionado,
teto de entrada, cache, validação zod, custo e registro em `ai_usages`.

Prompt novo mora em `src/modules/ai/prompts/<feature>.prompt.ts` e é
registrado em `prompts/registry.ts`. Mudou o texto de um jeito que altera a
saída? **Suba a `version`** — é o que invalida o cache e separa as métricas.
Registre também a fixture em `prompts/fixtures.ts`, para o teste do módulo
que usa o prompt rodar sem chave da OpenAI.

### Toda saída de IA é validada com zod

Nenhuma resposta de IA é usada ou salva antes de passar por `schema.parse()`.
Falhou o parse: retry com o erro no prompt; falhou de novo, o job falha e o
aluno recebe uma mensagem honesta em pt-BR. Nunca salve JSON de IA "na fé".

### Conteúdo do usuário é dado, nunca instrução

Tudo que o aluno envia — texto colado, URL, letra de música, redação,
mensagem de roleplay — é **dado não confiável**.

- Vai numa mensagem **separada**, marcado como conteúdo do usuário. Nunca é
  concatenado dentro do system prompt.
- A instrução do que fazer vem **sempre** do nosso prompt, nunca do conteúdo.
- Instrução que aparecer dentro do conteúdo do aluno é para ser **ignorada e
  tratada como texto**.
- Detalhes e helpers ficam no módulo 2 (`ai`).

### Autenticação

Access token de 15 minutos no header `Authorization: Bearer`, guardado só em
memória no front. Refresh rotativo em cookie **httpOnly** com `Path=/auth`,
protegido por CSRF double-submit (`csrf_token` legível + header
`x-csrf-token`) nas rotas que dependem do cookie.

Reuso de um refresh token já rotacionado revoga a **família** inteira: é o
sinal de que alguém está com uma cópia.

Rota nova nasce protegida — o `JwtAuthGuard` é global. Use `@IsPublic()` para
abrir e `@Roles('ADMIN')` para restringir por papel. O papel viaja dentro do
JWT, então promover alguém só vale no próximo login.

### Conteúdo: slugs imutáveis e versionamento

**`Skill`, `ErrorPattern` e `RegisterNote` têm slug como chave primária, e
esse slug nunca muda.** Ele viaja dentro do JSON das etapas de lição, do
`errorPatternMap` das questões, dos prompts de IA e do modelo do aluno —
renomear quebraria conteúdo já publicado e apagaria histórico de mastery.
Para tirar um de circulação: `deprecatedAt` + `replacedById`, nunca rename.
Os outros models seguem uuid, como o resto do banco.

**Lição é identidade (`Lesson`) + conteúdo (`LessonVersion`).** O aluno vê
`lesson.publishedVersionId`. Editar a lição no ar abre a próxima versão em
DRAFT; o ponteiro só se move no `publish`. Uma versão aberta por vez.

Fluxo: `DRAFT → IN_REVIEW → APPROVED → PUBLISHED`, e `ARCHIVED` no fim.
**Editar uma versão em IN_REVIEW ou APPROVED devolve ela para DRAFT** e
apaga o carimbo de aprovação — o que foi revisado deixou de ser o que está
ali. Publicar exige APPROVED.

**Questão publicada é imutável em `type`, `prompt`, `content` e
`acceptedAnswers`.** `exposureCount` e `correctRate` são estatística daquele
enunciado; mudar a pergunta e manter o histórico produziria calibração de
mentira. Edição vira item novo em DRAFT, ligado ao antigo por
`replacedById`, e o antigo é arquivado quando o novo publica. Item dentro de
lição publicada não se arquiva.

Referência dentro de JSON (span → skill, prática → item, fala →
personagem) **não tem chave estrangeira**. Quem confere é o `publish`:
`collectStepReferences` junta tudo e o serviço recusa publicar se faltar
alguma — ou se o item referenciado não estiver PUBLISHED.

O catálogo é cacheado no Redis com a versão na chave, então publicar
invalida sozinho. **O cache guarda `storageKey`, nunca URL assinada** — a
assinatura vence e a URL nasce na resposta.

### Autoria com IA (content-studio)

**Nada gerado por IA chega ao aluno sem um humano aprovar.** O rascunho
materializa direto em linha de verdade — `LessonVersion` em DRAFT, `Item`
com `source = AI_DRAFT` — para o editor revisar com as mesmas rotas do
módulo 4. O que trava é o fluxo editorial, que já existia.

Caminho: pedir rascunho → fila `content-drafts` (tier smart) → fila
`content-qa` (tier fast) → revisão humana → **aprovar** → TTS → **publicar**
→ apostila em PDF.

**O TTS roda na aprovação, não na publicação.** O editor precisa ouvir o
áudio antes de mandar para o ar, e o publish é recusado enquanto alguma
fala, item de escuta ou `RegisterNote` da versão estiver sem `MediaAsset`.
Áudio é produção única, indexado por `hash(texto + voz + velocidade)`:
republicar uma lição não sintetiza nada de novo.

**Aprovar a lição publica as questões dela** e troca `AI_DRAFT` por
`AI_DRAFT_REVIEWED`. Quem revisou a lição leu os itens; aprovação item a
item seria clique sem ganho.

**A QA nunca altera conteúdo** — só descreve. A gravidade de cada aviso mora
num lugar só, em
[qa-report.ts](apps/api/src/modules/content-studio/domain/qa-report.ts):
`BLOCKER` impede a aprovação, `WARNING` e `INFO` só aparecem na tela.

O módulo 4 não pode importar o 5 (ordem de dependência). As duas travas
chegam lá pelo token `CONTENT_GATE` (ver "Travas por inversão de
dependência"). Efeito colateral (gerar áudio, gerar PDF) **não** passa pelo
gate — passa por evento.

A checagem de nível usa a lista de frequência de
`packages/shared/src/wordlists`, gerada a partir do CSV versionado em
`packages/shared/data` por `pnpm wordlist:import`. Palavra fora da lista
**não** conta como fora do nível, e o relatório traz `coverage` justamente
para dizer o quanto aquele número vale.

### Player da lição (learning)

**O learning é a fonte de dados do modelo do aluno.** `LessonAttempt`,
`StepProgress` e `Answer` só recebem linhas novas, e quem precisa reagir
(learner-model, SRS) escuta `lesson.*` e `answer.submitted`.

A tentativa guarda o **id da versão** que o aluno fez. Se a lição for
republicada no meio do caminho, a tentativa aberta vira ABANDONED e começa
outra na versão nova. Uma IN_PROGRESS por aluno e lição, garantido por
índice único parcial escrito à mão na migration.

A correção é pura, em
[evaluate-answer.ts](apps/api/src/modules/learning/domain/evaluate-answer.ts),
em cima da normalização do curriculum. Crédito parcial só em ORDER_WORDS e
MATCH. Formato de resposta errado (alternativa inexistente, peça que não
estava no item) é **422**, não resposta errada no histórico.

**Estatística do item e XP contam só a primeira tentativa** (`isFirstTry`).
Refazer até acertar não infla `correctRate` nem rende XP. A estatística é
recalculada a partir das respostas, em lote, na fila `learning` — nunca
dentro do request.

A rota `POST /answers` aceita os contextos LESSON, REVIEW e
**TARGETED_PRACTICE** (prática de ponto fraco da agenda, planner/10 — item
escolhido pelo `AdaptiveItemService` fora de lição ou de card de revisão,
sem `attemptId`, mesma regra do REVIEW). PLACEMENT, CHECKPOINT e
GENERATED_MATERIAL são gravados pelo módulo dono, chamando
`AnswerService.record` do lado do servidor.

Sequência conta o dia **no fuso do aluno**, e perder um dia só faz ela
recomeçar do um. Nada de vidas ou punição.

**`GET /me/stats`** devolve XP total e sequência (`LearningStatsService.get`,
só leitura — não registra estudo). É o que a tela Hoje do front usa; antes só
existia embutido na resposta de `POST /attempts/:id/complete`.

### Modelo do aluno (learner-model)

**Quem gera ou recomenda conteúdo chama
`LearnerProfileService.getSnapshot(userId)`** — nunca lê as tabelas do
learner-model nem monta o próprio resumo do aluno. O snapshot é compacto,
determinístico (mesmo estado, mesmo JSON, para o cache de IA acertar) e
fica no Redis até o modelo mudar.

**Os exemplos de erro do snapshot são frases reais do aluno.** Vão para a
IA como conteúdo não confiável, em mensagem separada, e nunca para log.

Habilidade por skill é `theta` na mesma escala logit da dificuldade do
item, atualizada tipo Elo. Regras que não são óbvias:

- **Theta aprende só com a primeira tentativa; o perfil de erro conta
  todas.** A retentativa depois do gabarito não mede habilidade, mas o erro
  digitado nela foi digitado.
- Skill nova começa na dificuldade típica do nível dela (mastery 0.5 =
  "não sei"), não em zero.
- O decaimento por tempo é **só na leitura**; o banco guarda o theta puro.
- Com 60 respostas, o theta tem erro padrão de ~0.25 logit — limite de
  informação, não defeito. Teste de convergência olha a distribuição em
  muitas sementes, nunca uma semente escolhida.

**Ordem por aluno sem agrupamento de fila** (é recurso pago do BullMQ): um
job por resposta, trava no Redis por aluno e marca d'água
(`LearnerModelCursor`). Quem pega a trava processa tudo depois da marca, em
ordem; a marca anda na mesma transação da escrita. Para reconstruir o
modelo de um aluno do zero, apague o cursor e os estados.

`Skill.goals` diz a que objetivos do aluno a skill serve. Vazio = serve a
todos. É o que liga "o aluno quer viajar" à prioridade das necessidades.

### Provas e nivelamento (assessment)

**Quem precisa de questão para o aluno chama
`AdaptiveItemService.selectItems`** — nunca escolhe item por conta própria.
Ele mira ~70% de chance de acerto pelo theta da skill no learner-model.

Nivelamento: Rasch (1PL) com estimativa **EAP** (a máxima verossimilhança
diverge com tudo certo), priori N(nível declarado, 1.5²), próximo item
perto do theta em rodízio de competências, sorteado entre os 2 melhores.
Os parâmetros saíram de simulação — mudar exige rodar
`PRINT_SIMULATION=1 pnpm test -- src/modules/assessment` e comparar.

- **Sem correção item a item** no nivelamento e no checkpoint: gabarito no
  meio da prova ensina e distorce a medida.
- A resposta de prova é gravada pelo `AnswerService.record` do learning
  (contexto PLACEMENT/CHECKPOINT) e ligada ao teste em
  `assessment_responses`, com dificuldade e competência **congeladas**.
- O ponto de partida do checkpoint também é congelado no início: as
  respostas dele atualizam o learner-model, e ler de novo contaria duas
  vezes.
- O nivelamento vira ponto de partida do learner-model
  (`LearnerPlacementPrior`) pela fila `learner-updates`, sob a mesma trava.
- Checkpoint é diagnóstico: nunca trava nada, pode ser refeito à vontade.
- A calibração semanal anda no máximo 0.5 logit por rodada e usa o theta
  **atual** de quem respondeu (aproximação consciente).
- A escrita do nivelamento é um gancho (`WritingAssessor`, `@Optional()`)
  que o tutor (12) implementa.

### Revisão espaçada (srs)

Agendamento por **FSRS** (`ts-fsrs`), não SM-2. `ReviewCard.kind` diz o que
o `refId` referencia — SKILL, VOCAB, CHUNK, REGISTER_NOTE, ERROR_PATTERN ou
TERM — sem chave estrangeira, porque são tabelas diferentes conforme o tipo
(mesma ideia da referência dentro de JSON do módulo 4). TERM é um termo
solto do aluno (`StudyTerm`, dono é o SRS), que vem do vocabulário dos
materiais do generator (13). Vocabulário e chunk
já são `Skill` (`SkillType.VOCAB_SET` e `CHUNK`); vocabulário é por
**conjunto**, não por palavra — é o grão que o schema hoje permite.

- **Criação de card é passiva, nunca ativa.** Ninguém chama "criar card": o
  SRS escuta `lesson.completed` (cria o que falta para as target skills,
  chunks e vocabulário da lição) e `answer.submitted` errado de primeira
  tentativa (cria ou lapsa o card da skill principal do item e de cada
  ErrorPattern revelado). Responder certo fora de uma revisão de verdade não
  mexe no agendamento de nenhum card.
- **`GET /reviews/session?minutes=N` só corta o que é servido, nunca
  reagenda.** O cálculo de quantos cards cabem é `minutes·60 / 25s`; o que
  não coube continua vencido e aparece na sessão seguinte. É assim que o
  backlog de quem ficou dias sem estudar se espalha sozinho, sem mexer no
  `due` de ninguém.
- **Prioridade da sessão não é campo, é ordenação.** ErrorPattern e card com
  2+ lapsos vêm primeiro; o resto, do mais atrasado pro mais recente.
- **Card de SKILL usa questão real**, escolhida pelo `AdaptiveItemService`
  (8) — mesmo contrato do planner e do generator. Os outros quatro tipos
  viram um **flashcard simples** (frente/verso de `Skill`, `RegisterNote` ou
  `ErrorPattern`), **auto-avaliado pelo aluno** (Again/Hard/Good/Easy,
  estilo Anki) — não há banco calibrado de vocabulário, chunk, nota de
  registro ou erro por trás para corrigir automaticamente.
- Responder um card de SKILL passa pelo `AnswerService.record` do learning
  (contexto REVIEW) — ganha `answer.submitted` de graça, e o learner-model
  (7) processa como qualquer resposta. O rating vem de acerto, dica e tempo
  (`domain/rating.ts`); o de flashcard é o `selfRating` que o aluno mandou.
  **`POST /reviews/:cardId/answer` devolve `{cardId, rating, nextDueAt,
state, answer?}`** — `answer` é o `AnswerResult` completo (gabarito,
  explicação, erros típicos) só em card de SKILL, pro cliente mostrar o
  mesmo feedback de `POST /answers` sem precisar de uma segunda chamada.
- **`review.answered` também alimenta o learner-model**, só para
  VOCAB/CHUNK (evidência de mastery com peso baixo — não é questão
  calibrada) e ERROR_PATTERN (mais uma oportunidade na janela de
  recorrência do módulo 7: revisões boas seguidas empurram o erro pra fora
  da janela sozinhas, sem lógica nova). SKILL já chega pelo
  `answer.submitted` de sempre.
- **Card novo nasce vencido** (`due = agora`, estado NEW) — é assim que o
  ts-fsrs cria. "Due amanhã e em alguns dias" só aparece depois da
  _primeira_ revisão de verdade: Easy num card novo já pula direto pra
  REVIEW com o due dias à frente; Good passa primeiro pelos passos curtos
  (minutos) do aprendizado.
- **Toda revisão vira uma linha em `ReviewLog`**, na mesma transação do
  reagendamento. O card guarda só o estado atual; "quantas revisões você
  fez" (progress, 14) sai do log.
- Mesma trava por aluno do learner-model, agora num helper comum
  (`infra/redis/user-lock.ts`) que os dois módulos usam — sem marca d'água
  aqui, porque criar card é idempotente por `[userId, kind, refId]`.
- **A única criação ativa é o termo que o aluno pede**:
  `TermReviewService` (exportado) põe e tira um termo solto da revisão pela
  chave normalizada (`normalizeTerm`, a mesma do dedup de `StudyTerm`).
  Tirar **suspende** o card (`suspended = true`), não apaga — o `ReviewLog`
  continua apontando para ele, e pôr de volta reativa o mesmo card com o
  estado do FSRS que ele tinha. Sessão e `dueFor` ignoram suspensos. Sem a
  trava por aluno: cada operação mexe numa linha só, e o índice único basta.
  Quem chama é o vocabulário do material (generator, 13).

### Cronograma automático (planner)

`StudyPlan.path` guarda só o que **falta** — não um histórico. Completar uma
lição (de qualquer jeito, inclusive fora do plano) tira ela do path; não
existe "marcar como feito" separado disso.

- **Reconstrução é sempre completa, nunca incremental.** `rebuild` lê o
  learner-model, o catálogo e a disponibilidade atuais e monta o path do
  zero — refazer duas vezes seguidas dá o mesmo resultado. As únicas
  escritas incrementais são tirar uma lição concluída do path e somar
  `reinforceSkillIds` de um checkpoint; nenhuma das duas remonta a trilha.
- **A agenda é gerada uma vez por dia local e guardada.** Não é o cálculo
  que é caro — é o estado de cada bloco que precisa persistir dentro do
  mesmo dia sem recalcular tudo de novo a cada leitura. `GET /me/agenda?date=`
  só aceita o dia de hoje: não existe agenda do passado. Cada bloco tem
  `status: 'PENDING' | 'COMPLETED' | 'SKIPPED'`, e `GET /me/agenda` devolve
  `minutesCompleted` (soma de `minutesSpent` dos concluídos) — é "minutos do
  dia feitos" pro front.
  - **`POST .../blocks/:id/skip`** aceita `{reason?: 'NO_TIME' |
'ALREADY_KNOW' | 'TOO_HARD' | 'OTHER', note?}`, guardado no bloco
    (`skipReason`/`skipNote`). Não desfaz um bloco já `COMPLETED`. TODO:
    `ALREADY_KNOW` num bloco de prática é candidato a virar uma checagem
    rápida, e `TOO_HARD` a puxar reforço do pré-requisito — nenhuma lógica
    nova roda em cima disso ainda, é só o motivo guardado.
  - **`POST .../blocks/:id/complete`** aceita `{minutesSpent?}` (padrão: o
    `estimatedMinutes` do bloco), idempotente — repetir mantém o
    `completedAt`/`minutesSpent` da primeira vez, e pode sobrescrever um
    `SKIPPED` (o aluno pulou e decidiu fazer depois). Bloco de REVIEW e de
    TARGETED_PRACTICE são marcados pelo front ao terminar o fluxo; bloco de
    LESSON é marcado pelo próprio backend (ver abaixo).
  - **`lesson.completed` marca o bloco em vez de invalidar a agenda
    inteira** (`AgendaService.completeLessonBlock`) — antes, terminar a
    lição sugerida apagava a agenda do dia inteira (`invalidateToday`) e
    perdia o que já tinha sido marcado como feito ou pulado nos outros
    blocos. `removeFromPath` continua rodando do mesmo jeito.
- **A ordem dos blocos é fixa e o corte é sempre pelo orçamento do dia:**
  revisão vencida (até ~30%, usando o que existir), a próxima lição do path
  se couber inteira, prática das fraquezas preenchendo o resto. O
  espalhamento de quem ficou dias sem estudar já vem pronto do SRS (9) — o
  planner só lê `ReviewCardService.dueFor` e reaproveita
  `buildSession`/`sessionCapacity` de `srs/domain/session.ts` direto (função
  pura, sem precisar o SRS exportar nada pra isso).
- **Unidade ligada ao objetivo do aluno é promovida dentro do mesmo nível**,
  mas nunca na frente de quem ensina o pré-requisito de uma skill dela —
  troca adjacente, um passo de cada vez (`domain/build-path.ts`). Reforço de
  fraqueza só entra se o pré-requisito dela já está dominado: sugerir
  reforço de algo cuja base o aluno nem viu ainda não ajuda.
- **`targetLevel` não existe no perfil do aluno** — é parâmetro do rebuild,
  guardado no plano; sem informar, o padrão é C1.
- **Bloco de "material personalizado sugerido" ainda não entrou.** O
  billing (11) e o generator (13) já existem; ligar o planner a eles é um
  passo à parte.
- **Portão do checkpoint é só sugestão de texto, nunca bloqueio** — o aluno
  sempre pode abrir qualquer lição, checkpoint feito ou não (ver seção 1:
  conteúdo é todo liberado).
- **Cron diário por fuso horário, não por aluno.** Um job repetível por
  fuso distinto (`repeat.tz`, o `cron-parser` do BullMQ cuida do horário de
  verão sozinho), às 00:30 local; cada disparo enfileira um rebuild por
  aluno daquele fuso. Fuso novo ganha o job na hora, via
  `profile.availability_changed` — não precisa esperar o próximo restart.
- **`rebuild` tenta de nada a trava algumas vezes antes de desistir.** O
  `user.onboarded` já dispara um rebuild em segundo plano; um cliente que
  chama `POST /me/plan/rebuild` logo depois do onboarding entraria numa
  corrida real com esse job. A montagem é rápida (curso pequeno, sem IA),
  então vale mais tentar de novo que devolver "plano não existe" pra quem
  acabou de se cadastrar.

### Assinatura e créditos (billing)

Três peças: **planos** (`SubscriptionPlan`, config em banco, editável pelo
admin), **direitos** (`EntitlementsService`) e **créditos de IA**
(`AiCreditLedgerEntry`), sobre uma assinatura no Asaas atrás de
`PaymentGateway`.

- **O tier nunca viaja no JWT.** `EntitlementsService.currentPlan` lê a
  assinatura a cada checagem — assinar ou cancelar vale na hora, sem novo
  login. `User.role` continua só para área restrita.
- **Quem gera ou usa IA pede direito e crédito ao billing**, nunca lê as
  tabelas dele: `@RequiresFeature('GENERATOR_TOPIC')` +
  `@UseGuards(RequiresFeatureGuard)` na rota (só o plano), e
  `AiCreditService.spend(userId, feature, work)` em volta do
  `AiService.run` dentro do job (o saldo). `spend` reserva no início
  (`CONSUME`, já debita) e estorna se o trabalho lançar (`REFUND`, único por
  consumo). Não existe passo de "confirmar": sucesso não escreve nada.
- **`GET /me/credits/history`** devolve o extrato (`AiCreditLedgerEntry`,
  mais recente primeiro, paginado por cursor) — é o que a tela de assinatura
  do front usa para mostrar saldo **e** histórico; `GET /me/credits` sozinho
  só tinha o saldo.
- **`GET /me/credits` traz `nextGrantAt`**: o instante (UTC) do próximo
  crédito do ciclo, pela mesma regra do cron — dia 1º, 00:05 UTC, para
  todo aluno (`nextCreditGrantAt` e `MONTHLY_GRANT_CRON` em
  [credits.ts](apps/api/src/modules/billing/domain/credits.ts); o
  scheduler lê o cron de lá). O front só formata no fuso do aluno — em São
  Paulo, isso cai às 21:05 do último dia do mês. Nunca calcule renovação no
  front.
- **"Cota do tutor" e "créditos do Plus" são o mesmo mecanismo.** Um saldo
  só, custo por feature em
  [credits.ts](apps/api/src/modules/billing/domain/credits.ts). O FREE
  também tem cota (pequena). O crédito do ciclo **repõe até a cota** — sobra
  não acumula acima dela, mas também não se perde.
- Todo lançamento roda com **trava consultiva do Postgres por aluno**
  (`pg_advisory_xact_lock`), não a trava do Redis dos módulos 7/9: o que
  precisa ser atômico é saldo + lançamento, dentro da mesma transação.
- **Crédito do plano pago sai do webhook** de pagamento confirmado; o do
  FREE (e o mês seguinte do anual) sai do cron do dia 1º, e conta nova
  recebe na hora pelo `user.registered`. Dedup por `cycleKey`
  (`PLUS:2026-09`) — assinar no meio do mês ainda credita.
- **Webhook é idempotente em duas camadas**: `jobId` na fila e a linha em
  `asaas_webhook_events`, gravada na mesma transação do efeito. O token do
  header é conferido em tempo constante; sem `ASAAS_WEBHOOK_TOKEN`, o
  gateway Asaas recusa tudo.
- **Checkout é assíncrono**, como todo I/O externo: `POST /billing/checkout`
  cria a assinatura em PENDING e enfileira; o link aparece em
  `GET /me/subscription`. Cada passo do job grava antes do próximo — o retry
  não cria cliente nem assinatura em dobro no Asaas.
- **Cancelar é um clique e vale na hora** (`CANCELED`); o job para a
  cobrança no Asaas com retry. Acesso até o fim do pago não precisa de job
  de expiração: `grantsAccess` compara `currentPeriodEnd` com agora.
  PAST_DUE ainda dá acesso (carência); EXPIRED é quando o gateway encerra
  sem o aluno ter cancelado. Excluir a conta cancela a assinatura.
- A assinatura **copia tier, período e preço** do plano: o admin mudar o
  catálogo não mexe em quem já assinou.
- O plano fica em cache no Redis (`billing:plan:v1:{userId}`, 5 min no
  máximo, e nunca além do fim de uma assinatura cancelada), derrubado pelos
  eventos `subscription.*`. Escreveu assinatura direto no banco (teste,
  script)? Chame `EntitlementsService.invalidate`.
- **Upgrade não exige cancelar.** Checkout de tier maior com uma ACTIVE vira
  uma PENDING ao lado (índices parciais: uma ACTIVE/PAST_DUE e uma PENDING
  por aluno), com desconto proporcional do que sobrou na 1ª cobrança
  (`domain/proration.ts`, piso de R$ 5 do Asaas). Quando ela paga, a antiga
  vira CANCELED no mesmo instante — cancelada **antes** de a nova virar
  ACTIVE, na mesma transação. Downgrade ainda não existe (409).
- **Dado pessoal nunca entra em job** (fica no Redis e no Bull Board): o
  cliente do Asaas, que leva o CPF, é criado no request do checkout; o job
  recebe só o id da assinatura.
- `PAYMENT_PROVIDER=auto` cai no `FakePaymentGateway` em teste ou sem
  `ASAAS_API_KEY`, igual ao `AI_PROVIDER`. O fake entende o mesmo webhook do
  Asaas — o e2e paga mandando o corpo que o Asaas mandaria.

### Travas por inversão de dependência (`src/common/access`)

Dois contratos, um mecanismo. Quem trava pergunta por um token; quem decide
é ligado **só no AppModule**, por `AccessModule.forRoot`. O que não for
ligado cai numa implementação que **nega tudo** (falha fechada).

- **`ACCESS_POLICY`** — plano do aluno. `canAccessLesson(userId, {lessonId,
unitId, cefrLevel, unitPosition})` e `canDownloadWorkbook(userId,
unitId)`, devolvendo `{allowed}` ou `{allowed: false, reason:
'PLAN_REQUIRED', requiredPlan}`. Implementada pelo billing
  (`BillingAccessPolicy`); o curriculum (4) e o learning (6) nunca importam
  o billing. `unitPosition` é o rank da unidade entre as publicadas do nível
  — o `order` não é denso, e quem sabe a ordem é o curriculum.
- **`CONTENT_GATE`** — trava editorial (QA com bloqueador, áudio faltando),
  implementada pelo content-studio. Não é por aluno; por isso contrato
  separado.

Onde a política de acesso trava (403 `PLAN_REQUIRED` com `requiredPlan`):
`GET /catalog/lessons/:slug` (antes de assinar URL de mídia),
`POST /lessons/:id/attempts`, `POST /answers` em contexto LESSON e
`GET /catalog/workbooks/:id/file`. As listagens (`/catalog/units`,
`/units/:slug`, `/workbooks`) não escondem nada: dizem `locked` e
`requiredPlan` (a apostila travada vem com `file: null`). A decisão por
aluno é aplicada **depois** do cache do catálogo, pelo
`CatalogAccessService` — o cache compartilhado nunca guarda trava.

**Revisão nunca trava.** Contexto REVIEW (e PLACEMENT/CHECKPOINT) não passa
pela política: o conteúdo já estudado continua revisável depois de
downgrade ou vencimento; só lição nova fecha.

Nos e2e, `createTestApp()` liga uma `FakeAccessPolicy` explícita (libera
tudo, `accessPolicy.deny(userId)` para negar); `{accessPolicy: 'real'}` usa
a do billing e `{accessPolicy: 'none'}`, a que nega tudo.

### Tutor (tutor)

Correção de produção livre (`tutor-correction`, tier smart) e roleplay
(`tutor-roleplay-turn`, tier fast). Tudo que chama IA roda na fila `tutor`;
as rotas de escrita respondem 202 e o cliente acompanha por polling.

- **Crédito reservado no request, estornado no job.** Saldo insuficiente é
  402 na hora, sem job à toa. Correção custa 1; roleplay custa 3 **por
  sessão** (não por turno). Sem entrega — falha na última tentativa ou
  conteúdo impróprio — o crédito volta; no roleplay, só se o personagem
  nunca chegou a responder.
- **A IA só cita id que recebeu.** O prompt leva o catálogo de ErrorPatterns
  (e, no roleplay, as skills CHUNK/VOCAB_SET do nível); o que ela inventar
  vira `null` ou sai da lista (`domain/correction.ts`, `sanitizeCorrection`).
  Melhor perder um mapeamento que gravar um erro que não existe.
- O resultado vira **`tutor.feedback`**: erros cometidos (com o trecho real
  do aluno), erros que a rubrica vigiava e não apareceram, skills da rubrica
  (met/não met) e expressões do catálogo. O learner-model (7) registra a
  oportunidade de erro e aplica evidência com peso 0,5; o SRS (9) cria ou
  lapsa card (source `TUTOR_FEEDBACK`). O tutor não escreve nas tabelas
  deles.
- **Um erro visto uma vez é "observado", não fraqueza.**
  `GET /me/learner-profile` traz `observedErrors` (≥1 ocorrência); fraqueza
  continua exigindo 3 nas últimas 30 oportunidades.
- **Roleplay**: persona do elenco (nome + bio), metas da etapa, teto de
  turnos = o menor entre a etapa e o plano (FREE 6, BASE 20, PLUS 40).
  Cenário livre só no Plus, com metas genéricas e texto tratado como não
  confiável. O fim (metas cumpridas, turnos esgotados, personagem encerrou,
  2 falas impróprias ou o aluno pediu) gera o resumo **sem nova chamada de
  IA**: metas, 3 correções principais, expressões. Só meta cumprida vira
  evidência — não chegar numa meta não prova que o aluno não sabe.
- Expressão nova só vira card se for uma skill do catálogo; `ReviewCard`
  não guarda texto livre.
- **Moderação** vem na saída validada (`safety`): impróprio é recusado (na
  correção) ou trocado pela nossa mensagem (no roleplay); fora do cenário, o
  personagem puxa de volta e não conta meta.
- **Voz** está pronta atrás de `TUTOR_VOICE_ENABLED=false`: `SpeechToText`
  (só o fake existe), áudio MP3/M4A/AAC em `uploads/`, transcrição em job e
  depois o mesmo caminho do texto. Com a flag desligada, 403
  `VOICE_DISABLED`.
- Idempotência em rede ruim: `clientRequestId` na correção e `clientTurnId`
  no turno.

### Gerador (generator)

Material do Plus em dois caminhos, na fila `generator`, com o status de
cada etapa na linha do `GenerationJob` (`GET /generator/jobs/:id`):

- **Tema** — `topic/suggest` (IA fast: 3 assuntos reais) → o aluno escolhe
  (ou "surpreenda-me") → `FETCH_SOURCE` (Wikipedia em inglês, sem IA) →
  `PICK_TARGETS` (sem IA) → `GENERATE` (smart) → `VALIDATE` → `EXERCISES`
  (fast, por aluno) → `DELIVER`.
- **Conteúdo do aluno** — `INGEST_SOURCE` (texto colado, URL de artigo ou
  link de rede social **com** a transcrição colada) → `ANALYZE` (idioma,
  gênero, tema; nível do original sem IA) → as mesmas etapas, com o texto
  do aluno no papel da fonte.

Regras que não são óbvias:

- **O material acompanha o aluno.** Nível e alvos saem do snapshot na hora
  (fraquezas → próximas skills → uma vaga para a estrutura que combina com
  o assunto, `domain/targets.ts`), e o que foi usado fica em
  `snapshotUsed`. O mesmo pedido meses depois dá outra chave de cache e
  outro nível.
- **Fato só da fonte.** Cada frase com dado precisa de uma claim cuja
  citação exista **literalmente** na fonte (sem IA) e que a IA confirme
  (`generator-fact-check`). Reprovada: uma reescrita; se ainda não se
  sustenta, a frase sai. Frase com número ou nome sem claim conta como
  reprovada.
- **Nível checado com a lista de palavras** (teto de
  `CONTENT_QA_MAX_OUT_OF_LEVEL`) e tamanho por nível
  (`domain/level-profile.ts`). Estourou: uma regeneração; de novo, o
  pedido falha com estorno. A lista ainda é pequena — a checagem vale o
  que a `coverage` diz.
- **Cache do texto base** (`MaterialBase`) por página, revisão, nível e
  alvos: outro aluno igual reaproveita sem chamar a IA, e só os exercícios
  são dele. Conteúdo do aluno **nunca** é compartilhado nem vira base.
- **Exercício é `Item` privado** (`source = AI_GENERATED`, PUBLISHED),
  validado pelas regras do banco e **autocorrigido** pelo avaliador do
  learning antes de chegar ao aluno. `findCandidates`, listagem, calibração
  e lição excluem `AI_GENERATED`; `POST /answers` recusa. Resposta só por
  `POST /me/materials/:id/answers` (contexto GENERATED_MATERIAL, uma por
  item).
- **Vocabulário vira `StudyTerm` + card TERM** (até 8 por material), e as
  skills-alvo viram card SKILL, pelo `generator.material_delivered`.
- **O aluno põe e tira termos da revisão**: `GET /me/materials/:id` traz em
  cada termo do vocabulário `termKey` (o termo normalizado) e `inReview`
  (card TERM ativo). `POST` e `DELETE /me/materials/:id/vocabulary/:termKey/review`
  põem ou tiram (suspendem) pelo `TermReviewService` do SRS — idempotentes,
  pela chave e não pelo índice, e 404 se o termo não é daquele material. O
  mesmo termo em dois materiais é um card só: tirar num tira no outro.
- **Créditos**: 5 por material, reservados no request, estornados em falha
  ou recusa. Sugerir assunto não cobra. Material já gerado não trava por
  plano.
- **Direito autoral e LGPD**: o texto colado fica em `inputText` só
  enquanto o job roda e é apagado no fim. Em letra de música, nenhuma
  frase do material copia mais de 12 palavras seguidas (e 25 no total), e
  as claims não são guardadas. Rede social **nunca** é baixada: sem a
  transcrição, 422 `TRANSCRIPT_REQUIRED`.
- **URL do aluno é buscada com cuidado**: só http/https em porta padrão,
  IP interno recusado na própria resolução do socket (sem DNS rebinding),
  até 3 redirecionamentos revalidados, `robots.txt` respeitado, só HTML e
  até `ARTICLE_MAX_BYTES`.
- **Avaliação** (`POST /me/materials/:id/feedback`): a nota vira sinal de
  interesse (só na primeira vez); "difícil/fácil demais" repetido desloca
  o nível dos próximos em um degrau (`domain/calibration.ts`).
- Wikipedia e artigo têm fake (`SOURCE_PROVIDER`/`ARTICLE_FETCH_PROVIDER`
  `auto` = fake em teste): o e2e nunca sai para a internet.

### Progresso (progress)

Painel do aluno (`GET /me/progress`) e métricas do admin
(`GET /admin/metrics`), os dois **lendo tabelas diárias**, nunca as tabelas
cruas dos outros módulos.

- **Job noturno** (fila `progress`, 04:00 UTC) reprocessa anteontem e
  ontem: aluno → lição → custo e plano → plataforma → coortes. Cada passo
  apaga e regrava o dia, então rodar de novo dá o mesmo resultado; backfill
  é `POST /admin/metrics/rebuild {from, to}` (202, até 180 dias).
- **O dia do aluno é o do fuso dele** (`UserDailyActivity`); o dia das
  tabelas de plataforma é o de `METRICS_TIMEZONE`. DAU/WAU/MAU contam pelo
  dia local de cada aluno — quase todos estão no mesmo fuso.
- O job lê **pelos serviços dos donos**, por fuso e em lotes de 500:
  `LearningActivityService` (6), `ReviewLogService` (9), `AiUsageService`
  (2), `EntitlementsService.tiersAt`/`revenueByTier` (11) e
  `UsersService.studyContexts` (3). Nada de SQL cruzando módulos.
- **Só o "hoje" do aluno é calculado no request** — um aluno, um dia, a
  mesma função do job —, para a lição que ele acabou de fazer aparecer.
- Tempo estudado = etapas de lição + tempo de resposta fora de lição +
  flashcards × 25 s (a constante da sessão do SRS). Tutor e roleplay não
  têm tempo medido: contam só como atividade.
- **Abandono** = tentativa IN_PROGRESS sem atividade há 7 dias, contada uma
  vez, no dia em que completa o prazo, na etapa em que parou.
- **Erro diminuindo** compara a taxa da metade antiga com a da recente da
  janela de oportunidades do learner-model (mínimo 6) — taxa, não contagem.
- **Previsão pelo ritmo**: o forecast do planner escalado por planejado ÷
  realizado das últimas 4 semanas completas desde o cadastro. Com menos de
  2 semanas, "ainda cedo".
- Ação de cada fraqueza, nessa ordem: a lição que ensina (se não foi
  feita) → a revisão (se há card) → material do generator (só Plus) →
  refazer a lição → a prática da agenda.
- **Receita é MRR** (anual ÷ 12) das assinaturas com acesso no dia, não
  caixa — não existe tabela de pagamento recebido. Custo de IA em US$ vira
  R$ pelo câmbio fixo `USD_BRL_RATE`, que o relatório mostra.
- O plano de um dia passado é reconstruído do estado atual da assinatura
  (`grantedAccessAt`): cancelada depois daquele dia ainda valia; EXPIRED
  não entra.

### Notificações (notifications)

Lembretes em cima do planner: o **diário** (plano de hoje não iniciado),
o de **revisões acumulando** e o **resumo semanal** do progresso (14).

- **E-mail é o canal padrão** (o `MailService` do infra, provedor por
  `MAIL_PROVIDER`). **Web Push é opcional**: o aluno ativa em Perfil →
  Notificações, o front assina com a chave VAPID e manda a inscrição —
  uma por navegador (`PushSubscription`). 404/410 do serviço de push apaga
  a inscrição. Sem as chaves VAPID, as rotas de push dão 409
  `PUSH_UNAVAILABLE` e o e-mail segue. Canal novo (push de app) é mais uma
  implementação de `NotificationChannel`.
- **Um tick por fuso, de hora em hora** (fila `notifications`, mesma ideia
  do planner): pega quem daquele fuso tem o lembrete nesta hora e enfileira
  um job por aluno. A hora é a escolhida em `reminderHour` ou sai do
  `preferredStudyTime` (manhã 8h, tarde 13h, noite 19h, madrugada 21h,
  qualquer 19h). O resumo semanal sai na segunda, na mesma hora, só por
  e-mail, com os números da semana anterior.
- **"Não iniciou" = não estudou hoje no fuso dele** (etapa, resposta, lição
  aberta ou revisão), lido pelos serviços do learning e do SRS. A agenda
  não tem estado de "iniciada".
- **No máximo um lembrete por dia**, somando diário e revisões acumuladas:
  o `NotificationLog.dedupKey` (`reminder:{aluno}:{dia local}`) é único e
  é gravado **antes** de enviar — dois jobs no mesmo dia, o segundo perde
  na inserção. Nenhum canal entregou: a linha sai e o job tenta de novo.
- Revisões acumuladas: 25+ vencidas, no máximo a cada 3 dias; nesse dia
  substitui o diário. Horário silencioso (padrão 22h–8h) bloqueia tudo;
  hora escolhida dentro dele é recusada (422).
- **Textos específicos e sem culpa** (`domain/messages.ts`): quanto tempo
  falta e o quê — "Faltam 12 min para fechar o plano de hoje: 1 revisão e
  a lição "At the airport"". Nada de "você esqueceu", sequência em risco
  ou exclamação. O bloco da agenda guarda `title` e `count` para isso.
- Todo e-mail de aviso tem link "parar de receber" daquele tipo: token
  HMAC (`aluno.tipo`, sem estado), o front chama
  `POST /notifications/unsubscribe`.

### Erros e logs

- Erro de negócio: `AppException` (ou as subclasses em
  [app.exception.ts](apps/api/src/common/errors/app.exception.ts)) com `code`
  em inglês e `message` em pt-BR.
- O filtro global normaliza toda resposta de erro para:

  ```json
  {
    "error": {
      "code": "NOT_FOUND",
      "message": "Não encontramos o que você procura."
    }
  }
  ```

  `details` é opcional e carrega contexto (ex.: issues do zod). Detalhe
  interno de erro 500 **nunca** vaza — vai só para o log.

- Logs estruturados com pino, sempre com `requestId`. O mesmo id volta no
  header **`x-request-id`** da resposta (o corpo do erro não o carrega).
- **Nunca logue** token, senha, chave de API ou conteúdo enviado pelo aluno.

### Paginação

**Listagem pagina por cursor, nunca por offset.** Use
`CursorPaginationQueryDto` no controller e, no service, `toPrismaCursorArgs`
e `buildPage` de [cursor.ts](apps/api/src/common/pagination/cursor.ts). O
cursor é opaco (base64url) — o cliente só devolve o que recebeu.

### Storage

Injete a classe abstrata `StorageService`, nunca a implementação S3. Toda
chave nasce de `buildStorageKey()` com um dos prefixos: `content/`,
`generated/`, `uploads/`, `exports/`.

### Eventos

Todo evento é declarado em [events.ts](apps/api/src/common/events.ts) e
emitido pelo `EventBusService` — nunca pelo `EventEmitter2` cru. Nome e
payload são conferidos em tempo de compilação.

### Filas

Registre com `registerQueue(QUEUES.X)` e decore o processor com
`@Processor(QUEUES.X, defaultWorkerOptions())`. Isso já traz retry com
backoff exponencial, limpeza e a concorrência do `QUEUE_CONCURRENCY`.
O painel fica em `/admin/queues`.

### Banco

- Model em PascalCase singular (`ReviewCard`), tabela em snake_case plural
  via `@@map` (`review_cards`), coluna em snake_case via `@map`.
- Toda tabela tem `id` (uuid), `created_at` e `updated_at`.
- Uma migration por PR, com nome descritivo.

### Commits

Conventional Commits, com scope da tabela de módulos:

```
feat(srs): add sm2 scheduling algorithm
fix(learning): keep attempt idempotent on retry
```

`husky` + `lint-staged` rodam prettier e eslint no commit; `commitlint`
valida a mensagem.

---

## 5. Front-end

**Estado atual: fundação pronta (design system, cliente de API, esqueleto
dos dois apps). Nenhuma tela de negócio ainda** — cada uma entra como um
módulo à parte, igual ao back-end.

### Pacotes

| Pacote                | O que é                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- |
| `apps/web`            | App do aluno — React + Vite + TypeScript, mobile-first.                                 |
| `apps/admin`          | Painel interno para `EDITOR`/`ADMIN` — mesma stack, só desktop.                         |
| `packages/ui`         | Design system compartilhado (tokens, componentes, Ladle).                               |
| `packages/api-client` | Cliente HTTP tipado, auth (access token em memória + refresh), hooks de TanStack Query. |

`packages/ui` e `packages/api-client` **não têm build** — só são consumidos
por bundlers Vite (os dois apps e o Ladle), que apontam um alias direto para
o `src/` de cada um (ver `resolve.alias` em `vite.config.ts`). Evita a
complexidade de build dupla ESM/CJS que `packages/shared` precisa (esse
também é consumido pela API Nest, que roda a partir de `dist/`).

### Convenções

- **Componentes em PascalCase**, um por arquivo/pasta.
- **Tela = pasta com `index.tsx` (visual) + `use<Pagina>Controller.ts`
  (lógica)** — o componente só recebe o que o hook devolve e renderiza; nada
  de `useState`/`useEffect`/chamada de API dentro do `index.tsx`. Padrão do
  projeto de referência `fincheck/fe`.
- **Toda tela de negócio vive em `src/features/<nome>/<Pagina>/`.**
  `src/pages/` é só para telas sem domínio (404, e por enquanto os
  placeholders "em construção" do admin).
- **Hook de dado só existe em `packages/api-client`.** Nenhum componente ou
  controller chama `fetch` direto — sempre `apiFetch`/os hooks de
  `modules/<recurso>` do api-client. Um recurso novo do back-end vira um
  arquivo novo em `packages/api-client/src/modules/<recurso>/`
  (`schemas.ts` + `service.ts` + `hooks.ts`), do mesmo jeito que o auth.
- **Schema de request/response é zod.** Vem de `packages/shared` quando já
  existe lá (ex.: `Role`); quando a DTO do back-end ainda não é exportada
  para `shared`, o api-client define o próprio schema espelhando o
  contrato do controller (é o caso hoje do módulo `auth`).
- **Mensagens em `src/messages/pt-BR.ts`** por app, um dicionário plano lido
  por `t(key)` — sem lib de i18n. Texto de tela nunca é string solta no
  componente.
- **Tema claro/escuro** é `data-theme` em `<html>` (`useTheme` de
  `packages/ui`), nunca uma classe custom por componente.

### Autenticação no front

- Access token **só em memória** (`token-store` do api-client) — nunca em
  `localStorage`. Some a cada reload; quem recupera a sessão é o
  `AuthProvider` de cada app, chamando `refreshSession()` (cookie httpOnly)
  ao montar.
- 401 fora de `/auth/*` dispara refresh automático com fila (uma chamada só,
  mesmo com requisições concorrentes) e repete a chamada original;
  falhando, emite o evento `unauthenticated` (`http/events.ts`) — cada app
  escuta e limpa a store de sessão, o `AuthGuard` redireciona para
  `/login`.
- `PLAN_REQUIRED`/`INSUFFICIENT_CREDITS` viram eventos globais do mesmo
  jeito; hoje só documentam o contrato — o paywall visual entra com a
  primeira tela que precisar dele.
- CSRF: o cliente lê o cookie legível `csrf_token` direto do navegador
  (`http/csrf-cookie.ts`) e copia para o header `x-csrf-token` nas rotas que
  dependem do cookie (`/auth/refresh`, `/auth/logout`) — nunca guarda esse
  valor em outro lugar.

### Ferramentas do Plus (`apps/web/src/features/generator`)

| Rota                           | Tela                                                                |
| ------------------------------ | ------------------------------------------------------------------- |
| `/ferramentas`                 | Hub: saldo, custo, os dois cartões. Não Plus: paywall com exemplo.  |
| `/ferramentas/tema`            | Interesse → `?sugestoes=<jobId>` (3 assuntos) / surpreenda-me.      |
| `/ferramentas/colar`           | Abas Texto e Link; rede social pede transcrição; limite visível.    |
| `/ferramentas/pedidos/:jobId`  | Acompanhamento em 4 fases (`lib/job-phases.ts`); pronto → material. |
| `/materiais`, `/materiais/:id` | Lista com a evolução do nível; o material completo.                 |

- **A URL é o estado do pedido**: sair e voltar para
  `/ferramentas/pedidos/:jobId` retoma o polling. O `localStorage` só guarda
  o último pedido para o atalho "Acompanhar" do hub.
- **"Ferramentas" fica só na barra lateral do desktop** (`mobile: false` em
  `nav-items.ts`) — a barra do celular tem 5 itens. No celular, o caminho é
  o `PlusToolsCard` da tela Hoje e do Catálogo (para quem não é Plus, ele
  leva ao paywall com o exemplo).
- `402 INSUFFICIENT_AI_CREDITS` é tratado na própria tela (saldo, custo e
  `nextGrantAt` no fuso do aluno), não pelo evento global.
- `t(key, params)` troca `{nome}` no texto — ainda sem lib de i18n.

### Tokens do design system (`packages/ui/src/styles/tokens.css`)

Variáveis CSS lidas pelo `@theme` do Tailwind v4; o escuro sobrescreve as
mesmas variáveis sob `prefers-color-scheme` (tema "sistema") ou
`[data-theme="dark"]` (tema escolhido).

| Token      | Claro      | Escuro     |
| ---------- | ---------- | ---------- |
| `ground`   | `#EEF3F1`  | `#0F1816`  |
| `surface`  | `#FFFFFF`  | `#17231F`  |
| `ink`      | `#13231F`  | `#E6EEEA`  |
| `muted`    | `#56675F`  | `#9DB0A8`  |
| `line`     | `#CCD8D3`  | `#2C3D37`  |
| `accent`   | `#0E6B5A`  | `#3FBFA2`  |
| `chunk`    | `#F5C04A`  | `#F5C04A`  |
| `chunk-bg` | `#FFF1CC`  | `#3A3016`  |
| `ok`       | `#1E7A45`  | `#1E7A45`  |
| `error`    | `#B23A2E`  | `#B23A2E`  |
| `maya`     | `#7A4FBF`  | `#7A4FBF`  |
| `lucas`    | = `accent` | = `accent` |

Tipografia: `--font-display` (Bricolage Grotesque, títulos), `--font-body`
(Atkinson Hyperlegible, texto), `--font-mono` (JetBrains Mono, rótulos e
números) — self-hospedadas via `@fontsource`, sem depender de rede externa.

Componentes base em `packages/ui/src/components/`: Button, Input, Textarea,
Select, Checkbox, Chip, Card, Badge, Tabs, Dialog, Sheet, Toast, Tooltip,
Popover, ProgressBar, StepDots, CharacterAvatar, Skeleton, EmptyState,
ErrorState, AudioButton, Mark. Cada um tem `.stories.tsx` (Ladle) e
`.test.tsx` (Vitest + Testing Library) ao lado.

### Como rodar

```bash
pnpm dev                                    # web em :5173, admin em :5174
pnpm --filter @english-saas/ui storybook    # Ladle em :61000
pnpm test                                   # Vitest nos 4 pacotes de front
pnpm --filter @english-saas/web test:e2e    # Playwright (build + preview)
pnpm --filter @english-saas/admin test:e2e
```

`VITE_API_URL` vem do `.env` único na raiz (mesmo arquivo do back-end) — os
`vite.config.ts` dos dois apps apontam `envDir` para lá.

## 6. Glossário do domínio

| Termo                 | O que é                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **CEFR level**        | Nível do quadro europeu: A1, A2, B1, B2, C1. Usado para o aluno, para o conteúdo e para o item.                                      |
| **Skill**             | Habilidade concreta e ensinável — "falar de rotina no presente simples", "pedir comida num restaurante".                             |
| **Competency**        | Eixo de avaliação: `GRAMMAR`, `VOCABULARY`, `LISTENING`, `READING`, `WRITING`, `SPEAKING`. O aluno tem um nível **por eixo**.        |
| **Lesson**            | Unidade de estudo completa: cena → cards → prática → produção → roleplay.                                                            |
| **LessonStep**        | Um passo dentro da lição, com tipo próprio (`scene`, `explanation`, `recognize`, `assemble`, `produce`, `free_writing`, `roleplay`). |
| **Item**              | Questão individual, com dificuldade calibrada, competência alvo e Skill associada. É o tijolo dos questionários e provas.            |
| **LessonAttempt**     | Uma passada do aluno por uma lição, presa à versão que ele fez: etapas concluídas, XP, de onde ele veio (plano, livre, revisão).     |
| **Answer**            | Uma resposta a um Item, já corrigida: o que respondeu, score, tempo, dicas, erros típicos revelados e se foi a primeira tentativa.   |
| **Mastery**           | Quanto o aluno domina uma Skill, estimado a partir das Answers. Decai com o tempo sem prática.                                       |
| **ReviewCard**        | Cartão de revisão espaçada (FSRS) ligado a uma Skill, RegisterNote ou ErrorPattern: `kind` diz a qual, `due` diz quando.             |
| **StudyPlan**         | Cronograma personalizado do aluno — o caminho recomendado ao longo de semanas. Recomendação, **não** bloqueio.                       |
| **Agenda**            | O recorte de hoje do StudyPlan: blocos de revisão, lição e prática, cada um com um motivo em pt-BR.                                  |
| **RegisterNote**      | Nota que contrasta a forma gramatical padrão com a forma falada no dia a dia (`I'm going to` × `I'm gonna`).                         |
| **ErrorPattern**      | Erro típico de brasileiro, ligado a Skills: `l1.have-for-age` ("I have 20 years"), `article.country-the`, `third-person-s`.          |
| **Span**              | Marcação `{start, end, kind}` sobre um trecho de texto de cena ou card. É o que permite destacar estrutura e chunk na interface.     |
| **ContentDraft**      | Um pedido de rascunho à IA e sua proveniência: qual prompt, qual versão, quanto custou, quem pediu e o que foi criado.               |
| **QaWarning**         | Achado da revisão automática: `{code, severity, message, path}`. `BLOCKER` trava a aprovação; `WARNING` e `INFO` só informam.        |
| **GeneratedMaterial** | Material criado pela IA para um aluno (Plus): a partir de um tema de interesse ou de um conteúdo que ele enviou.                     |
| **MaterialBase**      | Texto base validado de um tema (fonte, nível, alvos). Compartilhado entre alunos; os exercícios são sempre de cada um.               |
| **UserDailyActivity** | O dia de estudo de um aluno no fuso dele: tempo, lições, respostas, revisões, acerto por competência, custo de IA e plano.           |
| **ReviewLog**         | Uma revisão feita (card, tipo, rating, quando). Append-only; é o histórico que o progresso conta.                                    |
| **StudyTerm**         | Termo de vocabulário solto do aluno, vindo de um material gerado. É o que o card TERM do SRS revisa.                                 |
| **TutorCorrection**   | Um pedido de correção de produção livre e o resultado validado (erros mapeados para ErrorPatterns, rubrica, dicas de registro).      |
| **RoleplaySession**   | Conversa com um personagem, com metas, teto de turnos e o resumo do fim.                                                             |
| **AiCredit**          | Unidade de consumo das ferramentas de IA (todo plano tem cota; o Plus, a maior). Debitada por uso e reposta no ciclo.                |

---

## 7. Como trabalhar comigo

### Antes de codar um módulo

Apresente um **plano curto** — não um documento. Quatro blocos:

1. **Entidades** — models Prisma novos ou alterados, com os campos que
   importam.
2. **Endpoints** — método, rota e para que serve.
3. **Jobs e eventos** — o que vai para a fila, o que é emitido, quem escuta.
4. **Testes** — que funções de `domain/` ganham teste unitário e que fluxo
   ganha e2e.

Aponte também o que ficou de fora e o que depende de decisão minha. Espere
meu ok e então siga o plano.

### Ao terminar

1. Rode `pnpm lint` e `pnpm test` (e `pnpm test:e2e` se o módulo tem rota).
2. Liste, em três partes:
   - **O que foi feito** — arquivos e capacidades novas.
   - **Decisões tomadas** — escolhas que eu não pedi explicitamente, com o
     porquê.
   - **Pendências** — o que ficou faltando, o que é dívida consciente e o que
     precisa de decisão minha.
3. Relate o resultado honestamente. Teste quebrado se reporta como quebrado,
   com a saída junto.

### Regras de convivência

- **Não troque nada da stack** sem perguntar.
- **Não implemente o módulo seguinte** porque "já estava ali". Um por vez.
- Achou um problema no que eu pedi? Diga em uma ou duas frases e **continue**
  — entregue o combinado e deixe a decisão comigo.
- Em dúvida entre duas leituras do pedido: se mudam o resultado de verdade,
  pergunte; se não, escolha, siga e me avise o que escolheu.

---

## 8. Ambiente local

```bash
cp .env.example .env
docker compose up -d          # postgres, postgres-test, redis, minio
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev                      # api em :3333, web em :5173
curl http://localhost:3333/health
```

**Atenção às portas:** postgres em `5432`, postgres-test em `5433`, redis em
`6379`, minio em `9000`/`9001`. Se você tem outros projetos usando essas
portas, pare os containers deles antes.

Verificação completa: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
