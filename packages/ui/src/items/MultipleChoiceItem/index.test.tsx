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
  it('clicar na alternativa já responde, sem confirmar', async () => {
    const onAnswer = vi.fn();
    render(
      <MultipleChoiceItem item={item} mode="practice" onAnswer={onAnswer} />,
    );

    await userEvent.click(screen.getByRole('radio', { name: '1. am' }));

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({
      response: { optionIds: ['am'] },
      responseTimeMs: expect.any(Number),
      hintsUsed: 0,
    });
  });

  it('dígito 2 responde com a segunda alternativa', async () => {
    const onAnswer = vi.fn();
    render(
      <MultipleChoiceItem item={item} mode="practice" onAnswer={onAnswer} />,
    );

    // Tab só foca (dentro do radiogroup) — quem responde é o dígito.
    await userEvent.tab();
    expect(onAnswer).not.toHaveBeenCalled();

    await userEvent.keyboard('2');

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ response: { optionIds: ['is'] } }),
    );
  });

  it('desabilitada (resposta a caminho), não responde de novo', async () => {
    const onAnswer = vi.fn();
    render(
      <MultipleChoiceItem
        item={item}
        mode="practice"
        onAnswer={onAnswer}
        disabled
      />,
    );

    await userEvent.click(screen.getByRole('radio', { name: '2. is' }));

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
