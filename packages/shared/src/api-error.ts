import { z } from 'zod';

/**
 * Formato único de erro da API, produzido pelo filtro global.
 *
 * - `code`: identificador estável em inglês, usado pelo cliente para decidir.
 * - `message`: texto em pt-BR, pronto para exibir ao aluno.
 * - `requestId`: mesmo id que aparece nos logs estruturados.
 */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string(),
  path: z.string(),
  timestamp: z.string(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
