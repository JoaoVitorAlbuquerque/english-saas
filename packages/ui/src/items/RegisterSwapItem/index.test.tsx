import type { RegisterNote } from '@english-saas/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RegisterSwapItem } from './index';
import type { RegisterSwapItemView } from '../types';

const item: RegisterSwapItemView = {
  id: 'a1-register-you-coming',
  type: 'REGISTER_SWAP',
  prompt: 'Reescreva na estrutura gramatical completa.',
  content: { source: 'You coming?', direction: 'SPOKEN_TO_STANDARD' },
};

const registerNote: RegisterNote = {
  id: 'you-coming',
  spokenForm: 'You coming?',
  standardForm: 'Are you coming?',
  register: 'INFORMAL_SPOKEN',
  explanation: 'Na fala o "are" some. Na forma completa ele volta.',
  whenToAvoid: null,
  cefrLevel: 'A1',
  skillId: null,
  deprecatedAt: null,
  replacedById: null,
};

describe('RegisterSwapItem', () => {
  it('envia {text} com a reescrita', async () => {
    const onAnswer = vi.fn();
    render(
      <RegisterSwapItem item={item} mode="practice" onAnswer={onAnswer} />,
    );

    expect(screen.getByText(/You coming\?/)).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText('Sua resposta'),
      'Are you coming?{Enter}',
    );

    expect(onAnswer).toHaveBeenCalledWith({
      response: { text: 'Are you coming?' },
      responseTimeMs: expect.any(Number),
      hintsUsed: 0,
    });
  });

  it('mostra a nota de registro no feedback', () => {
    render(
      <RegisterSwapItem
        item={item}
        mode="practice"
        registerNote={registerNote}
        feedback={{
          isCorrect: true,
          score: 1,
          verdict: 'CORRECT',
          feedback: 'Isso mesmo.',
          explanation: registerNote.explanation,
          correctAnswer: { text: 'Are you coming?' },
        }}
      />,
    );

    expect(screen.getByText('Como se fala')).toBeInTheDocument();
    expect(screen.getByText('You coming?')).toBeInTheDocument();
  });
});
