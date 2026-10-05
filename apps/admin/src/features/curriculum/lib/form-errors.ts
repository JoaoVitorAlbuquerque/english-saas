import { issueMessage } from '@english-saas/shared';
import type { z } from 'zod';

/**
 * Confere um formulário com o schema do `packages/shared` e devolve a
 * primeira mensagem de cada campo, já em pt-BR (o zod escreve em inglês).
 */
export function fieldErrors<T extends z.ZodType>(
  schema: T,
  values: unknown,
): Record<string, string> {
  const result = schema.safeParse(values);
  const errors: Record<string, string> = {};

  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? '');

      if (field !== '' && errors[field] === undefined) {
        errors[field] = issueMessage(issue);
      }
    }
  }

  return errors;
}
