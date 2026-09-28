import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ItemRenderer } from './ItemRenderer';
import type { ItemFeedback, ItemView } from './types';

const ITEMS: ItemView[] = [
  {
    id: 'i1',
    type: 'MULTIPLE_CHOICE',
    prompt: 'p1',
    content: { shuffle: false, options: [{ id: 'a', text: 'a' }] },
  },
  {
    id: 'i2',
    type: 'LISTEN_CHOOSE',
    prompt: 'p2',
    content: {
      shuffle: false,
      audioUrl: 'https://example.com/a.mp3',
      options: [{ id: 'a', text: 'a' }],
    },
  },
  {
    id: 'i3',
    type: 'ORDER_WORDS',
    prompt: 'p3',
    content: { tokens: ['a', 'b'] },
  },
  {
    id: 'i4',
    type: 'FILL_BLANK',
    prompt: 'p4',
    content: { sentence: 'a ___ b' },
  },
  { id: 'i5', type: 'TYPE_ANSWER', prompt: 'p5', content: {} },
  {
    id: 'i6',
    type: 'MATCH',
    prompt: 'p6',
    content: { lefts: ['a'], rights: ['b'] },
  },
  {
    id: 'i7',
    type: 'DICTATION',
    prompt: 'p7',
    content: { audioUrl: 'https://example.com/a.mp3', maxPlays: 0 },
  },
  {
    id: 'i8',
    type: 'READING_COMPREHENSION',
    prompt: 'p8',
    content: {
      passage: 'texto do trecho',
      spans: [],
      shuffle: false,
      options: [{ id: 'a', text: 'a' }],
    },
  },
  {
    id: 'i9',
    type: 'REGISTER_SWAP',
    prompt: 'p9',
    content: { source: 'source', direction: 'SPOKEN_TO_STANDARD' },
  },
];

describe('ItemRenderer', () => {
  it.each(ITEMS)(
    'despacha $type para o componente certo (mostra o prompt)',
    (item) => {
      render(<ItemRenderer item={item} mode="practice" />);

      expect(screen.getByText(item.prompt)).toBeInTheDocument();
    },
  );

  it('em assessment, nunca mostra o painel de feedback mesmo se `feedback` vier preenchido', () => {
    const feedback: ItemFeedback = {
      isCorrect: true,
      score: 1,
      verdict: 'CORRECT',
      feedback: 'Isso mesmo.',
      explanation: 'explicação',
      correctAnswer: { text: 'a' },
    };

    render(
      <ItemRenderer
        item={ITEMS[4] as ItemView}
        mode="assessment"
        feedback={feedback}
      />,
    );

    expect(screen.queryByText('Isso mesmo.')).not.toBeInTheDocument();
  });

  it('em practice, mostra o painel de feedback quando `feedback` vem preenchido', () => {
    const feedback: ItemFeedback = {
      isCorrect: true,
      score: 1,
      verdict: 'CORRECT',
      feedback: 'Isso mesmo.',
      explanation: 'explicação',
      correctAnswer: { text: 'a' },
    };

    render(
      <ItemRenderer
        item={ITEMS[4] as ItemView}
        mode="practice"
        feedback={feedback}
      />,
    );

    expect(screen.getByText('Isso mesmo.')).toBeInTheDocument();
  });
});
