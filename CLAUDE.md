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

- **Conteúdo base é igual para todos e todo liberado.** Lições, apostilas em
  PDF e trilhas podem ser acessadas em qualquer ordem, a qualquer momento.
  Nada de bloquear conteúdo por progresso.
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
| 6   | `learning`                      | 5          | Player da lição: passos, tentativas, prática em camadas, produção livre, correção                     |
| 7   | `learner-model`                 | 6          | Nível por competência, mastery, erros recorrentes, forças e fraquezas, interesses                     |
| 8   | `assessment`                    | 7          | Questionários e provas adaptativos, nivelados pelo aluno, certificação de nível                       |
| 9   | `srs`                           | 7          | Revisão espaçada: `ReviewCard`, agendamento, fila diária de revisão                                   |
| 10  | `planner`                       | 8, 9       | Cronograma personalizado e agenda diária — recomendação, nunca bloqueio                               |
| 11  | `billing`                       | 3          | Asaas atrás de `PaymentGateway`, planos, assinatura, webhooks, `AiCredit` do Plus                     |
| 12  | `tutor`                         | 2, 7, 11   | Roleplay com IA, conversa livre, feedback usando o modelo do aluno                                    |
| 13  | `generator`                     | 2, 7, 11   | Plus (a) tema → fato real com fonte; (b) conteúdo colado/URL → material e exercícios                  |
| 14  | `progress`                      | 7, 9, 10   | Painel do aluno, streak, histórico, evolução por competência                                          |
| 15  | `notifications`                 | 10         | E-mail, push, lembrete de revisão e de cronograma                                                     |
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
chegam lá pelo `ContentGate`: contrato declarado no módulo 4, implementado
pelo 5 como provider global e injetado com `@Optional()`. Efeito colateral
(gerar áudio, gerar PDF) **não** passa pelo gate — passa por evento.

A checagem de nível usa a lista de frequência de
`packages/shared/src/wordlists`, gerada a partir do CSV versionado em
`packages/shared/data` por `pnpm wordlist:import`. Palavra fora da lista
**não** conta como fora do nível, e o relatório traz `coverage` justamente
para dizer o quanto aquele número vale.

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

- `buildPage` de [cursor.ts](apps/api/src/common/pagination/cursor.ts). O
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

## 5. Glossário do domínio

| Termo                 | O que é                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **CEFR level**        | Nível do quadro europeu: A1, A2, B1, B2, C1. Usado para o aluno, para o conteúdo e para o item.                                      |
| **Skill**             | Habilidade concreta e ensinável — "falar de rotina no presente simples", "pedir comida num restaurante".                             |
| **Competency**        | Eixo de avaliação: `GRAMMAR`, `VOCABULARY`, `LISTENING`, `READING`, `WRITING`, `SPEAKING`. O aluno tem um nível **por eixo**.        |
| **Lesson**            | Unidade de estudo completa: cena → cards → prática → produção → roleplay.                                                            |
| **LessonStep**        | Um passo dentro da lição, com tipo próprio (`scene`, `explanation`, `recognize`, `assemble`, `produce`, `free_writing`, `roleplay`). |
| **Item**              | Questão individual, com dificuldade calibrada, competência alvo e Skill associada. É o tijolo dos questionários e provas.            |
| **Attempt**           | Uma resposta do aluno a um Item ou LessonStep: o que respondeu, se acertou, quanto tempo levou, que erro cometeu.                    |
| **Mastery**           | Quanto o aluno domina uma Skill, estimado a partir dos Attempts. Decai com o tempo sem prática.                                      |
| **ReviewCard**        | Cartão de revisão espaçada ligado a uma Skill ou item de vocabulário: quando revisar, intervalo atual, facilidade.                   |
| **StudyPlan**         | Cronograma personalizado do aluno — o caminho recomendado ao longo de semanas. Recomendação, **não** bloqueio.                       |
| **Agenda**            | O recorte de hoje do StudyPlan: o que fazer agora (lições sugeridas + fila de revisão).                                              |
| **RegisterNote**      | Nota que contrasta a forma gramatical padrão com a forma falada no dia a dia (`I'm going to` × `I'm gonna`).                         |
| **ErrorPattern**      | Erro típico de brasileiro, ligado a Skills: `l1.have-for-age` ("I have 20 years"), `article.country-the`, `third-person-s`.          |
| **Span**              | Marcação `{start, end, kind}` sobre um trecho de texto de cena ou card. É o que permite destacar estrutura e chunk na interface.     |
| **ContentDraft**      | Um pedido de rascunho à IA e sua proveniência: qual prompt, qual versão, quanto custou, quem pediu e o que foi criado.               |
| **QaWarning**         | Achado da revisão automática: `{code, severity, message, path}`. `BLOCKER` trava a aprovação; `WARNING` e `INFO` só informam.        |
| **GeneratedMaterial** | Material criado pela IA para um aluno (Plus): a partir de um tema de interesse ou de um conteúdo que ele enviou.                     |
| **AiCredit**          | Unidade de consumo das ferramentas de IA do plano Plus. Debitada por geração e reposta no ciclo da assinatura.                       |

---

## 6. Como trabalhar comigo

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

## 7. Ambiente local

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
