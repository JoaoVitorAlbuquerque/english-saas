import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DictationItem } from './index';
import type { DictationItemView } from '../types';

const item: DictationItemView = {
  id: 'a1-dictation-im-from-brazil',
  type: 'DICTATION',
  prompt: 'Ouça e escreva exatamente o que você ouviu.',
  content: { audioUrl: 'https://example.com/im-from-brazil.mp3', maxPlays: 2 },
};

describe('DictationItem', () => {
  it('limita o play a maxPlays e desabilita Ouvir depois disso', async () => {
    render(<DictationItem item={item} mode="practice" />);

    const playButton = screen.getByRole('button', { name: 'Ouvir' });
    await userEvent.click(playButton);
    expect(screen.getByText('1 de 2 restantes')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Ouvir de novo' }),
    );
    expect(screen.getByText('0 de 2 restantes')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ouvir de novo' }),
    ).toBeDisabled();
  });

  it('envia {text}, com autocorreção desligada', async () => {
    const onAnswer = vi.fn();
    render(<DictationItem item={item} mode="practice" onAnswer={onAnswer} />);

    const input = screen.getByLabelText('Escreva o que você ouviu');
    expect(input).toHaveAttribute('autocorrect', 'off');

    await userEvent.type(input, "I'm from Brazil.{Enter}");

    expect(onAnswer).toHaveBeenCalledWith({
      response: { text: "I'm from Brazil." },
      responseTimeMs: expect.any(Number),
      hintsUsed: 0,
    });
  });
});
