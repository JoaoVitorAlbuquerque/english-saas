import { useCredits } from '@english-saas/api-client';

/** Só o plano importa aqui: Plus abre as ferramentas, o resto vê a apresentação. */
export function usePlusToolsCard() {
  const credits = useCredits();

  return {
    isReady: credits.data !== undefined,
    isPlus: credits.data?.tier === 'PLUS',
  };
}
