import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MultipleChoiceItem } from './index';
import type { MultipleChoiceItemView } from '../types';

const item: MultipleChoiceItemView = {
  id: 'a1-be-i-am-maya',
  type: 'MULTIPLE_CHOICE',
  prompt: 'Complete: I ___ Maya.',
  content: {
    shuffle: false,
    options: [
      { id: 'am', text: 'am' },
      { id: 'is', text: 'is' },
      { id: 'are', text: 'are' },
    ],
  },
};

describe('MultipleChoiceItem', () => {
  it('envia {optionIds} com a opção escolhida ao confirmar', async () => {
    const onAnswer = vi.fn();
    render(
      <MultipleChoiceItem item={item} mode="practice" onAnswer={onAnswer} />,
    );

    await userEvent.click(screen.getByRole('radio', { name: '1. am' }));
    await userEvent.keyboard('{Enter}');

    expect(onAnswer).toHaveBeenCalledWith({
      response: { optionIds: ['am'] },
      responseTimeMs: expect.any(Number),
      hintsUsed: 0,
    });
  });

  it('dígito 2 escolhe a segunda alternativa, e Enter confirma', async () => {
    const onAnswer = vi.fn();
    render(
      <MultipleChoiceItem item={item} mode="practice" onAnswer={onAnswer} />,
    );

    // Foca dentro do radiogroup (clicar numa alternativa) antes de digitar —
    // o teclado dispara no elemento focado, e o dígito troca a seleção.
    await userEvent.click(screen.getByRole('radio', { name: '1. am' }));
    await userEvent.keyboard('2{Enter}');

    expect(onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ response: { optionIds: ['is'] } }),
    );
  });

  it('não confirma sem alternativa escolhida', async () => {
    const onAnswer = vi.fn();
    render(
      <MultipleChoiceItem item={item} mode="practice" onAnswer={onAnswer} />,
    );

    // Tab só foca, não seleciona (seleção é no clique) — Enter aqui não
    // deve confirmar nada.
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');

    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('em preview, mostra o feedback e trava a interação', () => {
    render(
      <MultipleChoiceItem
        item={item}
        mode="preview"
        feedback={{
          isCorrect: true,
          score: 1,
          verdict: 'CORRECT',
          feedback: 'Isso mesmo.',
          explanation: 'Com "I", o verbo to be é sempre "am".',
          correctAnswer: { optionIds: ['am'], texts: ['am'] },
        }}
      />,
    );

    expect(screen.getByRole('radio', { name: '1. am' })).toBeDisabled();
    expect(screen.getByText('Isso mesmo.')).toBeInTheDocument();
  });
});
