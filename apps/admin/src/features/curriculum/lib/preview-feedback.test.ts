import { describe, expect, it } from 'vitest';

import { buildPreviewFeedback } from './preview-feedback';

describe('buildPreviewFeedback', () => {
  it('múltipla escolha: ids e textos das alternativas certas', () => {
    const feedback = buildPreviewFeedback({
      type: 'MULTIPLE_CHOICE',
      content: {
        options: [
          { id: 'am', text: 'am' },
          { id: 'is', text: 'is' },
        ],
        correctOptionIds: ['am'],
      },
      explanation: 'Com "I", o verbo é "am".',
    });

    expect(feedback).toMatchObject({
      isCorrect: true,
      verdict: 'CORRECT',
      explanation: 'Com "I", o verbo é "am".',
      correctAnswer: { optionIds: ['am'], texts: ['am'] },
    });
  });

  it('ouvir e escolher e interpretação usam o mesmo formato', () => {
    for (const type of ['LISTEN_CHOOSE', 'READING_COMPREHENSION']) {
      const feedback = buildPreviewFeedback({
        type,
        content: {
          options: [
            { id: 'a', text: 'Austin' },
            { id: 'b', text: 'Boston' },
          ],
          correctOptionIds: ['b'],
        },
        explanation: null,
      });

      expect(feedback.correctAnswer).toEqual({
        optionIds: ['b'],
        texts: ['Boston'],
      });
      expect(feedback.explanation).toBe('');
    }
  });

  it('ligar pares: os pares do conteúdo', () => {
    const feedback = buildPreviewFeedback({
      type: 'MATCH',
      content: {
        pairs: [
          { left: 'cat', right: 'gato' },
          { left: 'dog', right: 'cachorro' },
        ],
      },
      explanation: null,
    });

    expect(feedback.correctAnswer).toEqual({
      pairs: [
        { left: 'cat', right: 'gato' },
        { left: 'dog', right: 'cachorro' },
      ],
    });
  });

  it('respostas digitadas: a primeira aceita é a de referência', () => {
    for (const type of [
      'ORDER_WORDS',
      'FILL_BLANK',
      'TYPE_ANSWER',
      'DICTATION',
      'REGISTER_SWAP',
    ]) {
      expect(
        buildPreviewFeedback({
          type,
          content: {},
          acceptedAnswers: ["She's from Austin", 'She is from Austin'],
          explanation: null,
        }).correctAnswer,
      ).toEqual({ text: "She's from Austin" });
    }
  });

  it('item sem gabarito legível não quebra', () => {
    expect(
      buildPreviewFeedback({
        type: 'FILL_BLANK',
        content: {},
        acceptedAnswers: null,
        explanation: null,
      }).correctAnswer,
    ).toEqual({ text: '' });

    expect(
      buildPreviewFeedback({
        type: 'MULTIPLE_CHOICE',
        content: { correctOptionIds: ['x'] },
        explanation: null,
      }).correctAnswer,
    ).toEqual({ optionIds: ['x'], texts: ['x'] });
  });
});
