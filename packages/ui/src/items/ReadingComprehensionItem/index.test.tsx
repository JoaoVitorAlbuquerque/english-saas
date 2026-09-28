import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReadingComprehensionItem } from './index';
import type { ReadingComprehensionItemView } from '../types';

const item: ReadingComprehensionItemView = {
  id: 'a1-reading-lucas-austin',
  type: 'READING_COMPREHENSION',
  prompt: 'Where is Lucas from?',
  content: {
    passage:
      "Lucas is 24. He's from Campinas, near São Paulo. He lives in Austin now.",
    spans: [],
    shuffle: false,
    options: [
      { id: 'campinas', text: 'Campinas' },
      { id: 'austin', text: 'Austin' },
    ],
  },
};

describe('ReadingComprehensionItem', () => {
  it('mostra o texto e envia {optionIds} com a resposta escolhida', async () => {
    const onAnswer = vi.fn();
    render(
      <ReadingComprehensionItem
        item={item}
        mode="practice"
        onAnswer={onAnswer}
      />,
    );

    expect(screen.getByText(/Lucas is 24\./)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: '1. Campinas' }));
    await userEvent.keyboard('{Enter}');

    expect(onAnswer).toHaveBeenCalledWith({
      response: { optionIds: ['campinas'] },
      responseTimeMs: expect.any(Number),
      hintsUsed: 0,
    });
  });
});
