# english-saas

Plataforma de ensino de inglês para brasileiros, do A1 ao C1.

Lições interativas em formato de série: cena em áudio com personagens fixos →
explicação em português → prática em camadas → produção livre corrigida por
IA → roleplay → revisão espaçada. O conteúdo base é igual para todos e
liberado em qualquer ordem; o cronograma personalizado é o caminho
recomendado, não uma trava.

O contexto completo do produto e as convenções de código estão em
[CLAUDE.md](CLAUDE.md).

> **Estado atual:** módulo 0 (setup). O foco é o back-end — `apps/web` é um
> placeholder.

---

## Stack

pnpm workspaces + Turborepo · NestJS · PostgreSQL 16 + Prisma · Redis +
BullMQ · S3 (MinIO local) · zod + nestjs-zod · React + Vite + Tailwind +
TanStack Query · OpenAI · Asaas · Jest + Supertest

## Estrutura

```
apps/
  api/          NestJS — src/modules, src/common, src/infra
  web/          React + Vite + Tailwind (placeholder)
packages/
  shared/       tipos e schemas zod compartilhados (tsup)
  eslint-config/  presets ESLint flat config
  tsconfig/     tsconfigs base
```

---

## Subindo o ambiente local

### Pré-requisitos

- Node.js 20+ (testado no 24)
- pnpm 10+
- Docker + Docker Compose

### Passo a passo

```bash
# 1. variáveis de ambiente (os defaults já apontam para o docker compose)
cp .env.example .env

# 2. postgres, postgres-test, redis e minio
docker compose up -d

# 3. dependências
pnpm install

# 4. Prisma client + migrations
pnpm db:generate
pnpm db:migrate

# 5. api (:3333) e web (:5173)
pnpm dev
```

Confira que subiu:

```bash
curl http://localhost:3333/health
```

```json
{
  "status": "ok",
  "uptimeSeconds": 12,
  "version": "0.0.0",
  "timestamp": "2026-09-23T21:27:09.262Z",
  "dependencies": {
    "database": { "status": "up", "latencyMs": 7 },
    "redis": { "status": "up", "latencyMs": 4 }
  }
}
```

Responde **503** quando o banco ou o Redis estão fora.

### Serviços e portas

| Serviço         | Porta       | Observação                                 |
| --------------- | ----------- | ------------------------------------------ |
| `postgres`      | 5432        | banco de desenvolvimento                   |
| `postgres-test` | 5433        | banco dos testes e2e, em tmpfs             |
| `redis`         | 6379        | filas BullMQ e cache                       |
| `minio`         | 9000 / 9001 | S3 local; console em http://localhost:9001 |
| api             | 3333        |                                            |
| web             | 5173        |                                            |

O bucket `english-saas` é criado automaticamente na primeira subida (serviço
`minio-init`). Credenciais do console: `minioadmin` / `minioadmin`.

> **Conflito de portas:** se você já tem um Postgres em 5432 ou um Redis em
> 6379 de outro projeto, pare aqueles containers antes de subir este.

---

## Scripts

Todos rodam na raiz do monorepo, via Turborepo.

| Comando            | O que faz                                     |
| ------------------ | --------------------------------------------- |
| `pnpm dev`         | api em watch + web em watch                   |
| `pnpm build`       | build de todos os pacotes                     |
| `pnpm lint`        | ESLint em tudo                                |
| `pnpm test`        | testes unitários (Jest)                       |
| `pnpm test:e2e`    | testes e2e (Supertest) contra `postgres-test` |
| `pnpm typecheck`   | `tsc --noEmit` em tudo                        |
| `pnpm format`      | Prettier (escrita)                            |
| `pnpm db:migrate`  | cria e aplica migration em desenvolvimento    |
| `pnpm db:deploy`   | aplica migrations pendentes (CI / produção)   |
| `pnpm db:generate` | gera o Prisma Client                          |
| `pnpm db:seed`     | popula o conteúdo base                        |
| `pnpm db:studio`   | abre o Prisma Studio                          |
| `pnpm db:reset`    | derruba e recria o banco de desenvolvimento   |

Verificação completa, igual à do CI:

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```

---

## Testes

- **Unitários** (`pnpm test`): focam nas funções puras de `domain/` de cada
  módulo. Não sobem banco nem Nest.
- **E2E** (`pnpm test:e2e`): sobem a aplicação de verdade contra o
  `postgres-test` (porta 5433, recriado a cada subida do container). O
  `DATABASE_TEST_URL` do `.env` é aplicado automaticamente em
  [test/setup-e2e.ts](apps/api/test/setup-e2e.ts).

---

## Convenções rápidas

- Código, tabelas, endpoints e commits em **inglês**; texto para o aluno em
  **pt-BR**.
- Regra de negócio vive em função pura em `domain/`, com teste unitário. O
  ESLint bloqueia import de framework dentro de `domain/`.
- Tarefa lenta ou que chama IA vai para a fila (BullMQ) — o request HTTP não
  bloqueia.
- Toda saída de IA passa por `zod.parse()` antes de ser usada ou salva.
- Listagens paginam por cursor.

O detalhamento está em [CLAUDE.md](CLAUDE.md).

## Commits

Conventional Commits, com scope da tabela de módulos do CLAUDE.md:

```
feat(srs): add sm2 scheduling algorithm
fix(learning): keep attempt idempotent on retry
```

`husky` + `lint-staged` formatam e lintam no commit; `commitlint` valida a
mensagem. O CI roda lint, format, testes e build em todo PR.
