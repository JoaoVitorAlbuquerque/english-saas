import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MatchItem } from './index';
import type { MatchItemView } from '../types';

const item: MatchItemView = {
  id: 'a1-match-pronoun-be',
  type: 'MATCH',
  prompt: 'Ligue cada pronome à forma certa do verbo to be.',
  content: { lefts: ['I', 'he', 'they'], rights: ['am', 'are', 'is'] },
};

describe('MatchItem', () => {
  it('liga um par ao clicar esquerda depois direita', async () => {
    render(<MatchItem item={item} mode="practice" />);

    await userEvent.click(screen.getByRole('button', { name: 'I' }));
    await userEvent.click(screen.getByRole('button', { name: 'am' }));

    expect(screen.getByRole('button', { name: 'I' })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: 'am' })).toHaveTextContent('1');
  });

  it('só confirma quando todos os pares estão ligados, enviando {pairs}', async () => {
    const onAnswer = vi.fn();
    render(<MatchItem item={item} mode="practice" onAnswer={onAnswer} />);

    await userEvent.click(screen.getByRole('button', { name: 'I' }));
    await userEvent.click(screen.getByRole('button', { name: 'am' }));
    await userEvent.keyboard('{Enter}');
    expect(onAnswer).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'he' }));
    await userEvent.click(screen.getByRole('button', { name: 'is' }));
    await userEvent.click(screen.getByRole('button', { name: 'they' }));
    await userEvent.click(screen.getByRole('button', { name: 'are' }));
    await userEvent.keyboard('{Enter}');

    expect(onAnswer).toHaveBeenCalledWith({
      response: {
        pairs: [
          { left: 'I', right: 'am' },
          { left: 'he', right: 'is' },
          { left: 'they', right: 'are' },
        ],
      },
      responseTimeMs: expect.any(Number),
      hintsUsed: 0,
    });
  });

  it('Enviar só habilita com todos os pares ligados', async () => {
    const onAnswer = vi.fn();
    render(<MatchItem item={item} mode="practice" onAnswer={onAnswer} />);

    const send = screen.getByRole('button', { name: 'Enviar' });
    await userEvent.click(screen.getByRole('button', { name: 'I' }));
    await userEvent.click(screen.getByRole('button', { name: 'am' }));
    expect(send).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'he' }));
    await userEvent.click(screen.getByRole('button', { name: 'is' }));
    await userEvent.click(screen.getByRole('button', { name: 'they' }));
    await userEvent.click(screen.getByRole('button', { name: 'are' }));
    await userEvent.click(send);

    expect(onAnswer).toHaveBeenCalledTimes(1);
  });
});
