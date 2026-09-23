import type { DependencyStatus } from '@english-saas/shared';

/**
 * Função pura, no padrão de tudo que vive em `domain/`: sem Nest, sem I/O,
 * testável direto. A API só está ok se toda dependência crítica está de pé.
 */
export function summarizeHealth(
  dependencies: Record<string, DependencyStatus>,
): 'ok' | 'error' {
  const allUp = Object.values(dependencies).every(
    (dependency) => dependency.status === 'up',
  );

  return allUp ? 'ok' : 'error';
}
