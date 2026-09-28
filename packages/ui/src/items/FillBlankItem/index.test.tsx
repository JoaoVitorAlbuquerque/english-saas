import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FillBlankItem } from './index';
import type { FillBlankItemView } from '../types';

const freeTextItem: FillBlankItemView = {
  id: 'a1-fill-biscuit-is-a-dog',
  type: 'FILL_BLANK',
  prompt: 'Complete com o verbo to be.',
  content: {
    sentence: 'Biscuit ___ a dog.',
    hint: 'Biscuit é uma única criatura.',
    choices: ['is', 'am', 'are'],
  },
};

describe('FillBlankItem', () => {
  it('com choices, envia {text} com a alternativa clicada', async () => {
    const onAnswer = vi.fn();
    render(
      <FillBlankItem item={freeTextItem} mode="practice" onAnswer={onAnswer} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'is' }));
    await userEvent.keyboard('{Enter}');

    expect(onAnswer).toHaveBeenCalledWith({
      response: { text: 'is' },
      responseTimeMs: expect.any(Number),
      hintsUsed: 0,
    });
  });

  it('sem choices, digita livre e envia {text}, com autocorreção desligada', async () => {
    const onAnswer = vi.fn();
    const freeItem: FillBlankItemView = {
      ...freeTextItem,
      content: { sentence: '___ you new here?' },
    };
    render(
      <FillBlankItem item={freeItem} mode="practice" onAnswer={onAnswer} />,
    );

    const input = screen.getByLabelText('Sua resposta');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('autocapitalize', 'off');

    await userEvent.type(input, 'Are{Enter}');

    expect(onAnswer).toHaveBeenCalledWith({
      response: { text: 'Are' },
      responseTimeMs: expect.any(Number),
      hintsUsed: 0,
    });
  });

  it('dica: revela o texto e conta 1 hint só na primeira vez', async () => {
    const onAnswer = vi.fn();
    render(
      <FillBlankItem item={freeTextItem} mode="practice" onAnswer={onAnswer} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Dica' }));
    expect(
      screen.getByText('Biscuit é uma única criatura.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'is' }));
    await userEvent.keyboard('{Enter}');

    expect(onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ hintsUsed: 1 }),
    );
  });

  it('em assessment, não mostra o botão de dica — prova não tem dica', () => {
    render(<FillBlankItem item={freeTextItem} mode="assessment" />);

    expect(
      screen.queryByRole('button', { name: 'Dica' }),
    ).not.toBeInTheDocument();
  });
});
