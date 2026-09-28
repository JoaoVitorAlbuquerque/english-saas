import { describe, expect, it } from 'vitest';

import { toItemView } from './to-item-view';

const assets = {
  'asset-1': { url: 'https://cdn.example.com/asset-1.mp3' },
};

describe('toItemView', () => {
  it('MULTIPLE_CHOICE: mapeia as opções e o shuffle', () => {
    const view = toItemView(
      {
        id: 'i1',
        type: 'MULTIPLE_CHOICE',
        prompt: 'p',
        content: {
          options: [
            { id: 'a', text: 'A', translation: 'a' },
            { id: 'b', text: 'B' },
          ],
          shuffle: true,
        },
      },
      assets,
    );

    expect(view).toEqual({
      id: 'i1',
      type: 'MULTIPLE_CHOICE',
      prompt: 'p',
      content: {
        options: [
          { id: 'a', text: 'A', translation: 'a' },
          { id: 'b', text: 'B', translation: undefined },
        ],
        shuffle: true,
      },
    });
  });

  it('LISTEN_CHOOSE: resolve audioAssetId pela URL do mapa de assets', () => {
    const view = toItemView(
      {
        id: 'i2',
        type: 'LISTEN_CHOOSE',
        prompt: 'p',
        content: {
          options: [{ id: 'a', text: 'A' }],
          shuffle: false,
          audioAssetId: 'asset-1',
        },
      },
      assets,
    );

    expect(view.type).toBe('LISTEN_CHOOSE');
    expect(view.content).toMatchObject({
      audioUrl: 'https://cdn.example.com/asset-1.mp3',
    });
  });

  it('LISTEN_CHOOSE: asset desconhecido vira URL vazia, sem quebrar', () => {
    const view = toItemView(
      {
        id: 'i2b',
        type: 'LISTEN_CHOOSE',
        prompt: 'p',
        content: { options: [], shuffle: false, audioAssetId: 'missing' },
      },
      assets,
    );

    expect(view.content).toMatchObject({ audioUrl: '' });
  });

  it('ORDER_WORDS: mapeia os tokens', () => {
    const view = toItemView(
      {
        id: 'i3',
        type: 'ORDER_WORDS',
        prompt: 'p',
        content: { tokens: ["I'm", 'Lucas'] },
      },
      assets,
    );

    expect(view.content).toEqual({ tokens: ["I'm", 'Lucas'] });
  });

  it('FILL_BLANK: dica e alternativas são opcionais', () => {
    const withExtras = toItemView(
      {
        id: 'i4',
        type: 'FILL_BLANK',
        prompt: 'p',
        content: {
          sentence: 'Biscuit ___ a dog.',
          hint: 'to be',
          choices: ['is', 'are'],
        },
      },
      assets,
    );
    const bare = toItemView(
      {
        id: 'i4b',
        type: 'FILL_BLANK',
        prompt: 'p',
        content: { sentence: 'a ___ b' },
      },
      assets,
    );

    expect(withExtras.content).toEqual({
      sentence: 'Biscuit ___ a dog.',
      hint: 'to be',
      choices: ['is', 'are'],
    });
    expect(bare.content).toEqual({
      sentence: 'a ___ b',
      hint: undefined,
      choices: undefined,
    });
  });

  it('TYPE_ANSWER: sourceText e dica são opcionais', () => {
    const view = toItemView(
      { id: 'i5', type: 'TYPE_ANSWER', prompt: 'p', content: {} },
      assets,
    );

    expect(view.content).toEqual({ sourceText: undefined, hint: undefined });
  });

  it('MATCH: mapeia lefts e rights', () => {
    const view = toItemView(
      {
        id: 'i6',
        type: 'MATCH',
        prompt: 'p',
        content: { lefts: ['I', 'he'], rights: ['am', 'is'] },
      },
      assets,
    );

    expect(view.content).toEqual({ lefts: ['I', 'he'], rights: ['am', 'is'] });
  });

  it('DICTATION: resolve o áudio e o maxPlays', () => {
    const view = toItemView(
      {
        id: 'i7',
        type: 'DICTATION',
        prompt: 'p',
        content: { audioAssetId: 'asset-1', maxPlays: 3 },
      },
      assets,
    );

    expect(view.content).toEqual({
      audioUrl: 'https://cdn.example.com/asset-1.mp3',
      maxPlays: 3,
    });
  });

  it('READING_COMPREHENSION: mapeia passage, spans e opções; spans inválidos viram []', () => {
    const view = toItemView(
      {
        id: 'i8',
        type: 'READING_COMPREHENSION',
        prompt: 'p',
        content: {
          passage: 'texto',
          spans: 'não é array',
          options: [{ id: 'a', text: 'A' }],
          shuffle: false,
        },
      },
      assets,
    );

    expect(view.content).toEqual({
      passage: 'texto',
      spans: [],
      options: [{ id: 'a', text: 'A', translation: undefined }],
      shuffle: false,
    });
  });

  it('REGISTER_SWAP: direction cai para SPOKEN_TO_STANDARD se vier algo inesperado', () => {
    const view = toItemView(
      {
        id: 'i9',
        type: 'REGISTER_SWAP',
        prompt: 'p',
        content: { source: 'You coming?', direction: 'garbage' },
      },
      assets,
    );

    expect(view.content).toEqual({
      source: 'You coming?',
      direction: 'SPOKEN_TO_STANDARD',
    });
  });
});
