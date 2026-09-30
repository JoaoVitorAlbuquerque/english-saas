import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OrderWordsItem } from './index';
import type { OrderWordsItemView } from '../types';

const item: OrderWordsItemView = {
  id: 'a1-order-im-from-brazil',
  type: 'ORDER_WORDS',
  prompt: 'Monte a frase: diga de onde você é.',
  content: { tokens: ['from', "I'm", 'Brazil'] },
};

describe('OrderWordsItem', () => {
  it('move token do banco pra frase montada e de volta ao tocar', async () => {
    render(<OrderWordsItem item={item} mode="practice" />);

    await userEvent.click(screen.getByRole('button', { name: "I'm" }));

    const assembled = screen.getByLabelText('Frase montada');
    expect(assembled).toHaveTextContent("I'm");

    await userEvent.click(screen.getByRole('button', { name: "I'm" }));
    expect(assembled).not.toHaveTextContent("I'm");
  });

  it('envia {tokens} na ordem montada, só quando todos os tokens foram usados', async () => {
    const onAnswer = vi.fn();
    render(<OrderWordsItem item={item} mode="practice" onAnswer={onAnswer} />);

    await userEvent.click(screen.getByRole('button', { name: "I'm" }));
    await userEvent.keyboard('{Enter}');
    expect(onAnswer).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'from' }));
    await userEvent.click(screen.getByRole('button', { name: 'Brazil' }));
    await userEvent.keyboard('{Enter}');

    expect(onAnswer).toHaveBeenCalledWith({
      response: { tokens: ["I'm", 'from', 'Brazil'] },
      responseTimeMs: expect.any(Number),
      hintsUsed: 0,
    });
  });

  it('Enviar só habilita com todas as palavras na frase', async () => {
    const onAnswer = vi.fn();
    render(<OrderWordsItem item={item} mode="practice" onAnswer={onAnswer} />);

    const send = screen.getByRole('button', { name: 'Enviar' });
    await userEvent.click(screen.getByRole('button', { name: "I'm" }));
    expect(send).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'from' }));
    await userEvent.click(screen.getByRole('button', { name: 'Brazil' }));
    expect(send).toBeEnabled();
    await userEvent.click(send);

    expect(onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        response: { tokens: ["I'm", 'from', 'Brazil'] },
      }),
    );
  });
});
