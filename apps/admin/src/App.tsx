import { createQueryClient } from '@english-saas/api-client';
import { Toaster } from '@english-saas/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { AuthProvider } from './app/providers/AuthProvider';
import { AppRouter } from './app/router';
import { RouteErrorBoundary } from './app/RouteErrorBoundary';

export function App() {
  const [queryClient] = useState(createQueryClient);

  return (
    <RouteErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
        <Toaster />
      </QueryClientProvider>
    </RouteErrorBoundary>
  );
}
