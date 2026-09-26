import { apiErrorSchema, type ApiErrorCode } from '@english-saas/shared';

/** Erro lançado por toda chamada do api-client — sempre com `code` + `message` pt-BR. */
export class ApiError extends Error {
  readonly code: ApiErrorCode | (string & {});
  readonly status: number;
  readonly details?: unknown;

  constructor(input: {
    code: string;
    message: string;
    status: number;
    details?: unknown;
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
  }
}

/** Erro genérico pt-BR usado quando a resposta nem chega a ser JSON válido. */
export function networkApiError(): ApiError {
  return new ApiError({
    code: 'NETWORK_ERROR',
    message: 'Não conseguimos falar com o servidor. Verifique sua conexão.',
    status: 0,
  });
}

export async function parseErrorResponse(
  response: Response,
): Promise<ApiError> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    return new ApiError({
      code: 'UNKNOWN_ERROR',
      message: 'Algo deu errado. Tente de novo em instantes.',
      status: response.status,
    });
  }

  const parsed = apiErrorSchema.safeParse(body);

  if (!parsed.success) {
    return new ApiError({
      code: 'UNKNOWN_ERROR',
      message: 'Algo deu errado. Tente de novo em instantes.',
      status: response.status,
    });
  }

  return new ApiError({
    code: parsed.data.error.code,
    message: parsed.data.error.message,
    status: response.status,
    details: parsed.data.error.details,
  });
}
