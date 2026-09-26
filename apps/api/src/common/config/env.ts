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
 * Opcional: Asaas. Sem a chave o billing cai no gateway fake e avisa no
 * log (`PAYMENT_PROVIDER=auto`); em produção use `PAYMENT_PROVIDER=asaas`.
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
  /** Validade do refresh token, em dias. */
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /**
   * Cookie do refresh token.
   *
   * `AUTH_COOKIE_DOMAIN` precisa ser o domínio pai (ex.: `.exemplo.com.br`)
   * para o cookie valer entre `app.` e `api.`. Em localhost fica vazio: o
   * browser recusa cookie com domínio para host sem ponto.
   */
  AUTH_COOKIE_DOMAIN: optional,
  AUTH_COOKIE_SECURE: booleanFromString.default(false),
  AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  /** OAuth do Google. Sem client id, o login social fica desligado. */
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  /** Precisa bater exatamente com o cadastrado no console do Google. */
  GOOGLE_REDIRECT_URI: z
    .string()
    .min(1)
    .default('http://localhost:5173/auth/google/callback'),

  /**
   * E-mail transacional.
   * 'auto' usa o Resend quando há RESEND_API_KEY, senão imprime no console.
   */
  MAIL_PROVIDER: z.enum(['auto', 'resend', 'console']).default('auto'),
  RESEND_API_KEY: optional,
  MAIL_FROM: z
    .string()
    .min(1)
    .default('english-saas <nao-responda@exemplo.com.br>'),

  /** Versão corrente dos documentos de consentimento (LGPD). */
  TERMS_VERSION: z.string().min(1).default('2026-01-01'),
  PRIVACY_POLICY_VERSION: z.string().min(1).default('2026-01-01'),
  /** Validade da URL assinada do export de dados. */
  DATA_EXPORT_TTL_HOURS: z.coerce.number().int().positive().default(48),

  /**
   * Validade da URL assinada de um asset de conteúdo (áudio, imagem, PDF).
   * Mais longa que a padrão do S3: o aluno abre a lição e fica nela.
   */
  CONTENT_URL_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),
  /** TTL do catálogo no Redis. 0 desliga o cache. */
  CATALOG_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(600),

  /**
   * Síntese de voz (módulo 5). Só existe o fake: o adapter do fornecedor
   * de verdade entra como mais um valor aqui, sem tocar em chamador.
   */
  TTS_PROVIDER: z.enum(['fake']).default('fake'),
  /** Voz usada quando o personagem não tem `voiceId` próprio. */
  TTS_DEFAULT_VOICE: z.string().min(1).default('en-us-neutral-01'),
  /** Fala mais pausada em nível baixo. 1 = velocidade natural. */
  TTS_SPEAKING_RATE_A1: z.coerce.number().min(0.5).max(2).default(0.9),
  /** Teto por requisição. Fala de cena não chega perto; é rede de segurança. */
  TTS_MAX_CHARS: z.coerce.number().int().positive().default(2_000),

  /**
   * Teto de palavras acima do nível num rascunho, em fração.
   * Acima disso a QA acusa. 0.05 = 5%.
   */
  CONTENT_QA_MAX_OUT_OF_LEVEL: z.coerce.number().min(0).max(1).default(0.05),

  /**
   * Quanto o recálculo da estatística de um item espera depois da primeira
   * resposta. As respostas que chegam nessa janela entram no mesmo job.
   */
  ITEM_STATS_DELAY_MS: z.coerce.number().int().min(0).default(30_000),

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
  /** Cota mensal do PLUS usada pelo seed de planos; depois vale a do banco. */
  AI_MONTHLY_CREDITS_PLUS: z.coerce.number().int().min(0).default(500),
  /**
   * Custo real de IA de um aluno no mês acima do qual o billing loga um
   * alerta interno. Em micros de dólar: 2_000_000 = US$ 2.
   */
  AI_USER_MONTHLY_COST_ALERT_USD_MICROS: z.coerce
    .number()
    .int()
    .min(0)
    .default(2_000_000),

  /**
   * Progresso (14): fuso do "dia" das métricas de plataforma (lição, custo,
   * plano). O dia do aluno continua sendo o do fuso dele.
   */
  METRICS_TIMEZONE: z.string().min(1).default('America/Sao_Paulo'),
  /**
   * Câmbio fixo para comparar custo de IA (US$) com receita (R$) no painel
   * do admin. Não buscamos cotação: o número aparece no próprio relatório.
   */
  USD_BRL_RATE: z.coerce.number().positive().default(5.5),

  /**
   * Web Push (15). 'auto' usa a biblioteca `web-push` quando as três chaves
   * VAPID existem e cai no fake em teste ou sem elas — sem chave, o push
   * fica indisponível e o e-mail segue normal. Gere o par com
   * `npx web-push generate-vapid-keys`.
   */
  PUSH_PROVIDER: z.enum(['auto', 'webpush', 'fake']).default('auto'),
  VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  /** Contato do remetente para o serviço de push: `mailto:` ou URL. */
  VAPID_SUBJECT: optional,

  /**
   * Voz no tutor (12): o áudio vai para o storage, é transcrito em job e
   * segue o caminho do texto. Desligado até existir um STT de verdade — só o
   * fake está implementado.
   */
  TUTOR_VOICE_ENABLED: booleanFromString.default(false),
  SPEECH_TO_TEXT_PROVIDER: z.enum(['fake']).default('fake'),
  /** Teto do arquivo de áudio enviado ao tutor. 5 MB ≈ 5 min de MP3. */
  TUTOR_AUDIO_MAX_BYTES: z.coerce.number().int().positive().default(5_000_000),

  /**
   * 'auto' escolhe sozinho: fake em NODE_ENV=test ou sem ASAAS_API_KEY,
   * Asaas no resto. Em produção, defina 'asaas' — a falta da chave vira
   * erro visível em vez de um fake silencioso.
   */
  PAYMENT_PROVIDER: z.enum(['auto', 'asaas', 'fake']).default('auto'),
  ASAAS_API_KEY: optional,
  ASAAS_BASE_URL: z.url().default('https://sandbox.asaas.com/api/v3'),
  ASAAS_WEBHOOK_TOKEN: optional,

  /**
   * Fontes do generator (13). 'auto' = fake em NODE_ENV=test, real no resto
   * — o e2e nunca sai para a internet.
   */
  SOURCE_PROVIDER: z.enum(['auto', 'wikipedia', 'fake']).default('auto'),
  ARTICLE_FETCH_PROVIDER: z.enum(['auto', 'http', 'fake']).default('auto'),
  /** A Wikimedia exige um User-Agent identificável, com contato. */
  WIKIPEDIA_USER_AGENT: z.string().min(1).default('english-saas/0.1'),
  /** Wikipedia em inglês: o material é de inglês. */
  WIKIPEDIA_API_URL: z.url().default('https://en.wikipedia.org/w/api.php'),
  WIKIPEDIA_REST_URL: z.url().default('https://en.wikipedia.org/api/rest_v1'),
  CONTENT_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  CONTENT_MAX_CHARS: z.coerce.number().int().positive().default(40_000),
  /** Teto do HTML baixado de uma URL de artigo, antes de extrair o texto. */
  ARTICLE_MAX_BYTES: z.coerce.number().int().positive().default(2_000_000),

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
