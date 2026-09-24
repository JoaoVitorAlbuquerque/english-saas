import { z } from 'zod';

/**
 * Formato único de erro da API, produzido pelo filtro global.
 *
 * - `code`: identificador estável em inglês, usado pelo cliente para decidir.
 * - `message`: texto em pt-BR, pronto para exibir ao aluno.
 * - `details`: contexto opcional (ex.: issues do zod). Nunca carrega detalhe
 *   interno de erro 500 — isso fica só no log.
 *
 * A correlação com os logs vai no header `x-request-id` da resposta, não no
 * corpo.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

/** Códigos de erro que o filtro global produz sem ajuda de ninguém. */
export const API_ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCode =
  (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
