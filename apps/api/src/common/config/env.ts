import { z } from 'zod';

const booleanFromString = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

/**
 * Variável opcional. No `.env` uma chave ainda não preenchida aparece como
 * `OPENAI_API_KEY=` — string vazia, que aqui vale o mesmo que ausente.
 */
const optional = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().min(1).optional(),
);

/**
 * Contrato das variáveis de ambiente da API.
 *
 * Obrigatórias já no módulo 0: banco, Redis e JWT — sem elas a API não sobe.
 * Opcionais por enquanto: S3, OpenAI e Asaas. Elas passam a ser exigidas
 * quando os módulos 1 (infra), 2 (ai) e 11 (billing) forem implementados.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  API_URL: z.url().default('http://localhost:3333'),
  WEB_URL: z.url().default('http://localhost:5173'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  DATABASE_TEST_URL: optional,

  REDIS_URL: z.string().min(1, 'REDIS_URL é obrigatória'),
  QUEUE_PREFIX: z.string().min(1).default('english-saas'),

  S3_ENDPOINT: optional,
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: optional,
  S3_ACCESS_KEY_ID: optional,
  S3_SECRET_ACCESS_KEY: optional,
  S3_FORCE_PATH_STYLE: booleanFromString.default(true),
  S3_PUBLIC_URL: optional,

  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET precisa de ao menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_SECRET: optional,
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('30d'),

  OPENAI_API_KEY: optional,
  AI_MODEL_FAST: z.string().min(1).default('gpt-4o-mini'),
  AI_MODEL_SMART: z.string().min(1).default('gpt-4o'),
  AI_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).default(2),
  AI_MONTHLY_CREDITS_PLUS: z.coerce.number().int().min(0).default(500),

  ASAAS_API_KEY: optional,
  ASAAS_BASE_URL: z.url().default('https://sandbox.asaas.com/api/v3'),
  ASAAS_WEBHOOK_TOKEN: optional,

  WIKIPEDIA_USER_AGENT: z.string().min(1).default('english-saas/0.1'),
  WIKIPEDIA_API_URL: z.url().default('https://pt.wikipedia.org/w/api.php'),
  CONTENT_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  CONTENT_MAX_CHARS: z.coerce.number().int().positive().default(40_000),

  THROTTLE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida o ambiente uma única vez, na subida. Falha cedo e com mensagem
 * legível em vez de quebrar mais tarde dentro de um job.
 */
export function validateEnv(source: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Variáveis de ambiente inválidas:\n${issues}\n\nConfira o .env na raiz do monorepo (base: .env.example).`,
    );
  }

  return parsed.data;
}
