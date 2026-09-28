import { useRef } from 'react';

/**
 * Tempo de resposta do item: do primeiro render até o envio.
 * Um `ref` por instância — trocar de item (key diferente) reinicia a conta.
 */
export function useAnswerTimer(): () => number {
  const startedAt = useRef(Date.now());

  return () => Date.now() - startedAt.current;
}
