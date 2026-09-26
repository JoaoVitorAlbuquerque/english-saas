import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '../http/api-error';

/** Defaults compartilhados pelos dois apps — nunca retenta erro de negócio. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (
            error instanceof ApiError &&
            error.status < 500 &&
            error.status !== 0
          ) {
            return false;
          }

          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
