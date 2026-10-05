import type {
  ExplanationCardsContent,
  PracticeContent,
  SceneContent,
  SummaryContent,
} from '@english-saas/shared';

import type { RawStudentItem } from '../items/to-item-view';
import type { LessonAssets, LessonCharacter } from './lesson-types';

/** Dados de exemplo das views de lição — stories e testes. */

export const MAYA_ID = '11111111-1111-4111-8111-111111111111';
export const LUCAS_ID = '22222222-2222-4222-8222-222222222222';
export const AUDIO_ID = '33333333-3333-4333-8333-333333333333';
export const ITEM_ID = '44444444-4444-4444-8444-444444444444';
export const ITEM_2_ID = '55555555-5555-4555-8555-555555555555';

export const characters: LessonCharacter[] = [
  { id: MAYA_ID, slug: 'maya', name: 'Maya', avatarAssetId: null },
  { id: LUCAS_ID, slug: 'lucas', name: 'Lucas', avatarAssetId: null },
];

export const assets: LessonAssets = {
  [AUDIO_ID]: { url: 'https://example.com/scene.mp3' },
};

export const scene: SceneContent = {
  location: 'Corredor do prédio, em Austin',
  summary: 'Maya encontra o vizinho novo.',
  characterIds: [MAYA_ID, LUCAS_ID],
  audioAssetId: AUDIO_ID,
  lines: [
    {
      characterId: MAYA_ID,
      text: 'You coming?',
      standardText: 'Are you coming?',
      translation: 'Você vem?',
      spans: [],
    },
    {
      characterId: LUCAS_ID,
      text: "I'm Lucas.",
      translation: 'Eu sou o Lucas.',
      spans: [{ start: 0, end: 3, kind: 'GRAMMAR', skillId: 'grammar.be' }],
    },
  ],
};

export const cards: ExplanationCardsContent = {
  cards: [
    {
      title: 'Verbo to be',
      bodyMd: 'A forma muda com a **pessoa**.\n\n- I am\n- You are',
      table: {
        headers: ['Pessoa', 'Forma'],
        rows: [
          ['I', 'am'],
          ['You', 'are'],
        ],
      },
      examples: [
        { text: "I'm Lucas.", translation: 'Eu sou o Lucas.', spans: [] },
      ],
    },
    {
      title: 'Forma curta',
      bodyMd: 'Na fala, quase sempre a forma curta.',
      examples: [],
    },
  ],
};

export const practice: PracticeContent = {
  itemIds: [ITEM_ID, ITEM_2_ID],
  shuffle: false,
};

export const practiceItems: RawStudentItem[] = [
  {
    id: ITEM_ID,
    type: 'MULTIPLE_CHOICE',
    prompt: 'I ___ Maya.',
    content: {
      options: [
        { id: 'am', text: 'am' },
        { id: 'is', text: 'is' },
      ],
      shuffle: false,
    },
  },
  {
    id: ITEM_2_ID,
    type: 'MULTIPLE_CHOICE',
    prompt: 'She ___ Lucas.',
    content: {
      options: [
        { id: 'am', text: 'am' },
        { id: 'is', text: 'is' },
      ],
      shuffle: false,
    },
  },
];

export const summary: SummaryContent = {
  takeaways: ["I am / I'm", 'Na fala, a forma curta'],
  skillIds: [],
  registerNoteIds: [],
};
