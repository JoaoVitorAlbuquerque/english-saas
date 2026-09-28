import type { ItemView } from '@english-saas/ui';
import { describe, expect, it } from 'vitest';

import { buildDontKnowResponse } from './dont-know-response';

describe('buildDontKnowResponse', () => {
  it('escolha: manda todas as alternativas (nunca bate com um gabarito parcial)', () => {
    const item: ItemView = {
      id: 'i1',
      type: 'MULTIPLE_CHOICE',
      prompt: 'p',
      content: {
        shuffle: false,
        options: [
          { id: 'a', text: 'a' },
          { id: 'b', text: 'b' },
          { id: 'c', text: 'c' },
        ],
      },
    };

    expect(buildDontKnowResponse(item)).toEqual({ optionIds: ['a', 'b', 'c'] });
  });

  it('LISTEN_CHOOSE também manda todas as alternativas', () => {
    const item: ItemView = {
      id: 'i2',
      type: 'LISTEN_CHOOSE',
      prompt: 'p',
      content: {
        shuffle: false,
        audioUrl: 'https://example.com/a.mp3',
        options: [
          { id: 'a', text: 'a' },
          { id: 'b', text: 'b' },
        ],
      },
    };

    expect(buildDontKnowResponse(item)).toEqual({ optionIds: ['a', 'b'] });
  });

  it('READING_COMPREHENSION também manda todas as alternativas', () => {
    const item: ItemView = {
      id: 'i3',
      type: 'READING_COMPREHENSION',
      prompt: 'p',
      content: {
        passage: 'texto',
        spans: [],
        shuffle: false,
        options: [
          { id: 'a', text: 'a' },
          { id: 'b', text: 'b' },
        ],
      },
    };

    expect(buildDontKnowResponse(item)).toEqual({ optionIds: ['a', 'b'] });
  });

  it.each(['FILL_BLANK', 'TYPE_ANSWER', 'DICTATION', 'REGISTER_SWAP'] as const)(
    '%s: manda texto vazio (sempre errado, nunca bate com uma resposta aceita)',
    (type) => {
      const base = { id: 'i4', prompt: 'p' };
      const item: ItemView =
        type === 'FILL_BLANK'
          ? { ...base, type, content: { sentence: 'a ___ b' } }
          : type === 'TYPE_ANSWER'
            ? { ...base, type, content: {} }
            : type === 'DICTATION'
              ? {
                  ...base,
                  type,
                  content: {
                    audioUrl: 'https://example.com/a.mp3',
                    maxPlays: 0,
                  },
                }
              : {
                  ...base,
                  type,
                  content: {
                    source: 'You coming?',
                    direction: 'SPOKEN_TO_STANDARD',
                  },
                };

      expect(buildDontKnowResponse(item)).toEqual({ text: '' });
    },
  );

  it('ORDER_WORDS: manda os tokens na ordem dada, sem reorganizar', () => {
    const item: ItemView = {
      id: 'i5',
      type: 'ORDER_WORDS',
      prompt: 'p',
      content: { tokens: ['from', "I'm", 'Brazil'] },
    };

    expect(buildDontKnowResponse(item)).toEqual({
      tokens: ['from', "I'm", 'Brazil'],
    });
  });

  it('MATCH: liga pela posição', () => {
    const item: ItemView = {
      id: 'i6',
      type: 'MATCH',
      prompt: 'p',
      content: { lefts: ['I', 'he', 'they'], rights: ['am', 'is', 'are'] },
    };

    expect(buildDontKnowResponse(item)).toEqual({
      pairs: [
        { left: 'I', right: 'am' },
        { left: 'he', right: 'is' },
        { left: 'they', right: 'are' },
      ],
    });
  });
});
