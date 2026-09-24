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

const modelPricingSchema = z.object({
  inputPerMTokUsdMicros: z.number().int().min(0),
  outputPerMTokUsdMicros: z.number().int().min(0),
});

/** Preços padrão (USD micros por 1M tokens), usados quando o env não traz. */
const DEFAULT_PRICING = {
  'gpt-4o': {
    inputPerMTokUsdMicros: 2_500_000,
    outputPerMTokUsdMicros: 10_000_000,
  },
  'gpt-4o-mini': {
    inputPerMTokUsdMicros: 150_000,
    outputPerMTokUsdMicros: 600_000,
  },
  'gpt-4.1': {
    inputPerMTokUsdMicros: 2_000_000,
    outputPerMTokUsdMicros: 8_000_000,
  },
  'gpt-4.1-mini': {
    inputPerMTokUsdMicros: 400_000,
    outputPerMTokUsdMicros: 1_600_000,
  },
};

/** Aceita a tabela de preços como JSON no env; sem valor, usa o padrão. */
const pricingTableFromJson = z.preprocess(
  (value) => {
    if (
      value === undefined ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      return DEFAULT_PRICING;
    }

    if (typeof value !== 'string') {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      // Devolve como veio: o zod abaixo reclama com mensagem legível.
      return value;
    }
  },
  z.record(z.string(), modelPricingSchema),
);

/**
 * Contrato das variáveis de ambiente da API.
 *
 * Obrigatórias: banco, Redis, JWT, S3 e a credencial do Bull Board — sem
 * qualquer uma delas a API não sobe, e a mensagem diz exatamente qual falta.
 * Opcional por enquanto: Asaas. Passa a ser exigida no módulo 11 (billing).
 * A chave da OpenAI também é opcional: sem ela o módulo `ai` cai no provider
 * fake e avisa no log, para o ambiente local subir sem crédito.
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
  /** Quantos jobs um worker processa em paralelo, por fila. */
  QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(5),
  /** Tentativas por job antes de ele ir para a lista de falhas. */
  QUEUE_ATTEMPTS: z.coerce.number().int().positive().default(3),
  /** Atraso inicial do backoff exponencial entre tentativas. */
  QUEUE_BACKOFF_MS: z.coerce.number().int().positive().default(2_000),
  /** Credencial do painel Bull Board em /admin/queues. */
  BULL_BOARD_USER: z.string().min(1, 'BULL_BOARD_USER é obrigatória'),
  BULL_BOARD_PASSWORD: z
    .string()
    .min(8, 'BULL_BOARD_PASSWORD precisa de ao menos 8 caracteres'),

  S3_ENDPOINT: z.string().min(1, 'S3_ENDPOINT é obrigatória'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1, 'S3_BUCKET é obrigatória'),
  S3_ACCESS_KEY_ID: z.string().min(1, 'S3_ACCESS_KEY_ID é obrigatória'),
  S3_SECRET_ACCESS_KEY: z.string().min(1, 'S3_SECRET_ACCESS_KEY é obrigatória'),
  S3_FORCE_PATH_STYLE: booleanFromString.default(true),
  /** Base das URLs públicas. Sem ela, montamos a partir do endpoint. */
  S3_PUBLIC_URL: optional,
  /** Validade padrão de uma URL assinada. */
  S3_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET precisa de ao menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_SECRET: optional,
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('30d'),

  OPENAI_API_KEY: optional,
  /**
   * 'auto' escolhe sozinho: fake em NODE_ENV=test ou sem OPENAI_API_KEY,
   * OpenAI no resto. 'fake' e 'openai' forçam a escolha.
   */
  AI_PROVIDER: z.enum(['auto', 'openai', 'fake']).default('auto'),
  AI_MODEL_FAST: z.string().min(1).default('gpt-4o-mini'),
  AI_MODEL_SMART: z.string().min(1).default('gpt-4o'),
  /**
   * Preço por modelo, em micros de dólar por 1 milhão de tokens.
   * Fora do código de propósito: preço muda sem merecer deploy.
   */
  AI_PRICING_JSON: pricingTableFromJson,
  /** TTL padrão do cache de IA. Cada prompt pode encurtar o seu. */
  AI_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(86_400),
  /** Teto de caracteres de conteúdo do aluno, quando o prompt não define. */
  AI_MAX_INPUT_CHARS: z.coerce.number().int().positive().default(20_000),
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
