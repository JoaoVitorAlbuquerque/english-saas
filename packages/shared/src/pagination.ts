import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Toda listagem da API pagina por cursor — nunca por offset.
 * O cursor é opaco para o cliente: ele só devolve o `nextCursor` recebido.
 */
export const cursorPaginationQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>;

/** Envelope das respostas paginadas. */
export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });
}

export type Paginated<T> = {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
};
