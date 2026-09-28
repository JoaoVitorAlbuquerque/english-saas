import { useState } from 'react';

/**
 * Dica revelada sob pedido. `hintsUsed` soma 1 na primeira revelação, não a
 * cada clique — reabrir uma dica já vista não é uma nova dica.
 */
export function useHint(): {
  revealed: boolean;
  hintsUsed: number;
  reveal: () => void;
} {
  const [revealed, setRevealed] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);

  function reveal() {
    if (revealed) {
      return;
    }

    setRevealed(true);
    setHintsUsed(1);
  }

  return { revealed, hintsUsed, reveal };
}
