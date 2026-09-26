let baseUrl =
  typeof import.meta.env !== 'undefined'
    ? (import.meta.env.VITE_API_URL ?? '')
    : '';

/** Chame uma vez na inicialização do app se precisar mudar a URL da API. */
export function configureApiClient(input: { baseUrl: string }): void {
  baseUrl = input.baseUrl;
}

export function getApiBaseUrl(): string {
  return baseUrl;
}
