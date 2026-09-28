import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TypeAnswerItem } from './index';
import type { TypeAnswerItemView } from '../types';

const item: TypeAnswerItemView = {
  id: 'a1-type-shes-from-austin',
  type: 'TYPE_ANSWER',
  prompt: 'Escreva em inglês: "Ela é de Austin."',
  content: { sourceText: 'Ela é de Austin.', hint: 'Use a forma curta.' },
};

describe('TypeAnswerItem', () => {
  it('envia {text} com o que foi digitado, ao apertar Enter', async () => {
    const onAnswer = vi.fn();
    render(<TypeAnswerItem item={item} mode="practice" onAnswer={onAnswer} />);

    await userEvent.type(
      screen.getByLabelText('Sua resposta'),
      "She's from Austin{Enter}",
    );

    expect(onAnswer).toHaveBeenCalledWith({
      response: { text: "She's from Austin" },
      responseTimeMs: expect.any(Number),
      hintsUsed: 0,
    });
  });

  it('não envia resposta vazia', async () => {
    const onAnswer = vi.fn();
    render(<TypeAnswerItem item={item} mode="practice" onAnswer={onAnswer} />);

    await userEvent.type(screen.getByLabelText('Sua resposta'), '{Enter}');

    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('em assessment, não mostra o botão de dica — prova não tem dica', () => {
    render(<TypeAnswerItem item={item} mode="assessment" />);

    expect(
      screen.queryByRole('button', { name: 'Dica' }),
    ).not.toBeInTheDocument();
  });
});
