import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ListenChooseItem } from './index';
import type { ListenChooseItemView } from '../types';

const item: ListenChooseItemView = {
  id: 'a1-listen-hes-friendly',
  type: 'LISTEN_CHOOSE',
  prompt: 'Ouça e escolha o que a Maya disse.',
  content: {
    shuffle: false,
    audioUrl: 'https://example.com/hes-friendly.mp3',
    options: [
      { id: 'contracted', text: "He's very friendly." },
      { id: 'full', text: 'He is very friendly.' },
      { id: 'plural', text: 'They are very friendly.' },
    ],
  },
};

describe('ListenChooseItem', () => {
  it('toca o áudio só ao clicar em Ouvir, e depois oferece "ouvir de novo"', async () => {
    render(<ListenChooseItem item={item} mode="practice" />);

    expect(screen.getByRole('button', { name: 'Ouvir' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ouvir' }));

    expect(
      screen.getByRole('button', { name: 'Ouvir de novo' }),
    ).toBeInTheDocument();
  });

  it('envia {optionIds} com a alternativa escolhida', async () => {
    const onAnswer = vi.fn();
    render(
      <ListenChooseItem item={item} mode="practice" onAnswer={onAnswer} />,
    );

    await userEvent.click(
      screen.getByRole('radio', { name: "1. He's very friendly." }),
    );
    await userEvent.keyboard('{Enter}');

    expect(onAnswer).toHaveBeenCalledWith({
      response: { optionIds: ['contracted'] },
      responseTimeMs: expect.any(Number),
      hintsUsed: 0,
    });
  });
});
