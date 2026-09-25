import {
  candidatesFromLessonOutline,
  kindForSkillType,
  newCandidates,
  type CardCandidate,
} from './domain/card-creation';
import { emptyCardState, scheduleReview } from './domain/fsrs';
import { RATING_THRESHOLDS, ratingFromAnswer } from './domain/rating';
import {
  buildSession,
  isRecurring,
  sessionCapacity,
  type CardForSession,
} from './domain/session';

const NOW = new Date('2026-01-15T12:00:00.000Z');

describe('fsrs', () => {
  it('empurra o due para frente a cada revisão bem-sucedida', () => {
    let state = emptyCardState(NOW);
    let due = state.due;

    for (const rating of ['GOOD', 'GOOD', 'GOOD'] as const) {
      state = scheduleReview(state, rating, due);
      expect(state.due.getTime()).toBeGreaterThan(due.getTime());
      due = state.due;
    }

    expect(state.reps).toBe(3);
    expect(state.lapses).toBe(0);
    expect(state.state).not.toBe('NEW');
  });

  it('um lapse depois de virar REVIEW derruba a estabilidade e conta em lapses', () => {
    let state = emptyCardState(NOW);
    let now = NOW;

    // Passos de aprendizagem curto prazo: alguns Good até virar REVIEW.
    for (let i = 0; i < 10 && state.state !== 'REVIEW'; i += 1) {
      state = scheduleReview(state, 'GOOD', now);
      now = state.due;
    }

    expect(state.state).toBe('REVIEW');
    const stabilityBeforeLapse = state.stability;

    state = scheduleReview(state, 'AGAIN', now);

    expect(state.lapses).toBe(1);
    expect(state.state).toBe('RELEARNING');
    expect(state.stability).toBeLessThan(stabilityBeforeLapse);
  });
});

describe('ratingFromAnswer', () => {
  const base = {
    isCorrect: true,
    hintsUsed: 0,
    // Nem rápido (< fastMs) nem lento (> slowMs), sem sequência: cai no
    // meio-termo, Good — os outros testes sobrescrevem o que muda o rating.
    responseTimeMs: 8_000,
    correctStreak: 0,
  };

  it('errou vira Again, independente do resto', () => {
    expect(
      ratingFromAnswer({ ...base, isCorrect: false, correctStreak: 5 }),
    ).toBe('AGAIN');
  });

  it('certo com dica vira Hard', () => {
    expect(ratingFromAnswer({ ...base, hintsUsed: 1 })).toBe('HARD');
  });

  it('certo mas lento vira Hard', () => {
    expect(
      ratingFromAnswer({
        ...base,
        responseTimeMs: RATING_THRESHOLDS.slowMs + 1,
      }),
    ).toBe('HARD');
  });

  it('certo, rápido e com sequência vira Easy', () => {
    expect(
      ratingFromAnswer({
        ...base,
        responseTimeMs: RATING_THRESHOLDS.fastMs - 1,
        correctStreak: RATING_THRESHOLDS.easyStreak,
      }),
    ).toBe('EASY');
  });

  it('certo, rápido mas sem sequência vira Good, não Easy', () => {
    expect(
      ratingFromAnswer({
        ...base,
        responseTimeMs: RATING_THRESHOLDS.fastMs - 1,
        correctStreak: RATING_THRESHOLDS.easyStreak - 1,
      }),
    ).toBe('GOOD');
  });

  it('certo, sem pressa e sem sequência vira Good', () => {
    expect(ratingFromAnswer(base)).toBe('GOOD');
  });
});

describe('kindForSkillType / candidatesFromLessonOutline', () => {
  it('classifica VOCAB_SET e CHUNK, e joga o resto em SKILL', () => {
    expect(kindForSkillType('VOCAB_SET')).toBe('VOCAB');
    expect(kindForSkillType('CHUNK')).toBe('CHUNK');
    expect(kindForSkillType('GRAMMAR')).toBe('SKILL');
    expect(kindForSkillType('REGISTER')).toBe('SKILL');
  });

  it('junta target skills e referenciadas, e nota de registro, sem repetir', () => {
    const skillTypeById = new Map([
      ['skill.present-simple', 'GRAMMAR'],
      ['chunk.nice-to-meet-you', 'CHUNK'],
      ['vocab.numbers-1-20', 'VOCAB_SET'],
    ]);

    const candidates = candidatesFromLessonOutline(
      {
        targetSkillIds: ['skill.present-simple'],
        referencedSkillIds: [
          'skill.present-simple',
          'chunk.nice-to-meet-you',
          'vocab.numbers-1-20',
        ],
        registerNoteIds: ['register.gonna'],
      },
      skillTypeById,
    );

    expect(candidates).toHaveLength(4);
    expect(candidates).toEqual(
      expect.arrayContaining([
        { kind: 'SKILL', refId: 'skill.present-simple' },
        { kind: 'CHUNK', refId: 'chunk.nice-to-meet-you' },
        { kind: 'VOCAB', refId: 'vocab.numbers-1-20' },
        { kind: 'REGISTER_NOTE', refId: 'register.gonna' },
      ]),
    );
  });
});

describe('newCandidates', () => {
  it('não recria o que o aluno já tem — "vocabulário novo" é isso', () => {
    const candidates: CardCandidate[] = [
      { kind: 'SKILL', refId: 'skill.a' },
      { kind: 'VOCAB', refId: 'vocab.b' },
    ];
    const existing = new Set(['SKILL:skill.a']);

    expect(newCandidates(candidates, existing)).toEqual([
      { kind: 'VOCAB', refId: 'vocab.b' },
    ]);
  });

  it('não duplica candidatos repetidos dentro do próprio lote', () => {
    const candidates: CardCandidate[] = [
      { kind: 'SKILL', refId: 'skill.a' },
      { kind: 'SKILL', refId: 'skill.a' },
    ];

    expect(newCandidates(candidates, new Set())).toHaveLength(1);
  });
});

describe('sessão de revisão', () => {
  function card(
    overrides: Partial<CardForSession> & { id: string },
  ): CardForSession {
    return { kind: 'SKILL', due: NOW, lapses: 0, ...overrides };
  }

  it('ERROR_PATTERN e card com 2+ lapses são recorrentes', () => {
    expect(isRecurring(card({ id: '1', kind: 'ERROR_PATTERN' }))).toBe(true);
    expect(isRecurring(card({ id: '2', lapses: 2 }))).toBe(true);
    expect(isRecurring(card({ id: '3', lapses: 1 }))).toBe(false);
  });

  it('recorrente vem antes de tudo, depois o mais atrasado primeiro', () => {
    const dayMs = 86_400_000;
    const cards = [
      card({ id: 'old', due: new Date(NOW.getTime() - 5 * dayMs) }),
      card({ id: 'error', kind: 'ERROR_PATTERN', due: NOW }),
      card({ id: 'recent', due: new Date(NOW.getTime() - dayMs) }),
    ];

    const session = buildSession(cards, NOW, 60);

    expect(session.map((c) => c.id)).toEqual(['error', 'old', 'recent']);
  });

  it('corta pelo tempo disponível — o resto fica para a próxima sessão', () => {
    const cards = Array.from({ length: 10 }, (_, index) =>
      card({ id: `c${String(index)}`, due: NOW }),
    );

    // 25s por card (padrão): 2 minutos cabem 4.
    expect(sessionCapacity(2)).toBe(4);
    expect(buildSession(cards, NOW, 2)).toHaveLength(4);
    expect(buildSession(cards, NOW, 60)).toHaveLength(10);
  });

  it('0 minutos não serve nenhum card', () => {
    expect(sessionCapacity(0)).toBe(0);
  });
});
